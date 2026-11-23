/**
 * User routes
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { users, friends, userAchievements, achievements, games, gamePlayers } from '../db/schema';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { GameStatus } from '@async-card-game/shared/types';

export async function registerUserRoutes(fastify: FastifyInstance): Promise<void> {
  // Get user profile
  fastify.get('/users/:userId', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { userId } = request.params as { userId: string };

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

      const u = user[0];

      // Check friendship status
      let friendshipStatus = 'none';
      if (u.id !== request.user!.id) {
        const friend = await db.select()
          .from(friends)
          .where(and(
            eq(friends.userId, request.user!.id),
            eq(friends.friendId, u.id)
          ))
          .limit(1);

        if (friend.length > 0) {
          friendshipStatus = friend[0].status;
        }
      }

      return reply.send({
        success: true,
        data: {
          user: {
            id: u.id,
            username: u.username,
            displayName: u.displayName,
            avatarUrl: u.avatarUrl,
            elo: u.elo,
            gamesPlayed: u.gamesPlayed,
            gamesWon: u.gamesWon,
            currentStreak: u.currentStreak,
            maxStreak: u.maxStreak,
            totalPlayTime: u.totalPlayTime,
            createdAt: u.createdAt,
            friendshipStatus,
          },
        },
      });
    },
  });

  // Get user statistics
  fastify.get('/users/:userId/stats', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { userId } = request.params as { userId: string };

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

      // Get game stats by game type
      const gameStats = await db.select({
        gameType: games.gameType,
        totalGames: count(games.id),
        wins: sql<number>`sum(case when ${games.winnerId} = ${userId} then 1 else 0 end)`,
      })
        .from(games)
        .innerJoin(gamePlayers, eq(gamePlayers.gameId, games.id))
        .where(and(
          eq(gamePlayers.userId, userId),
          eq(games.status, GameStatus.FINISHED)
        ))
        .groupBy(games.gameType);

      // Get recent games
      const recentGames = await db.select({
        id: games.id,
        gameType: games.gameType,
        status: games.status,
        winnerId: games.winnerId,
        createdAt: games.createdAt,
        finishedAt: games.finishedAt,
      })
        .from(games)
        .innerJoin(gamePlayers, eq(gamePlayers.gameId, games.id))
        .where(eq(gamePlayers.userId, userId))
        .orderBy(desc(games.createdAt))
        .limit(10);

      // Get achievements
      const userAchievs = await db.select({
        id: userAchievements.id,
        achievementId: userAchievements.achievementId,
        unlockedAt: userAchievements.unlockedAt,
        progress: userAchievements.progress,
        completed: userAchievements.completed,
        name: achievements.name,
        description: achievements.description,
        icon: achievements.icon,
        rarity: achievements.rarity,
      })
        .from(userAchievements)
        .innerJoin(achievements, eq(achievements.id, userAchievements.achievementId))
        .where(eq(userAchievements.userId, userId))
        .orderBy(desc(userAchievements.unlockedAt));

      return reply.send({
        success: true,
        data: {
          statistics: user[0].statistics,
          gameStats,
          recentGames,
          achievements: userAchievs,
        },
      });
    },
  });

  // Search users
  fastify.get('/users/search', {
    preHandler: authenticate,
    schema: {
      querystring: z.object({
        q: z.string().min(1).max(50),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      }),
    },
    handler: async (request, reply) => {
      const { q, limit } = request.query as { q: string; limit: number };

      const results = await db.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        elo: users.elo,
      })
        .from(users)
        .where(
          sql`${users.username} LIKE ${'%' + q + '%'} OR ${users.displayName} LIKE ${'%' + q + '%'}`
        )
        .limit(limit);

      return reply.send({
        success: true,
        data: { users: results },
      });
    },
  });

  // Get friends list
  fastify.get('/users/me/friends', {
    preHandler: authenticate,
    schema: {
      querystring: z.object({
        status: z.enum(['pending', 'accepted', 'blocked', 'all']).default('accepted'),
      }),
    },
    handler: async (request, reply) => {
      const { status } = request.query as { status: string };

      const conditions = [eq(friends.userId, request.user!.id)];
      if (status !== 'all') {
        conditions.push(eq(friends.status, status));
      }

      const friendships = await db.select()
        .from(friends)
        .where(and(...conditions))
        .orderBy(desc(friends.createdAt));

      // Get friend user details
      const friendIds = friendships.map(f => f.friendId);
      let friendUsers: any[] = [];

      if (friendIds.length > 0) {
        friendUsers = await db.select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          elo: users.elo,
        })
          .from(users)
          .where(sql`${users.id} IN (${friendIds.map(() => '?').join(',')})`, ...friendIds);
      }

      // Merge
      const friendsWithDetails = friendships.map(f => {
        const user = friendUsers.find(u => u.id === f.friendId);
        return {
          ...f,
          friend: user,
        };
      });

      return reply.send({
        success: true,
        data: { friends: friendsWithDetails },
      });
    },
  });

  // Send friend request
  fastify.post('/users/me/friends', {
    preHandler: authenticate,
    schema: {
      body: z.object({
        friendId: z.string().uuid(),
      }),
    },
    handler: async (request, reply) => {
      const { friendId } = request.body as { friendId: string };
      const userId = request.user!.id;

      if (friendId === userId) {
        return reply.code(400).send({
          success: false,
          error: { code: 'CANNOT_FRIEND_SELF', message: 'Cannot friend yourself' },
        });
      }

      // Check if friend exists
      const friend = await db.select().from(users).where(eq(users.id, friendId)).limit(1);
      if (friend.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      // Check existing friendship
      const existing = await db.select()
        .from(friends)
        .where(and(
          eq(friends.userId, userId),
          eq(friends.friendId, friendId)
        ))
        .limit(1);

      if (existing.length > 0) {
        return reply.code(400).send({
          success: false,
          error: { code: 'ALREADY_FRIENDS', message: 'Friend request already exists' },
        });
      }

      // Check reverse friendship
      const reverse = await db.select()
        .from(friends)
        .where(and(
          eq(friends.userId, friendId),
          eq(friends.friendId, userId)
        ))
        .limit(1);

      if (reverse.length > 0) {
        if (reverse[0].status === 'accepted') {
          return reply.code(400).send({
            success: false,
            error: { code: 'ALREADY_FRIENDS', message: 'Already friends' },
          });
        } else if (reverse[0].status === 'pending') {
          // Accept the pending request
          await db.update(friends)
            .set({ status: 'accepted' })
            .where(eq(friends.id, reverse[0].id));

          // Create mutual friendship
          await db.insert(friends).values({
            id: uuidv4(),
            userId,
            friendId,
            status: 'accepted',
            createdAt: new Date(),
          });

          return reply.send({
            success: true,
            data: { message: 'Friend request accepted', status: 'accepted' },
          });
        }
      }

      // Create friend request
      await db.insert(friends).values({
        id: uuidv4(),
        userId,
        friendId,
        status: 'pending',
        createdAt: new Date(),
      });

      // Create notification
      await db.insert(notifications).values({
        id: uuidv4(),
        userId: friendId,
        type: 'friend_request',
        title: 'New Friend Request',
        message: `${request.user!.displayName} sent you a friend request`,
        data: { fromUserId: userId },
        read: false,
        createdAt: new Date(),
      });

      return reply.code(201).send({
        success: true,
        data: { message: 'Friend request sent', status: 'pending' },
      });
    },
  });

  // Accept/decline friend request
  fastify.patch('/users/me/friends/:friendId', {
    preHandler: authenticate,
    schema: {
      params: z.object({ friendId: z.string().uuid() }),
      body: z.object({
        action: z.enum(['accept', 'decline', 'block', 'unblock', 'remove']),
      }),
    },
    handler: async (request, reply) => {
      const { friendId } = request.params as { friendId: string };
      const { action } = request.body as { action: string };
      const userId = request.user!.id;

      // Find the incoming friend request
      const incoming = await db.select()
        .from(friends)
        .where(and(
          eq(friends.userId, friendId),
          eq(friends.friendId, userId)
        ))
        .limit(1);

      if (incoming.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'REQUEST_NOT_FOUND', message: 'Friend request not found' },
        });
      }

      const friendship = incoming[0];

      switch (action) {
        case 'accept':
          await db.update(friends)
            .set({ status: 'accepted' })
            .where(eq(friends.id, friendship.id));

          // Create mutual friendship
          await db.insert(friends).values({
            id: uuidv4(),
            userId,
            friendId,
            status: 'accepted',
            createdAt: new Date(),
          });

          // Notify
          await db.insert(notifications).values({
            id: uuidv4(),
            userId: friendId,
            type: 'friend_accepted',
            title: 'Friend Request Accepted',
            message: `${request.user!.displayName} accepted your friend request`,
            data: { friendId: userId },
            read: false,
            createdAt: new Date(),
          });

          return reply.send({
            success: true,
            data: { message: 'Friend request accepted', status: 'accepted' },
          });

        case 'decline':
          await db.delete(friends).where(eq(friends.id, friendship.id));
          return reply.send({
            success: true,
            data: { message: 'Friend request declined' },
          });

        case 'block':
          await db.update(friends)
            .set({ status: 'blocked' })
            .where(eq(friends.id, friendship.id));

          // Remove reverse if exists
          await db.delete(friends).where(and(
            eq(friends.userId, userId),
            eq(friends.friendId, friendId)
          ));

          return reply.send({
            success: true,
            data: { message: 'User blocked', status: 'blocked' },
          });

        case 'unblock':
          await db.delete(friends).where(eq(friends.id, friendship.id));
          return reply.send({
            success: true,
            data: { message: 'User unblocked' },
          });

        case 'remove':
          // Remove both directions
          await db.delete(friends).where(and(
            eq(friends.userId, userId),
            eq(friends.friendId, friendId)
          ));
          await db.delete(friends).where(and(
            eq(friends.userId, friendId),
            eq(friends.friendId, userId)
          ));
          return reply.send({
            success: true,
            data: { message: 'Friend removed' },
          });

        default:
          return reply.code(400).send({
            success: false,
            error: { code: 'INVALID_ACTION', message: 'Invalid action' },
          });
      }
    },
  });

  // Get user achievements
  fastify.get('/users/me/achievements', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const allAchievements = await db.select().from(achievements);

      const userAchievs = await db.select()
        .from(userAchievements)
        .where(eq(userAchievements.userId, request.user!.id));

      const userAchievMap = new Map(userAchievs.map(a => [a.achievementId, a]));

      const achievementsWithProgress = allAchievements.map(a => {
        const userAchiev = userAchievMap.get(a.id);
        return {
          ...a,
          unlockedAt: userAchiev?.unlockedAt,
          progress: userAchiev?.progress || 0,
          completed: userAchiev?.completed || false,
        };
      });

      return reply.send({
        success: true,
        data: { achievements: achievementsWithProgress },
      });
    },
  });

  // Update avatar
  fastify.patch('/users/me/avatar', {
    preHandler: authenticate,
    schema: {
      body: z.object({
        avatarUrl: z.string().url(),
      }),
    },
    handler: async (request, reply) => {
      const { avatarUrl } = request.body as { avatarUrl: string };

      await db.update(users)
        .set({ avatarUrl, updatedAt: new Date() })
        .where(eq(users.id, request.user!.id));

      return reply.send({
        success: true,
        data: { avatarUrl },
      });
    },
  });

  // Get user's games
  fastify.get('/users/me/games', {
    preHandler: authenticate,
    schema: {
      querystring: z.object({
        status: z.enum(['waiting', 'active', 'finished', 'all']).default('all'),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      }),
    },
    handler: async (request, reply) => {
      const { status, limit, offset } = request.query as {
        status: string;
        limit: number;
        offset: number;
      };

      const gameIds = await db.select({ gameId: gamePlayers.gameId })
        .from(gamePlayers)
        .where(eq(gamePlayers.userId, request.user!.id));

      const ids = gameIds.map(g => g.gameId);

      if (ids.length === 0) {
        return reply.send({
          success: true,
          data: { games: [], total: 0 },
        });
      }

      const conditions = [sql`${games.id} IN (${ids.map(() => '?').join(',')})`, ...ids];

      if (status !== 'all') {
        conditions.push(eq(games.status, status as GameStatus));
      }

      const gameList = await db.select()
        .from(games)
        .where(and(...conditions))
        .orderBy(desc(games.createdAt))
        .limit(limit)
        .offset(offset);

      return reply.send({
        success: true,
        data: {
          games: gameList,
          total: ids.length,
        },
      });
    },
  });
}

// Import required modules
import { v4 as uuidv4 } from 'uuid';
import { notifications } from '../db/schema';