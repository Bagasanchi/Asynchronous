/**
 * Game routes
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { games, gamePlayers, currentEnemies } from '../db/schema';
import { eq, and, desc, lt, gte, or, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';
import { createAscensionGame, GameEngine } from '@async-card-game/shared/game-logic';
import { Game, GameStatus, GameType, GameSettings, PlayerStatus, ActionType } from '@async-card-game/shared/types';
import { getOrCreateGameEngine } from '../index';
import { createGameRequestSchema, joinGameRequestSchema } from '@async-card-game/shared/validation';

export async function registerGameRoutes(fastify: FastifyInstance): Promise<void> {
  // Create new game
  fastify.post('/games', {
    preHandler: authenticate,
    schema: {
      body: createGameRequestSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                game: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    gameType: { type: 'string' },
                    status: { type: 'string' },
                    currentPlayerIndex: { type: 'number' },
                    turnNumber: { type: 'number' },
                    players: { type: 'array' },
                    maxPlayers: { type: 'number' },
                    seed: { type: 'string' },
                    metadata: { type: 'object' },
                    createdAt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { gameType, settings, invitedPlayers, isPrivate, clubId, tournamentId } = request.body as z.infer<typeof createGameRequestSchema>;
      const userId = request.user!.id;

      // Create game with current user as first player
      const playerIds = [userId, ...(invitedPlayers || [])];
      const game = createAscensionGame(playerIds, settings);

      // Set metadata
      game.metadata.isPrivate = isPrivate;
      game.metadata.clubId = clubId;
      game.metadata.tournamentId = tournamentId;

      // Generate invite code for private games
      if (isPrivate) {
        game.metadata.inviteCode = uuidv4().slice(0, 8).toUpperCase();
      }

      // Save to database
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

      // If it's a 1-player game (daily run), start it immediately
      if (playerIds.length === 1) {
        game.status = GameStatus.ACTIVE;
        await db.update(games)
          .set({ status: GameStatus.ACTIVE, updatedAt: new Date() })
          .where(eq(games.id, game.id));

        // Start first combat
        const engine = getOrCreateGameEngine(game);
        engine.startCombat('cultist'); // First enemy
      }

      return reply.code(201).send({
        success: true,
        data: { game },
      });
    },
  });

  // Join game
  fastify.post('/games/join', {
    preHandler: authenticate,
    schema: {
      body: joinGameRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                game: { type: 'object' },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { gameId, inviteCode } = request.body as z.infer<typeof joinGameRequestSchema>;
      const userId = request.user!.id;

      // Find game
      const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
      if (game.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'GAME_NOT_FOUND', message: 'Game not found' },
        });
      }

      const gameData = game[0];

      // Check if game is joinable
      if (gameData.status !== GameStatus.WAITING) {
        return reply.code(400).send({
          success: false,
          error: { code: 'GAME_NOT_JOINABLE', message: 'Game is not accepting players' },
        });
      }

      // Check if private and verify invite code
      const metadata = gameData.metadata as Record<string, unknown>;
      if (metadata.isPrivate && metadata.inviteCode !== inviteCode) {
        return reply.code(403).send({
          success: false,
          error: { code: 'INVALID_INVITE_CODE', message: 'Invalid invite code' },
        });
      }

      // Check if user already in game
      const existingPlayer = await db.select()
        .from(gamePlayers)
        .where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.userId, userId)))
        .limit(1);

      if (existingPlayer.length > 0) {
        return reply.code(400).send({
          success: false,
          error: { code: 'ALREADY_IN_GAME', message: 'You are already in this game' },
        });
      }

      // Check if game is full
      const players = await db.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId));
      if (players.length >= gameData.maxPlayers) {
        return reply.code(400).send({
          success: false,
          error: { code: 'GAME_FULL', message: 'Game is full' },
        });
      }

      // Add player to game
      const seatIndex = players.length;
      const starterDeck = ['strike', 'strike', 'strike', 'strike', 'strike',
        'defend', 'defend', 'defend', 'defend', 'bash'];

      const { v4: uuidv4 } = await import('uuid');
      const { SeededRandom } = await import('@async-card-game/shared/seeded-random');
      const rng = new SeededRandom(gameData.seed);
      rng.setState(gameData.rngState);

      const deck = starterDeck.map(cardId => ({
        id: uuidv4(),
        cardId,
        upgrades: 0,
        exhausted: false,
      }));
      rng.shuffle(deck);

      const newPlayer = {
        id: uuidv4(),
        gameId,
        userId,
        seatIndex,
        status: PlayerStatus.WAITING,
        health: 80,
        maxHealth: 80,
        block: 0,
        energy: 3,
        maxEnergy: 3,
        gold: 99,
        deck,
        hand: [],
        discardPile: [],
        exhaustPile: [],
        relics: [{ relicId: 'burning_blood', active: true }],
        potions: [],
        buffs: [],
        turnNumber: 0,
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        totalBlockGained: 0,
        totalCardsPlayed: 0,
        totalGoldGained: 0,
        connected: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(gamePlayers).values(newPlayer);

      // Update game player count
      await db.update(games)
        .set({ updatedAt: new Date() })
        .where(eq(games.id, gameId));

      // If game is now full, start it
      const updatedPlayers = await db.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId));
      if (updatedPlayers.length === gameData.maxPlayers) {
        await db.update(games)
          .set({ status: GameStatus.ACTIVE, updatedAt: new Date() })
          .where(eq(games.id, gameId));

        // Start first combat
        const engine = getOrCreateGameEngine({ ...gameData, status: GameStatus.ACTIVE, players: updatedPlayers as any });
        engine.startCombat('cultist');
      }

      return reply.send({
        success: true,
        data: { game: { ...gameData, players: updatedPlayers } },
      });
    },
  });

  // Get game state
  fastify.get('/games/:gameId', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { gameId } = request.params as { gameId: string };
      const userId = request.user!.id;

      // Check if user is in game
      const player = await db.select()
        .from(gamePlayers)
        .where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.userId, userId)))
        .limit(1);

      if (player.length === 0) {
        // Check if game allows spectators
        const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
        if (game.length === 0) {
          return reply.code(404).send({
            success: false,
            error: { code: 'GAME_NOT_FOUND', message: 'Game not found' },
          });
        }

        const metadata = game[0].metadata as Record<string, unknown>;
        if (!metadata.allowSpectators) {
          return reply.code(403).send({
            success: false,
            error: { code: 'SPECTATORS_NOT_ALLOWED', message: 'Spectators not allowed' },
          });
        }
      }

      // Get full game state
      const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
      if (game.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'GAME_NOT_FOUND', message: 'Game not found' },
        });
      }

      const players = await db.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId));
      let currentEnemy = undefined;

      if (game[0].status === GameStatus.ACTIVE) {
        const enemy = await db.select().from(currentEnemies).where(eq(currentEnemies.gameId, gameId)).limit(1);
        if (enemy.length > 0) {
          currentEnemy = enemy[0];
        }
      }

      return reply.send({
        success: true,
        data: {
          game: {
            ...game[0],
            players,
            currentEnemy,
          },
        },
      });
    },
  });

  // List user's games
  fastify.get('/games', {
    preHandler: authenticate,
    schema: {
      querystring: z.object({
        status: z.enum(['waiting', 'active', 'finished', 'all']).default('all'),
        gameType: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      }),
    },
    handler: async (request, reply) => {
      const { status, gameType, limit, offset } = request.query as {
        status: string;
        gameType?: string;
        limit: number;
        offset: number;
      };
      const userId = request.user!.id;

      // Get game IDs user is part of
      const userGames = await db.select({ gameId: gamePlayers.gameId })
        .from(gamePlayers)
        .where(eq(gamePlayers.userId, userId));

      const gameIds = userGames.map(g => g.gameId);

      if (gameIds.length === 0) {
        return reply.send({
          success: true,
          data: { games: [], total: 0 },
        });
      }

      // Build where clause
      const conditions = [sql`${games.id} IN (${gameIds.map(() => '?').join(',')})`];
      const params = [...gameIds];

      if (status !== 'all') {
        conditions.push(eq(games.status, status as GameStatus));
      }

      if (gameType) {
        conditions.push(eq(games.gameType, gameType as GameType));
      }

      const whereClause = sql`${sql.join(conditions, sql` AND `)}`;

      // Get games
      const gameList = await db.select()
        .from(games)
        .where(whereClause)
        .orderBy(desc(games.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(games)
        .where(whereClause);

      return reply.send({
        success: true,
        data: {
          games: gameList,
          total: countResult[0]?.count || 0,
        },
      });
    },
  });

  // Player action (play card, end turn, use potion, etc.)
  fastify.post('/games/:gameId/action', {
    preHandler: authenticate,
    schema: {
      params: z.object({ gameId: z.string().uuid() }),
      body: z.object({
        type: z.nativeEnum(ActionType),
        data: z.unknown(),
      }),
    },
    handler: async (request, reply) => {
      const { gameId } = request.params as { gameId: string };
      const { type, data } = request.body as { type: ActionType; data: unknown };
      const userId = request.user!.id;

      // Get game
      const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
      if (game.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'GAME_NOT_FOUND', message: 'Game not found' },
        });
      }

      const gameData = game[0];

      // Check if game is active
      if (gameData.status !== GameStatus.ACTIVE) {
        return reply.code(400).send({
          success: false,
          error: { code: 'GAME_NOT_ACTIVE', message: 'Game is not active' },
        });
      }

      // Get current player
      const currentPlayer = await db.select()
        .from(gamePlayers)
        .where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.seatIndex, gameData.currentPlayerIndex)))
        .limit(1);

      if (currentPlayer.length === 0) {
        return reply.code(400).send({
          success: false,
          error: { code: 'NO_CURRENT_PLAYER', message: 'No current player found' },
        });
      }

      // Check if it's the requesting user's turn
      if (currentPlayer[0].userId !== userId) {
        return reply.code(403).send({
          success: false,
          error: { code: 'NOT_YOUR_TURN', message: 'It is not your turn' },
        });
      }

      // Get or create game engine
      const players = await db.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId));
      let currentEnemy: any = undefined;
      if (gameData.status === GameStatus.ACTIVE) {
        const enemy = await db.select().from(currentEnemies).where(eq(currentEnemies.gameId, gameId)).limit(1);
        if (enemy.length > 0) currentEnemy = enemy[0];
      }

      const fullGame: Game = {
        ...gameData,
        players: players as any,
        currentEnemy,
      } as Game;

      const engine = getOrCreateGameEngine(fullGame);
      const player = engine.getCurrentPlayer();

      let success = false;

      switch (type) {
        case ActionType.PLAY_CARD:
          success = engine.playCard(data as any, player);
          break;
        case ActionType.END_TURN:
          engine.endTurn(player);
          success = true;
          break;
        case ActionType.USE_POTION:
          success = engine.usePotion(data as any, player);
          break;
        case ActionType.CHOICE:
          // Handle choices (e.g., card rewards)
          success = true;
          break;
      }

      if (!success) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_ACTION', message: 'Invalid action' },
        });
      }

      // Check victory/defeat
      const endReason = engine.checkVictory();
      if (endReason) {
        const updatedGame = engine.serialize();
        await db.update(games)
          .set({
            status: GameStatus.FINISHED,
            winnerId: updatedGame.winner,
            endReason,
            finishedAt: new Date(),
            updatedAt: new Date(),
            log: updatedGame.log,
            rngState: updatedGame.rngState,
          })
          .where(eq(games.id, gameId));

        // Update player stats
        for (const p of updatedGame.players) {
          const isWinner = updatedGame.winner === p.userId;
          await db.update(gamePlayers)
            .set({
              status: isWinner ? PlayerStatus.FINISHED : PlayerStatus.FINISHED,
              health: p.health,
              block: p.block,
              energy: p.energy,
              gold: p.gold,
              deck: p.deck,
              hand: p.hand,
              discardPile: p.discardPile,
              exhaustPile: p.exhaustPile,
              relics: p.relics,
              potions: p.potions,
              buffs: p.buffs,
              turnNumber: p.turnNumber,
              totalDamageDealt: p.totalDamageDealt,
              totalDamageTaken: p.totalDamageTaken,
              totalBlockGained: p.totalBlockGained,
              totalCardsPlayed: p.totalCardsPlayed,
              totalGoldGained: p.totalGoldGained,
              updatedAt: new Date(),
            })
            .where(eq(gamePlayers.id, p.id));

          // Update user stats
          await db.update(users)
            .set({
              gamesPlayed: sql`${users.gamesPlayed} + 1`,
              gamesWon: sql`${users.gamesWon} + ${isWinner ? 1 : 0}`,
              updatedAt: new Date(),
            })
            .where(eq(users.id, p.userId));
        }

        // Clean up
        activeGames.delete(gameId);
      } else {
        // Save updated game state
        const updatedGame = engine.serialize();
        await db.update(games)
          .set({
            currentPlayerIndex: updatedGame.currentPlayerIndex,
            turnNumber: updatedGame.turnNumber,
            turnPhase: updatedGame.turnPhase,
            turnStartTime: updatedGame.turnStartTime,
            rngState: updatedGame.rngState,
            log: updatedGame.log,
            currentEnemy: updatedGame.currentEnemy ? {
              enemyId: updatedGame.currentEnemy.enemyId,
              currentHp: updatedGame.currentEnemy.currentHp,
              maxHp: updatedGame.currentEnemy.maxHp,
              block: updatedGame.currentEnemy.block,
              buffs: updatedGame.currentEnemy.buffs,
              intent: updatedGame.currentEnemy.intent,
              intentIndex: updatedGame.currentEnemy.intentIndex,
            } : undefined,
            updatedAt: new Date(),
          })
          .where(eq(games.id, gameId));

        // Update current enemy
        if (updatedGame.currentEnemy) {
          await db.insert(currentEnemies).values({
            id: uuidv4(),
            gameId,
            enemyId: updatedGame.currentEnemy.enemyId,
            currentHp: updatedGame.currentEnemy.currentHp,
            maxHp: updatedGame.currentEnemy.maxHp,
            block: updatedGame.currentEnemy.block,
            buffs: updatedGame.currentEnemy.buffs,
            intent: updatedGame.currentEnemy.intent,
            intentIndex: updatedGame.currentEnemy.intentIndex,
            updatedAt: new Date(),
          }).onConflictDoUpdate({
            target: currentEnemies.gameId,
            set: {
              currentHp: updatedGame.currentEnemy.currentHp,
              block: updatedGame.currentEnemy.block,
              buffs: updatedGame.currentEnemy.buffs,
              intent: updatedGame.currentEnemy.intent,
              intentIndex: updatedGame.currentEnemy.intentIndex,
              updatedAt: new Date(),
            },
          });
        }

        // Update players
        for (const p of updatedGame.players) {
          await db.update(gamePlayers)
            .set({
              status: p.status,
              health: p.health,
              block: p.block,
              energy: p.energy,
              gold: p.gold,
              deck: p.deck,
              hand: p.hand,
              discardPile: p.discardPile,
              exhaustPile: p.exhaustPile,
              relics: p.relics,
              potions: p.potions,
              buffs: p.buffs,
              turnNumber: p.turnNumber,
              totalDamageDealt: p.totalDamageDealt,
              totalDamageTaken: p.totalDamageTaken,
              totalBlockGained: p.totalBlockGained,
              totalCardsPlayed: p.totalCardsPlayed,
              totalGoldGained: p.totalGoldGained,
              lastActionAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(gamePlayers.id, p.id));
        }
      }

      // Return updated game state
      const updatedGame = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
      const updatedPlayers = await db.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId));

      return reply.send({
        success: true,
        data: {
          game: {
            ...updatedGame[0],
            players: updatedPlayers,
            currentEnemy: updatedGame[0].currentEnemy,
          },
        },
      });
    },
  });

  // Forfeit game
  fastify.post('/games/:gameId/forfeit', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { gameId } = request.params as { gameId: string };
      const userId = request.user!.id;

      // Check if user is in game
      const player = await db.select()
        .from(gamePlayers)
        .where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.userId, userId)))
        .limit(1);

      if (player.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NOT_IN_GAME', message: 'You are not in this game' },
        });
      }

      const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
      if (game.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'GAME_NOT_FOUND', message: 'Game not found' },
        });
      }

      if (game[0].status !== GameStatus.ACTIVE && game[0].status !== GameStatus.WAITING) {
        return reply.code(400).send({
          success: false,
          error: { code: 'GAME_ALREADY_OVER', message: 'Game is already over' },
        });
      }

      // Mark player as forfeited
      await db.update(gamePlayers)
        .set({ status: PlayerStatus.FORFEITED, updatedAt: new Date() })
        .where(eq(gamePlayers.id, player[0].id));

      // Check if all other players forfeited or only one player left
      const remainingPlayers = await db.select()
        .from(gamePlayers)
        .where(and(eq(gamePlayers.gameId, gameId), sql`${gamePlayers.status} != ${PlayerStatus.FORFEITED}`));

      if (remainingPlayers.length <= 1) {
        // Game over
        const winner = remainingPlayers[0];
        await db.update(games)
          .set({
            status: GameStatus.FINISHED,
            winnerId: winner?.userId,
            endReason: GameStatus.FINISHED,
            finishedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(games.id, gameId));

        if (winner) {
          await db.update(users)
            .set({
              gamesPlayed: sql`${users.gamesPlayed} + 1`,
              gamesWon: sql`${users.gamesWon} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(users.id, winner.userId));
        }
      }

      activeGames.delete(gameId);

      return reply.send({
        success: true,
        data: { message: 'Forfeited successfully' },
      });
    },
  });

  // Get game log
  fastify.get('/games/:gameId/log', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { gameId } = request.params as { gameId: string };
      const userId = request.user!.id;

      // Check access
      const player = await db.select()
        .from(gamePlayers)
        .where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.userId, userId)))
        .limit(1);

      if (player.length === 0) {
        const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
        if (game.length === 0) {
          return reply.code(404).send({
            success: false,
            error: { code: 'GAME_NOT_FOUND', message: 'Game not found' },
          });
        }

        const metadata = game[0].metadata as Record<string, unknown>;
        if (!metadata.allowSpectators) {
          return reply.code(403).send({
            success: false,
            error: { code: 'SPECTATORS_NOT_ALLOWED', message: 'Spectators not allowed' },
          });
        }
      }

      const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
      if (game.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'GAME_NOT_FOUND', message: 'Game not found' },
        });
      }

      return reply.send({
        success: true,
        data: { log: game[0].log },
      });
    },
  });
}