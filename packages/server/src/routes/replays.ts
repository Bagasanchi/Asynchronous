/**
 * Replay routes
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { replays, games, gamePlayers, users } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { GameType } from '@async-card-game/shared/types';
import { getOrCreateGameEngine } from '../index';
import { GameEngine } from '@async-card-game/shared/game-logic';

export async function registerReplayRoutes(fastify: FastifyInstance): Promise<void> {
  // Get replay by ID
  fastify.get('/replays/:replayId', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { replayId } = request.params as { replayId: string };

      const replay = await db.select()
        .from(replays)
        .where(eq(replays.id, replayId))
        .limit(1);

      if (replay.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'REPLAY_NOT_FOUND', message: 'Replay not found' },
        });
      }

      return reply.send({
        success: true,
        data: { replay: replay[0] },
      });
    },
  });

  // Get replays for a game
  fastify.get('/replays/game/:gameId', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { gameId } = request.params as { gameId: string };

      const replay = await db.select()
        .from(replays)
        .where(eq(replays.gameId, gameId))
        .limit(1);

      if (replay.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'REPLAY_NOT_FOUND', message: 'Replay not found for this game' },
        });
      }

      return reply.send({
        success: true,
        data: { replay: replay[0] },
      });
    },
  });

  // List user's replays
  fastify.get('/replays', {
    preHandler: authenticate,
    schema: {
      querystring: z.object({
        gameType: z.nativeEnum(GameType).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      }),
    },
    handler: async (request, reply) => {
      const { gameType, limit, offset } = request.query as {
        gameType?: GameType;
        limit: number;
        offset: number;
      };

      // Get user's game IDs
      const userGames = await db.select({ gameId: gamePlayers.gameId })
        .from(gamePlayers)
        .where(eq(gamePlayers.userId, request.user!.id));

      const gameIds = userGames.map(g => g.gameId);

      if (gameIds.length === 0) {
        return reply.send({
          success: true,
          data: { replays: [], total: 0 },
        });
      }

      const conditions = [sql`${replays.gameId} IN (${gameIds.map(() => '?').join(',')})`, ...gameIds];

      if (gameType) {
        conditions.push(eq(replays.gameType, gameType));
      }

      const replayList = await db.select()
        .from(replays)
        .where(and(...conditions))
        .orderBy(desc(replays.createdAt))
        .limit(limit)
        .offset(offset);

      return reply.send({
        success: true,
        data: {
          replays: replayList,
          total: gameIds.length,
        },
      });
    },
  });

  // Watch replay (step through actions)
  fastify.post('/replays/:replayId/watch', {
    preHandler: authenticate,
    schema: {
      params: z.object({ replayId: z.string().uuid() }),
      body: z.object({
        turn: z.number().int().min(0).optional(),
        actionIndex: z.number().int().min(0).optional(),
      }),
    },
    handler: async (request, reply) => {
      const { replayId } = request.params as { replayId: string };
      const { turn, actionIndex } = request.body as { turn?: number; actionIndex?: number };

      const replay = await db.select()
        .from(replays)
        .where(eq(replays.id, replayId))
        .limit(1);

      if (replay.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'REPLAY_NOT_FOUND', message: 'Replay not found' },
        });
      }

      const replayData = replay[0];
      const actions = replayData.actions as any[];

      // If no turn/action specified, return initial state
      if (turn === undefined && actionIndex === undefined) {
        // Reconstruct initial game state from seed
        const { GameEngine } = await import('@async-card-game/shared/game-logic');
        const game = await db.select().from(games).where(eq(games.id, replayData.gameId)).limit(1);
        if (game.length === 0) {
          return reply.code(404).send({
            success: false,
            error: { code: 'GAME_NOT_FOUND', message: 'Original game not found' },
          });
        }

        const players = await db.select().from(gamePlayers).where(eq(gamePlayers.gameId, replayData.gameId));
        const initialGame = { ...game[0], players: players as any };
        const engine = GameEngine.deserialize(initialGame);

        return reply.send({
          success: true,
          data: {
            state: engine.serialize(),
            totalTurns: replayData.turnCount,
            totalActions: actions.length,
          },
        });
      }

      // Replay up to specified point
      const game = await db.select().from(games).where(eq(games.id, replayData.gameId)).limit(1);
      if (game.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'GAME_NOT_FOUND', message: 'Original game not found' },
        });
      }

      const players = await db.select().from(gamePlayers).where(eq(gamePlayers.gameId, replayData.gameId));
      const initialGame = { ...game[0], players: players as any };
      const engine = GameEngine.deserialize(initialGame);

      const targetTurn = turn ?? replayData.turnCount;
      const targetAction = actionIndex ?? actions.length;

      let currentTurn = 0;
      let currentAction = 0;

      for (const action of actions) {
        if (currentTurn > targetTurn) break;
        if (currentTurn === targetTurn && currentAction >= targetAction) break;

        // Apply action
        const player = engine.getPlayerByUserId(action.playerId);
        if (player) {
          switch (action.type) {
            case 'play_card':
              engine.playCard(action.data, player);
              break;
            case 'end_turn':
              engine.endTurn(player);
              break;
            case 'use_potion':
              engine.usePotion(action.data, player);
              break;
          }
        }

        currentAction++;
        if (action.type === 'end_turn') {
          currentTurn++;
          currentAction = 0;
        }
      }

      return reply.send({
        success: true,
        data: {
          state: engine.serialize(),
          currentTurn,
          currentAction,
          totalTurns: replayData.turnCount,
          totalActions: actions.length,
        },
      });
    },
  });

  // Download replay as JSON
  fastify.get('/replays/:replayId/download', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { replayId } = request.params as { replayId: string };

      const replay = await db.select()
        .from(replays)
        .where(eq(replays.id, replayId))
        .limit(1);

      if (replay.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'REPLAY_NOT_FOUND', message: 'Replay not found' },
        });
      }

      const replayData = replay[0];

      // Get original game for full context
      const game = await db.select().from(games).where(eq(games.id, replayData.gameId)).limit(1);
      const players = await db.select().from(gamePlayers).where(eq(gamePlayers.gameId, replayData.gameId));

      const downloadData = {
        replay: replayData,
        game: game[0] || null,
        players: players,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      };

      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="replay-${replayId}.json"`);

      return reply.send(downloadData);
    },
  });

  // Create replay from finished game (called automatically when game ends)
  fastify.post('/replays/create', {
    preHandler: authenticate,
    schema: {
      body: z.object({
        gameId: z.string().uuid(),
      }),
    },
    handler: async (request, reply) => {
      const { gameId } = request.body as { gameId: string };

      // Check if replay already exists
      const existing = await db.select()
        .from(replays)
        .where(eq(replays.gameId, gameId))
        .limit(1);

      if (existing.length > 0) {
        return reply.code(409).send({
          success: false,
          error: { code: 'REPLAY_EXISTS', message: 'Replay already exists for this game' },
        });
      }

      const game = await db.select()
        .from(games)
        .where(eq(games.id, gameId))
        .limit(1);

      if (game.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'GAME_NOT_FOUND', message: 'Game not found' },
        });
      }

      const gameData = game[0];

      if (gameData.status !== 'finished') {
        return reply.code(400).send({
          success: false,
          error: { code: 'GAME_NOT_FINISHED', message: 'Game must be finished to create replay' },
        });
      }

      const players = await db.select()
        .from(gamePlayers)
        .where(eq(gamePlayers.gameId, gameId));

      // Build replay players
      const replayPlayers = players.map(p => ({
        userId: p.userId,
        seatIndex: p.seatIndex,
        finalHealth: p.health,
        totalDamageDealt: p.totalDamageDealt,
        totalCardsPlayed: p.totalCardsPlayed,
      }));

      // Extract actions from game log
      const log = gameData.log as any[];
      const actions = log.filter(entry => entry.action !== 'turn_start' && entry.action !== 'turn_end')
        .map(entry => ({
          type: entry.action,
          playerId: players[entry.playerIndex]?.userId,
          gameId,
          timestamp: entry.timestamp,
          data: entry.data,
        }));

      const replayRecord = {
        id: uuidv4(),
        gameId,
        gameType: gameData.gameType,
        players: replayPlayers,
        actions,
        seed: gameData.seed,
        winnerId: gameData.winnerId,
        duration: gameData.finishedAt ? new Date(gameData.finishedAt).getTime() - new Date(gameData.createdAt).getTime() : 0,
        turnCount: gameData.turnNumber,
        version: '1.0.0',
        createdAt: new Date(),
      };

      await db.insert(replays).values(replayRecord);

      return reply.code(201).send({
        success: true,
        data: { replay: replayRecord },
      });
    },
  });
}

import { v4 as uuidv4 } from 'uuid';