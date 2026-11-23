/**
 * Authentication routes
 * Self-contained - implements validation schemas inline
 */

import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

// Inline validation schemas (from @async-card-game/shared/validation)
const registerRequestSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(50),
});

const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

const refreshTokenRequestSchema = z.object({
  refreshToken: z.string(),
});

export async function registerAuthRoutes(fastify: FastifyInstance): Promise<void> {
  // Register
  fastify.post('/auth/register', {
    schema: {
      body: registerRequestSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    username: { type: 'string' },
                    email: { type: 'string' },
                    displayName: { type: 'string' },
                    elo: { type: 'number' },
                  },
                },
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { username, email, password, displayName } = request.body as z.infer<typeof registerRequestSchema>;

      // Check if username or email already exists
      const existing = await db.select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existing.length > 0) {
        return reply.code(409).send({
          success: false,
          error: { code: 'USERNAME_TAKEN', message: 'Username already taken' },
        });
      }

      const existingEmail = await db.select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingEmail.length > 0) {
        return reply.code(409).send({
          success: false,
          error: { code: 'EMAIL_TAKEN', message: 'Email already registered' },
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const userId = uuidv4();
      const now = new Date();

      await db.insert(users).values({
        id: userId,
        username,
        email,
        passwordHash,
        displayName,
        elo: 1000,
        gamesPlayed: 0,
        gamesWon: 0,
        currentStreak: 0,
        maxStreak: 0,
        totalPlayTime: 0,
        preferences: {},
        statistics: {},
        createdAt: now,
        updatedAt: now,
      });

      // Generate tokens
      const accessToken = fastify.jwt.sign({ userId, username });
      const refreshToken = await createRefreshToken(userId);

      // Set cookies
      reply.setCookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60, // 15 minutes
        path: '/',
      });

      reply.setCookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      });

      return reply.code(201).send({
        success: true,
        data: {
          user: {
            id: userId,
            username,
            email,
            displayName,
            elo: 1000,
          },
          accessToken,
          refreshToken,
        },
      });
    },
  });

  // Login
  fastify.post('/auth/login', {
    schema: {
      body: loginRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    username: { type: 'string' },
                    email: { type: 'string' },
                    displayName: { type: 'string' },
                    elo: { type: 'number' },
                    avatarUrl: { type: 'string' },
                  },
                },
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { email, password, rememberMe } = request.body as z.infer<typeof loginRequestSchema>;

      // Find user by email
      const user = await db.select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (user.length === 0) {
        return reply.code(401).send({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        });
      }

      // Verify password
      const valid = await bcrypt.compare(password, user[0].passwordHash);
      if (!valid) {
        return reply.code(401).send({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        });
      }

      // Update last login
      await db.update(users)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, user[0].id));

      // Generate tokens
      const accessToken = fastify.jwt.sign({ userId: user[0].id, username: user[0].username });
      const refreshToken = await createRefreshToken(user[0].id);

      // Set cookies
      const accessMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 15 * 60;
      reply.setCookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: accessMaxAge,
        path: '/',
      });

      reply.setCookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      });

      return reply.send({
        success: true,
        data: {
          user: {
            id: user[0].id,
            username: user[0].username,
            email: user[0].email,
            displayName: user[0].displayName,
            elo: user[0].elo,
            avatarUrl: user[0].avatarUrl,
          },
          accessToken,
          refreshToken,
        },
      });
    },
  });

  // Refresh token
  fastify.post('/auth/refresh', {
    schema: {
      body: refreshTokenRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { refreshToken } = request.body as z.infer<typeof refreshTokenRequestSchema>;

      // Verify refresh token
      const userId = await verifyRefreshToken(refreshToken);
      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' },
        });
      }

      // Get user
      const user = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user.length === 0) {
        return reply.code(401).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      // Revoke old refresh token
      await revokeRefreshToken(refreshToken);

      // Generate new tokens
      const newAccessToken = fastify.jwt.sign({ userId: user[0].id, username: user[0].username });
      const newRefreshToken = await createRefreshToken(user[0].id);

      // Set cookies
      reply.setCookie('accessToken', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60,
        path: '/',
      });

      reply.setCookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      });

      return reply.send({
        success: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      });
    },
  });

  // Logout
  fastify.post('/auth/logout', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      // Revoke refresh token from cookie
      const refreshToken = request.cookies.refreshToken;
      if (refreshToken) {
        await revokeRefreshToken(refreshToken);
      }

      // Clear cookies
      reply.clearCookie('accessToken', { path: '/' });
      reply.clearCookie('refreshToken', { path: '/' });

      return reply.send({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    },
  });

  // Get current user
  fastify.get('/auth/me', {
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

      return reply.send({
        success: true,
        data: {
          user: {
            id: user[0].id,
            username: user[0].username,
            email: user[0].email,
            displayName: user[0].displayName,
            elo: user[0].elo,
            avatarUrl: user[0].avatarUrl,
            gamesPlayed: user[0].gamesPlayed,
            gamesWon: user[0].gamesWon,
            currentStreak: user[0].currentStreak,
            maxStreak: user[0].maxStreak,
            totalPlayTime: user[0].totalPlayTime,
            preferences: user[0].preferences,
            statistics: user[0].statistics,
          },
        },
      });
    },
  });

  // Update user preferences
  fastify.patch('/auth/preferences', {
    preHandler: authenticate,
    schema: {
      body: z.object({
        theme: z.enum(['light', 'dark', 'system']).optional(),
        notifications: z.object({
          email: z.boolean().optional(),
          push: z.boolean().optional(),
          inGame: z.boolean().optional(),
        }).optional(),
        turnReminderHours: z.number().int().min(1).max(168).optional(),
        autoEndTurn: z.boolean().optional(),
        showCardHints: z.boolean().optional(),
        animationsEnabled: z.boolean().optional(),
        soundEnabled: z.boolean().optional(),
        language: z.string().optional(),
      }),
    },
    handler: async (request, reply) => {
      const updates = request.body as Record<string, unknown>;

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

      const currentPrefs = user[0].preferences as Record<string, unknown>;
      const newPrefs = { ...currentPrefs, ...updates };

      await db.update(users)
        .set({ preferences: newPrefs, updatedAt: new Date() })
        .where(eq(users.id, request.user!.id));

      return reply.send({
        success: true,
        data: { preferences: newPrefs },
      });
    },
  });

  // Change password
  fastify.post('/auth/change-password', {
    preHandler: authenticate,
    schema: {
      body: z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8).max(128),
      }),
    },
    handler: async (request, reply) => {
      const { currentPassword, newPassword } = request.body as {
        currentPassword: string;
        newPassword: string;
      };

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

      // Verify current password
      const valid = await bcrypt.compare(currentPassword, user[0].passwordHash);
      if (!valid) {
        return reply.code(401).send({
          success: false,
          error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' },
        });
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update password and revoke all other sessions
      await db.update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, request.user!.id));

      await revokeRefreshToken(request.cookies.refreshToken || '');

      return reply.send({
        success: true,
        data: { message: 'Password changed successfully. Please log in again.' },
      });
    },
  });

  // Delete account
  fastify.delete('/auth/account', {
    preHandler: authenticate,
    schema: {
      body: z.object({
        password: z.string().min(1),
      }),
    },
    handler: async (request, reply) => {
      const { password } = request.body as { password: string };

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

      // Verify password
      const valid = await bcrypt.compare(password, user[0].passwordHash);
      if (!valid) {
        return reply.code(401).send({
          success: false,
          error: { code: 'INVALID_PASSWORD', message: 'Password is incorrect' },
        });
      }

      // Delete user (cascade will handle related records)
      await db.delete(users).where(eq(users.id, request.user!.id));

      // Clear cookies
      reply.clearCookie('accessToken', { path: '/' });
      reply.clearCookie('refreshToken', { path: '/' });

      return reply.send({
        success: true,
        data: { message: 'Account deleted successfully' },
      });
    },
  });
}