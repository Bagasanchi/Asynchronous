/**
 * Daily Run routes
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { dailyRuns, users, games, gamePlayers } from '../db/schema';
import { eq, and, desc, lt, gte, sql, count } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';
import { createAscensionGame, GameEngine } from '@async-card-game/shared/game-logic';
import { GameType, GameStatus, GameSettings, PlayerStatus } from '@async-card-game/shared/types';
import { getOrCreateGameEngine } from '../index';

export async function registerDailyRunRoutes(fastify: FastifyInstance): Promise<void> {
  // Get today's daily run
  fastify.get('/daily-runs/today', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      let dailyRun = await db.select()
        .from(dailyRuns)
        .where(eq(dailyRuns.date, today))
        .limit(1);

      if (dailyRun.length === 0) {
        // Create today's daily run
        dailyRun = await createDailyRun(today);
      }

      const run = dailyRun[0];

      // Check if user has already participated
      const existingGame = await db.select()
        .from(games)
        .innerJoin(gamePlayers, eq(gamePlayers.gameId, games.id))
        .where(and(
          eq(gamePlayers.userId, request.user!.id),
          eq(games.gameType, run.gameType),
          sql`${games.metadata}->>'dailyRunDate' = ${today}`
        ))
        .limit(1);

      return reply.send({
        success: true,
        data: {
          dailyRun: {
            ...run,
            leaderboard: run.leaderboard || [],
            totalParticipants: run.totalParticipants || 0,
            userParticipated: existingGame.length > 0,
            userGameId: existingGame[0]?.games.id,
          },
        },
      });
    },
  });

  // Get daily run by date
  fastify.get('/daily-runs/:date', {
    preHandler: authenticate,
    schema: {
      params: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    },
    handler: async (request, reply) => {
      const { date } = request.params as { date: string };

      const dailyRun = await db.select()
        .from(dailyRuns)
        .where(eq(dailyRuns.date, date))
        .limit(1);

      if (dailyRun.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'DAILY_RUN_NOT_FOUND', message: 'Daily run not found for this date' },
        });
      }

      const run = dailyRun[0];

      // Check if user participated
      let userEntry = null;
      if (run.leaderboard) {
        userEntry = run.leaderboard.find((entry: any) => entry.userId === request.user!.id);
      }

      return reply.send({
        success: true,
        data: {
          dailyRun: {
            ...run,
            userEntry,
          },
        },
      });
    },
  });

  // Start/join daily run
  fastify.post('/daily-runs/today/join', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const today = new Date().toISOString().split('T')[0];

      let dailyRun = await db.select()
        .from(dailyRuns)
        .where(eq(dailyRuns.date, today))
        .limit(1);

      if (dailyRun.length === 0) {
        dailyRun = await createDailyRun(today);
      }

      const run = dailyRun[0];

      // Check if already participated
      const existingGame = await db.select()
        .from(games)
        .innerJoin(gamePlayers, eq(gamePlayers.gameId, games.id))
        .where(and(
          eq(gamePlayers.userId, request.user!.id),
          eq(games.gameType, run.gameType),
          sql`${games.metadata}->>'dailyRunDate' = ${today}`
        ))
        .limit(1);

      if (existingGame.length > 0) {
        return reply.code(400).send({
          success: false,
          error: { code: 'ALREADY_PARTICIPATED', message: 'You have already participated in today\'s daily run' },
        });
      }

      // Create game for daily run
      const settings: GameSettings = {
        turnTimeLimitHours: 24,
        allowSpectators: false,
        allowChat: false,
        allowUndo: false,
        difficulty: 'normal',
      };

      const game = createAscensionGame([request.user!.id], settings);
      game.gameType = run.gameType;
      game.seed = run.seed;
      game.modifiers = run.modifiers as any;
      game.metadata = {
        ...game.metadata,
        isDailyRun: true,
        dailyRunDate: today,
        dailyRunId: run.id,
      };

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

      // Save player
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
      const engine = getOrCreateGameEngine(game);
      engine.startCombat('cultist');

      // Update daily run participant count
      await db.update(dailyRuns)
        .set({ totalParticipants: (run.totalParticipants || 0) + 1 })
        .where(eq(dailyRuns.id, run.id));

      return reply.code(201).send({
        success: true,
        data: { game },
      });
    },
  });

  // Submit daily run score (when game finishes)
  fastify.post('/daily-runs/today/submit', {
    preHandler: authenticate,
    schema: {
      body: z.object({
        gameId: z.string().uuid(),
      }),
    },
    handler: async (request, reply) => {
      const { gameId } = request.body as { gameId: string };
      const today = new Date().toISOString().split('T')[0];

      // Verify game exists and belongs to user
      const game = await db.select()
        .from(games)
        .innerJoin(gamePlayers, eq(gamePlayers.gameId, games.id))
        .where(and(
          eq(games.id, gameId),
          eq(gamePlayers.userId, request.user!.id),
          eq(games.status, GameStatus.FINISHED)
        ))
        .limit(1);

      if (game.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'GAME_NOT_FOUND', message: 'Finished game not found' },
        });
      }

      const gameData = game[0].games;
      const playerData = game[0].game_players;

      // Verify it's a daily run
      const metadata = gameData.metadata as Record<string, unknown>;
      if (!metadata.isDailyRun || metadata.dailyRunDate !== today) {
        return reply.code(400).send({
          success: false,
          error: { code: 'NOT_DAILY_RUN', message: 'Game is not a daily run' },
        });
      }

      // Calculate score
      const score = calculateDailyRunScore(playerData, gameData);

      // Get daily run
      const dailyRun = await db.select()
        .from(dailyRuns)
        .where(eq(dailyRuns.date, today))
        .limit(1);

      if (dailyRun.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'DAILY_RUN_NOT_FOUND', message: 'Daily run not found' },
        });
      }

      const run = dailyRun[0];
      const leaderboard = (run.leaderboard as any[]) || [];

      // Add entry
      const entry = {
        userId: request.user!.id,
        username: request.user!.username,
        displayName: request.user!.displayName,
        score,
        turns: gameData.turnNumber,
        timeElapsed: gameData.finishedAt ? new Date(gameData.finishedAt).getTime() - new Date(gameData.createdAt).getTime() : 0,
        completed: gameData.endReason === 'victory',
        defeatedEnemies: gameData.enemiesDefeated,
        floorReached: gameData.floor,
        damageTaken: playerData.totalDamageTaken,
        deck: (playerData.deck as any[]).map(c => c.cardId),
        relics: (playerData.relics as any[]).map(r => r.relicId),
        submittedAt: new Date().toISOString(),
      };

      leaderboard.push(entry);
      leaderboard.sort((a, b) => b.score - a.score);

      // Update ranks
      leaderboard.forEach((e, i) => e.rank = i + 1);

      // Update daily run
      await db.update(dailyRuns)
        .set({ leaderboard, totalParticipants: leaderboard.length, updatedAt: new Date() })
        .where(eq(dailyRuns.id, run.id));

      // Check for achievements
      await checkDailyRunAchievements(request.user!.id, entry, leaderboard);

      return reply.send({
        success: true,
        data: { entry, rank: leaderboard.findIndex(e => e.userId === request.user!.id) + 1 },
      });
    },
  });

  // Get daily run leaderboard
  fastify.get('/daily-runs/today/leaderboard', {
    preHandler: authenticate,
    schema: {
      querystring: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      }),
    },
    handler: async (request, reply) => {
      const { limit, offset } = request.query as { limit: number; offset: number };
      const today = new Date().toISOString().split('T')[0];

      const dailyRun = await db.select()
        .from(dailyRuns)
        .where(eq(dailyRuns.date, today))
        .limit(1);

      if (dailyRun.length === 0) {
        return reply.send({
          success: true,
          data: { entries: [], total: 0 },
        });
      }

      const leaderboard = (dailyRun[0].leaderboard as any[]) || [];
      const entries = leaderboard.slice(offset, offset + limit);

      return reply.send({
        success: true,
        data: {
          entries,
          total: leaderboard.length,
        },
      });
    },
  });

  // Get historical daily runs
  fastify.get('/daily-runs', {
    preHandler: authenticate,
    schema: {
      querystring: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(30),
        offset: z.coerce.number().int().min(0).default(0),
      }),
    },
    handler: async (request, reply) => {
      const { limit, offset } = request.query as { limit: number; offset: number };

      const runs = await db.select()
        .from(dailyRuns)
        .orderBy(desc(dailyRuns.date))
        .limit(limit)
        .offset(offset);

      return reply.send({
        success: true,
        data: { runs },
      });
    },
  });
}

async function createDailyRun(date: string) {
  // Generate deterministic seed from date
  const seed = generateSeedFromDate(date);

  // Generate modifiers for the run
  const modifiers = generateDailyModifiers(seed);

  const dailyRun = {
    id: uuidv4(),
    date,
    gameType: GameType.ASCENSION,
    seed,
    modifiers,
    leaderboard: [],
    totalParticipants: 0,
    createdAt: new Date(),
  };

  await db.insert(dailyRuns).values(dailyRun);

  return [dailyRun];
}

function generateSeedFromDate(date: string): string {
  let hash = 0;
  for (let i = 0; i < date.length; i++) {
    hash = ((hash << 5) - hash) + date.charCodeAt(i);
    hash |= 0;
  }
  return `daily_${date}_${Math.abs(hash).toString(36)}`;
}

function generateDailyModifiers(seed: string) {
  const { SeededRandom } = require('@async-card-game/shared/seeded-random');
  const rng = new SeededRandom(seed);

  const allModifiers = [
    { id: 'cursed_run', name: 'Cursed Run', description: 'Start with a Curse in your deck', effects: [] },
    { id: 'elite_rush', name: 'Elite Rush', description: 'All enemies are Elites', effects: [] },
    { id: 'glass_cannon', name: 'Glass Cannon', description: '+50% damage, -50% health', effects: [] },
    { id: 'blessed', name: 'Blessed', description: 'Start with a Blessing', effects: [] },
    { id: 'draft_mode', name: 'Draft Mode', description: 'Choose from 3 cards each reward', effects: [] },
    { id: 'no_potions', name: 'No Potions', description: 'Cannot obtain or use potions', effects: [] },
    { id: 'infinite_energy', name: 'Infinite Energy', description: 'Gain 1 extra energy per turn', effects: [] },
    { id: 'relic_rush', name: 'Relic Rush', description: 'Start with 3 relics, no gold', effects: [] },
  ];

  const count = rng.nextInt(1, 3);
  const selected = [];
  for (let i = 0; i < count; i++) {
    const idx = rng.nextInt(0, allModifiers.length - 1);
    selected.push(allModifiers.splice(idx, 1)[0]);
  }

  return selected;
}

function calculateDailyRunScore(player: any, game: any): number {
  let score = 0;

  // Base score for completion
  if (game.endReason === 'victory') {
    score += 10000;
  }

  // Floor reached
  score += game.floor * 500;

  // Enemies defeated
  score += game.enemiesDefeated * 100;

  // Damage taken penalty
  score -= player.totalDamageTaken * 2;

  // Turn efficiency bonus
  if (game.turnNumber > 0) {
    score += Math.max(0, 5000 - game.turnNumber * 10);
  }

  // Health bonus
  const healthPercent = player.health / player.maxHealth;
  score += Math.floor(healthPercent * 2000);

  // Gold bonus
  score += player.gold;

  // Cards played efficiency
  if (player.totalCardsPlayed > 0) {
    score += Math.floor(player.totalDamageDealt / player.totalCardsPlayed * 10);
  }

  return Math.max(0, score);
}

async function checkDailyRunAchievements(userId: string, entry: any, leaderboard: any[]) {
  // Check various achievement criteria
  const rank = leaderboard.findIndex(e => e.userId === userId) + 1;

  // Top 1, Top 10, Top 100
  if (rank === 1) {
    await unlockAchievement(userId, 'daily_run_champion');
  }
  if (rank <= 10) {
    await unlockAchievement(userId, 'daily_run_top_10');
  }
  if (rank <= 100) {
    await unlockAchievement(userId, 'daily_run_top_100');
  }

  // Perfect run (victory with full health)
  if (entry.completed && entry.damageTaken === 0) {
    await unlockAchievement(userId, 'daily_run_perfect');
  }

  // Speed run (victory in under 30 turns)
  if (entry.completed && entry.turns < 30) {
    await unlockAchievement(userId, 'daily_run_speedrunner');
  }
}

async function unlockAchievement(userId: string, achievementId: string) {
  const existing = await db.select()
    .from(userAchievements)
    .where(and(
      eq(userAchievements.userId, userId),
      eq(userAchievements.achievementId, achievementId)
    ))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(userAchievements).values({
      id: uuidv4(),
      userId,
      achievementId,
      unlockedAt: new Date(),
      progress: 1,
      completed: true,
    });
  }
}

import { userAchievements } from '../db/schema';
import { GameType } from '@async-card-game/shared/types';