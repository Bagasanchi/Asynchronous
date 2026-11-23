/**
 * Notification routes
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { notifications, users } from '../db/schema';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';

export async function registerNotificationRoutes(fastify: FastifyInstance): Promise<void> {
  // Get user's notifications
  fastify.get('/notifications', {
    preHandler: authenticate,
    schema: {
      querystring: z.object({
        unreadOnly: z.coerce.boolean().default(false),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      }),
    },
    handler: async (request, reply) => {
      const { unreadOnly, limit, offset } = request.query as {
        unreadOnly: boolean;
        limit: number;
        offset: number;
      };
      const userId = request.user!.id;

      const conditions = [eq(notifications.userId, userId)];
      if (unreadOnly) {
        conditions.push(eq(notifications.read, false));
      }

      const notifs = await db.select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const totalResult = await db.select({ count: count() })
        .from(notifications)
        .where(and(...conditions));

      // Get unread count
      const unreadResult = await db.select({ count: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

      return reply.send({
        success: true,
        data: {
          notifications: notifs,
          total: totalResult[0].count,
          unreadCount: unreadResult[0].count,
        },
      });
    },
  });

  // Get unread count
  fastify.get('/notifications/unread-count', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const userId = request.user!.id;

      const result = await db.select({ count: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

      return reply.send({
        success: true,
        data: { count: result[0].count },
      });
    },
  });

  // Mark notification as read
  fastify.patch('/notifications/:notificationId/read', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { notificationId } = request.params as { notificationId: string };
      const userId = request.user!.id;

      const notif = await db.select()
        .from(notifications)
        .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
        .limit(1);

      if (notif.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found' },
        });
      }

      await db.update(notifications)
        .set({ read: true })
        .where(eq(notifications.id, notificationId));

      return reply.send({
        success: true,
        data: { message: 'Marked as read' },
      });
    },
  });

  // Mark all notifications as read
  fastify.patch('/notifications/read-all', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const userId = request.user!.id;

      await db.update(notifications)
        .set({ read: true })
        .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

      return reply.send({
        success: true,
        data: { message: 'All notifications marked as read' },
      });
    },
  });

  // Delete notification
  fastify.delete('/notifications/:notificationId', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { notificationId } = request.params as { notificationId: string };
      const userId = request.user!.id;

      const notif = await db.select()
        .from(notifications)
        .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
        .limit(1);

      if (notif.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found' },
        });
      }

      await db.delete(notifications).where(eq(notifications.id, notificationId));

      return reply.send({
        success: true,
        data: { message: 'Notification deleted' },
      });
    },
  });

  // Get notification preferences (from user preferences)
  fastify.get('/notifications/preferences', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const user = await db.select()
        .from(users)
        .where(eq(users.id, request.user!.id))
        .limit(1);

      if (user.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      const prefs = user[0].preferences as any;
      const notificationPrefs = prefs.notifications || { email: true, push: true, inGame: true };

      return reply.send({
        success: true,
        data: { preferences: notificationPrefs },
      });
    },
  });

  // Update notification preferences
  fastify.patch('/notifications/preferences', {
    preHandler: authenticate,
    schema: {
      body: z.object({
        email: z.boolean().optional(),
        push: z.boolean().optional(),
        inGame: z.boolean().optional(),
        turnReminders: z.boolean().optional(),
        friendRequests: z.boolean().optional(),
        gameInvites: z.boolean().optional(),
        tournamentUpdates: z.boolean().optional(),
        dailyRunReminders: z.boolean().optional(),
      }),
    },
    handler: async (request, reply) => {
      const updates = request.body as Record<string, boolean>;
      const userId = request.user!.id;

      const user = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      const currentPrefs = user[0].preferences as any;
      const newPrefs = {
        ...currentPrefs,
        notifications: {
          ...currentPrefs.notifications,
          ...updates,
        },
      };

      await db.update(users)
        .set({ preferences: newPrefs, updatedAt: new Date() })
        .where(eq(users.id, userId));

      return reply.send({
        success: true,
        data: { preferences: newPrefs.notifications },
      });
    },
  });

  // Create test notification (for development)
  fastify.post('/notifications/test', {
    preHandler: authenticate,
    schema: {
      body: z.object({
        type: z.string().optional(),
        title: z.string().min(1).max(100),
        message: z.string().min(1).max(500),
        data: z.record(z.unknown()).optional(),
      }),
    },
    handler: async (request, reply) => {
      const { type, title, message, data } = request.body as {
        type?: string;
        title: string;
        message: string;
        data?: Record<string, unknown>;
      };
      const userId = request.user!.id;

      await db.insert(notifications).values({
        id: uuidv4(),
        userId,
        type: type || 'system',
        title,
        message,
        data,
        read: false,
        createdAt: new Date(),
      });

      return reply.code(201).send({
        success: true,
        data: { message: 'Test notification created' },
      });
    },
  });
}

import { v4 as uuidv4 } from 'uuid';