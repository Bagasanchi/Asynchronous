/**
 * Matchmaking routes
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { matchmakingQueues, games, gamePlayers } from '../db/schema';
import { eq, and, desc, lt, gte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';
import { queuePreferencesSchema } from '@async-card-game/shared/validation';
import { GameType, MatchmakingQueueStatus, GameStatus, PlayerStatus } from '@async-card-game/shared/types';
import { createAscensionGame } from '@async-card-game/shared/game-logic';

const matchmakingQueueSchema = z.object({
  gameType: z.nativeEnum(GameType),
  preferences: queuePreferencesSchema,
});

const leaveQueueSchema = z.object({
  gameType: z.nativeEnum(GameType),
});

export async function registerMatchmakingRoutes(fastify: FastifyInstance): Promise<void> {
  // Join matchmaking queue
  fastify.post('/matchmaking/join', {
    preHandler: authenticate,
    schema: {
      body: matchmakingQueueSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                queueId: { type: 'string' },
                position: { type: 'number' },
                estimatedWaitTime: { type: 'number' },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { gameType, preferences } = request.body as z.infer<typeof matchmakingQueueSchema>;
      const userId = request.user!.id;

      // Check if user is already in a queue for this game type
      const existingQueue = await db.select()
        .from(matchmakingQueues)
        .where(and(
          eq(matchmakingQueues.gameType, gameType),
          eq(matchmakingQueues.status, MatchmakingQueueStatus.WAITING)
        ))
        .limit(1);

      if (existingQueue.length > 0) {
        const queue = existingQueue[0];
        const players = queue.players as Array<{ userId: string; elo: number; joinedAt: string; preferences: any }>;

        // Check if already in queue
        const alreadyInQueue = players.find(p => p.userId === userId);
        if (alreadyInQueue) {
          return reply.code(400).send({
            success: false,
            error: { code: 'ALREADY_IN_QUEUE', message: 'You are already in the queue' },
          });
        }

        // Check if queue is full
        if (players.length >= preferences.maxPlayers) {
          return reply.code(400).send({
            success: false,
            error: { code: 'QUEUE_FULL', message: 'Queue is full' },
          });
        }

        // Add player to existing queue
        const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (user.length === 0) {
          return reply.code(404).send({
            success: false,
            error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          });
        }

        players.push({
          userId,
          elo: user[0].elo,
          joinedAt: new Date().toISOString(),
          preferences,
        });

        await db.update(matchmakingQueues)
          .set({ players, updatedAt: new Date() })
          .where(eq(matchmakingQueues.id, queue.id));

        return reply.send({
          success: true,
          data: {
            queueId: queue.id,
            position: players.length,
            estimatedWaitTime: calculateEstimatedWait(players.length, preferences),
          },
        });
      }

      // Create new queue
      const queueId = uuidv4();
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      const newQueue = {
        id: queueId,
        gameType,
        status: MatchmakingQueueStatus.WAITING,
        players: [{
          userId,
          elo: user[0].elo,
          joinedAt: new Date().toISOString(),
          preferences,
        }],
        createdAt: new Date(),
      };

      await db.insert(matchmakingQueues).values(newQueue);

      // Try to match if enough players
      await tryMatchQueue(queueId);

      return reply.send({
        success: true,
        data: {
          queueId,
          position: 1,
          estimatedWaitTime: calculateEstimatedWait(1, preferences),
        },
      });
    },
  });

  // Leave matchmaking queue
  fastify.post('/matchmaking/leave', {
    preHandler: authenticate,
    schema: {
      body: leaveQueueSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { gameType } = request.body as z.infer<typeof leaveQueueSchema>;
      const userId = request.user!.id;

      const queue = await db.select()
        .from(matchmakingQueues)
        .where(and(
          eq(matchmakingQueues.gameType, gameType),
          eq(matchmakingQueues.status, MatchmakingQueueStatus.WAITING)
        ))
        .limit(1);

      if (queue.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'QUEUE_NOT_FOUND', message: 'No active queue found' },
        });
      }

      const q = queue[0];
      const players = q.players as Array<{ userId: string; elo: number; joinedAt: string; preferences: any }>;
      const playerIndex = players.findIndex(p => p.userId === userId);

      if (playerIndex === -1) {
        return reply.code(400).send({
          success: false,
          error: { code: 'NOT_IN_QUEUE', message: 'You are not in this queue' },
        });
      }

      players.splice(playerIndex, 1);

      if (players.length === 0) {
        await db.delete(matchmakingQueues).where(eq(matchmakingQueues.id, q.id));
      } else {
        await db.update(matchmakingQueues)
          .set({ players, updatedAt: new Date() })
          .where(eq(matchmakingQueues.id, q.id));
      }

      return reply.send({
        success: true,
        data: {},
      });
    },
  });

  // Get queue status
  fastify.get('/matchmaking/status', {
    preHandler: authenticate,
    schema: {
      querystring: z.object({
        gameType: z.nativeEnum(GameType),
      }),
    },
    handler: async (request, reply) => {
      const { gameType } = request.query as { gameType: GameType };
      const userId = request.user!.id;

      const queue = await db.select()
        .from(matchmakingQueues)
        .where(and(
          eq(matchmakingQueues.gameType, gameType),
          eq(matchmakingQueues.status, MatchmakingQueueStatus.WAITING)
        ))
        .limit(1);

      if (queue.length === 0) {
        return reply.send({
          success: true,
          data: { inQueue: false, position: null, queueSize: 0 },
        });
      }

      const q = queue[0];
      const players = q.players as Array<{ userId: string; elo: number; joinedAt: string; preferences: any }>;
      const playerIndex = players.findIndex(p => p.userId === userId);

      if (playerIndex === -1) {
        return reply.send({
          success: true,
          data: { inQueue: false, position: null, queueSize: players.length },
        });
      }

      return reply.send({
        success: true,
        data: {
          inQueue: true,
          position: playerIndex + 1,
          queueSize: players.length,
          estimatedWaitTime: calculateEstimatedWait(players.length, players[0]?.preferences),
        },
      });
    },
  });

  // Get all active queues
  fastify.get('/matchmaking/queues', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const queues = await db.select()
        .from(matchmakingQueues)
        .where(eq(matchmakingQueues.status, MatchmakingQueueStatus.WAITING))
        .orderBy(desc(matchmakingQueues.createdAt));

      return reply.send({
        success: true,
        data: {
          queues: queues.map(q => ({
            id: q.id,
            gameType: q.gameType,
            playerCount: (q.players as any[]).length,
            createdAt: q.createdAt,
          })),
        },
      });
    },
  });
}

async function tryMatchQueue(queueId: string): Promise<void> {
  const queue = await db.select()
    .from(matchmakingQueues)
    .where(eq(matchmakingQueues.id, queueId))
    .limit(1);

  if (queue.length === 0) return;

  const q = queue[0];
  const players = q.players as Array<{ userId: string; elo: number; joinedAt: string; preferences: any }>;

  // Check if we have enough players (at least minPlayers from first player's preferences)
  const minPlayers = players[0]?.preferences?.minPlayers || 2;
  if (players.length < minPlayers) return;

  // Create game with matched players
  const playerIds = players.map(p => p.userId);
  const settings = players[0]?.preferences || { turnTimeLimitHours: 24, allowSpectators: true, allowChat: true };

  const game = createAscensionGame(playerIds, settings);
  game.status = GameStatus.ACTIVE;

  // Save game
  await db.insert(games).values({
    id: game.id,
    gameType: game.gameType,
    status: game.status,
    currentPlayerIndex: game.currentPlayerIndex,
    turnNumber: game.turnNumber,
    turnPhase: game.turnPhase,
    turnStartTime: game.turnStartTime,
    turnTimeLimit: game.turnTimeLimit,
    maxPlayers: game.maxPlayers,
    seed: game.seed,
    rngState: game.rngState,
    enemiesDefeated: game.enemiesDefeated,
    floor: game.floor,
    act: game.act,
    ascensionLevel: game.ascensionLevel,
    modifiers: game.modifiers,
    log: game.log,
    metadata: game.metadata,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
  });

  // Save players
  for (const player of game.players) {
    await db.insert(gamePlayers).values({
      id: player.id,
      gameId: game.id,
      userId: player.userId,
      seatIndex: player.seatIndex,
      status: player.status,
      health: player.health,
      maxHealth: player.maxHealth,
      block: player.block,
      energy: player.energy,
      maxEnergy: player.maxEnergy,
      gold: player.gold,
      deck: player.deck,
      hand: player.hand,
      discardPile: player.discardPile,
      exhaustPile: player.exhaustPile,
      relics: player.relics,
      potions: player.potions,
      buffs: player.buffs,
      turnNumber: player.turnNumber,
      totalDamageDealt: player.totalDamageDealt,
      totalDamageTaken: player.totalDamageTaken,
      totalBlockGained: player.totalBlockGained,
      totalCardsPlayed: player.totalCardsPlayed,
      totalGoldGained: player.totalGoldGained,
      connected: player.connected,
      lastActionAt: player.lastActionAt,
      createdAt: player.createdAt,
      updatedAt: player.updatedAt,
    });
  }

  // Start first combat
  const { GameEngine } = await import('@async-card-game/shared/game-logic');
  const engine = GameEngine.deserialize(game);
  engine.startCombat('cultist');

  // Update queue status
  await db.update(matchmakingQueues)
    .set({
      status: MatchmakingQueueStatus.MATCHED,
      matchedAt: new Date(),
      gameId: game.id,
    })
    .where(eq(matchmakingQueues.id, queueId));

  // Notify players (via WebSocket - implemented in websocket.ts)
  for (const player of players) {
    // Notification would be sent here
    console.log(`Matched player ${player.userId} to game ${game.id}`);
  }
}

function calculateEstimatedWait(queueSize: number, preferences: any): number {
  const minPlayers = preferences?.minPlayers || 2;
  const avgMatchTime = 30; // seconds
  return Math.max(0, (minPlayers - queueSize) * avgMatchTime);
}

// Import users table
import { users } from '../db/schema';