/**
 * Leaderboard routes
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { leaderboards, users } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { GameType } from '@async-card-game/shared/types';

const leaderboardQuerySchema = z.object({
  gameType: z.nativeEnum(GameType),
  period: z.enum(['daily', 'weekly', 'monthly', 'seasonal', 'all_time']).default('all_time'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function registerLeaderboardRoutes(fastify: FastifyInstance): Promise<void> {
  // Get leaderboard
  fastify.get('/leaderboards', {
    preHandler: authenticate,
    schema: {
      querystring: leaderboardQuerySchema,
    },
    handler: async (request, reply) => {
      const { gameType, period, limit, offset } = request.query as z.infer<typeof leaderboardQuerySchema>;

      let leaderboard = await db.select()
        .from(leaderboards)
        .where(and(
          eq(leaderboards.gameType, gameType),
          eq(leaderboards.period, period)
        ))
        .orderBy(desc(leaderboards.periodStart))
        .limit(1);

      if (leaderboard.length === 0) {
        // Create empty leaderboard
        const now = new Date();
        const periodStart = getPeriodStart(period, now);

        leaderboard = [{
          id: 'default',
          gameType,
          period,
          periodStart,
          periodEnd: now,
          entries: [],
          createdAt: now,
          updatedAt: now,
        }];
      }

      const entries = (leaderboard[0].entries as any[]) || [];

      // Get user's rank if not in top entries
      let userRank = null;
      const userId = request.user!.id;
      const userEntry = entries.find(e => e.userId === userId);
      if (userEntry) {
        userRank = entries.indexOf(userEntry) + 1;
      } else if (entries.length >= limit) {
        // User not in returned entries, check full leaderboard
        const fullLeaderboard = await db.select()
          .from(leaderboards)
          .where(and(
            eq(leaderboards.gameType, gameType),
            eq(leaderboards.period, period)
          ))
          .limit(1);

        if (fullLeaderboard.length > 0) {
          const allEntries = (fullLeaderboard[0].entries as any[]) || [];
          const userIdx = allEntries.findIndex(e => e.userId === userId);
          if (userIdx !== -1) {
            userRank = userIdx + 1;
          }
        }
      }

      return reply.send({
        success: true,
        data: {
          gameType,
          period,
          periodStart: leaderboard[0].periodStart,
          periodEnd: leaderboard[0].periodEnd,
          entries: entries.slice(offset, offset + limit),
          total: entries.length,
          userRank,
        },
      });
    },
  });

  // Get user's leaderboard history
  fastify.get('/leaderboards/me', {
    preHandler: authenticate,
    schema: {
      querystring: z.object({
        gameType: z.nativeEnum(GameType).optional(),
        period: z.enum(['daily', 'weekly', 'monthly', 'seasonal', 'all_time']).optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      }),
    },
    handler: async (request, reply) => {
      const { gameType, period, limit } = request.query as {
        gameType?: GameType;
        period?: string;
        limit: number;
      };
      const userId = request.user!.id;

      const conditions = [];
      if (gameType) conditions.push(eq(leaderboards.gameType, gameType));
      if (period) conditions.push(eq(leaderboards.period, period as any));

      const allLeaderboards = await db.select()
        .from(leaderboards)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(leaderboards.periodStart))
        .limit(limit);

      const history = allLeaderboards.map(lb => {
        const entries = (lb.entries as any[]) || [];
        const userEntry = entries.find(e => e.userId === userId);
        return {
          gameType: lb.gameType,
          period: lb.period,
          periodStart: lb.periodStart,
          periodEnd: lb.periodEnd,
          rank: userEntry ? entries.indexOf(userEntry) + 1 : null,
          score: userEntry?.score || 0,
          totalPlayers: entries.length,
        };
      }).filter(h => h.rank !== null);

      return reply.send({
        success: true,
        data: { history },
      });
    },
  });

  // Get top players across all leaderboards (for homepage)
  fastify.get('/leaderboards/top', {
    preHandler: authenticate,
    schema: {
      querystring: z.object({
        gameType: z.nativeEnum(GameType),
        limit: z.coerce.number().int().min(1).max(20).default(10),
      }),
    },
    handler: async (request, reply) => {
      const { gameType, limit } = request.query as { gameType: GameType; limit: number };

      const leaderboard = await db.select()
        .from(leaderboards)
        .where(and(
          eq(leaderboards.gameType, gameType),
          eq(leaderboards.period, 'all_time')
        ))
        .limit(1);

      if (leaderboard.length === 0) {
        return reply.send({
          success: true,
          data: { entries: [] },
        });
      }

      const entries = ((leaderboard[0].entries as any[]) || []).slice(0, limit);

      return reply.send({
        success: true,
        data: { entries },
      });
    },
  });
}

function getPeriodStart(period: string, date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  switch (period) {
    case 'daily':
      return d;
    case 'weekly':
      d.setDate(d.getDate() - d.getDay()); // Start of week (Sunday)
      return d;
    case 'monthly':
      d.setDate(1);
      return d;
    case 'seasonal':
      const month = d.getMonth();
      const seasonStart = Math.floor(month / 3) * 3;
      d.setMonth(seasonStart, 1);
      return d;
    case 'all_time':
    default:
      return new Date(0); // Unix epoch
  }
}