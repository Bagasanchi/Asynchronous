/**
 * Tournament routes
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { tournaments, tournamentParticipants, tournamentBrackets, users, games, gamePlayers } from '../db/schema';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';
import { GameType, GameStatus, GameSettings, PlayerStatus } from '@async-card-game/shared/types';
import { createAscensionGame } from '@async-card-game/shared/game-logic';
import { getOrCreateGameEngine } from '../index';

const createTournamentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  gameType: z.nativeEnum(GameType),
  format: z.object({
    type: z.enum(['single_elimination', 'double_elimination', 'swiss', 'round_robin']),
    maxParticipants: z.number().int().min(2).max(128),
    minParticipants: z.number().int().min(2).max(64),
    bestOf: z.number().int().min(1).max(7).default(1),
  }),
  schedule: z.object({
    registrationStart: z.string().datetime(),
    registrationEnd: z.string().datetime(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime().optional(),
    timezone: z.string().default('UTC'),
  }),
  prizes: z.array(z.object({
    rank: z.number().int().positive(),
    reward: z.string(),
    value: z.number().nonnegative().optional(),
  })).optional(),
  settings: z.object({
    turnTimeLimitHours: z.number().int().min(1).max(168).default(24),
    allowSpectators: z.boolean().default(true),
    requireCheckIn: z.boolean().default(true),
    checkInWindowMinutes: z.number().int().min(5).max(120).default(30),
  }).optional(),
});

export async function registerTournamentRoutes(fastify: FastifyInstance): Promise<void> {
  // Create tournament
  fastify.post('/tournaments', {
    preHandler: authenticate,
    schema: {
      body: createTournamentSchema,
    },
    handler: async (request, reply) => {
      const { name, description, gameType, format, schedule, prizes, settings } = request.body as z.infer<typeof createTournamentSchema>;
      const userId = request.user!.id;

      const now = new Date();
      const regStart = new Date(schedule.registrationStart);
      const regEnd = new Date(schedule.registrationEnd);
      const startDate = new Date(schedule.startDate);

      if (regStart >= regEnd || regEnd >= startDate) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_SCHEDULE', message: 'Registration must end before tournament starts' },
        });
      }

      const tournamentId = uuidv4();

      await db.insert(tournaments).values({
        id: tournamentId,
        name,
        description,
        gameType,
        status: 'upcoming',
        format,
        schedule: { ...schedule, registrationStart: regStart, registrationEnd: regEnd, startDate, endDate: schedule.endDate ? new Date(schedule.endDate) : null },
        prizes: prizes || [],
        settings: settings || { turnTimeLimitHours: 24, allowSpectators: true, requireCheckIn: true, checkInWindowMinutes: 30 },
        createdAt: now,
        updatedAt: now,
      });

      return reply.code(201).send({
        success: true,
        data: {
          tournament: {
            id: tournamentId,
            name,
            description,
            gameType,
            status: 'upcoming',
            format,
            schedule,
            prizes: prizes || [],
            settings: settings || { turnTimeLimitHours: 24, allowSpectators: true, requireCheckIn: true, checkInWindowMinutes: 30 },
            createdAt: now,
            updatedAt: now,
          },
        },
      });
    },
  });

  // Get tournament
  fastify.get('/tournaments/:tournamentId', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { tournamentId } = request.params as { tournamentId: string };

      const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
      if (tournament.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'TOURNAMENT_NOT_FOUND', message: 'Tournament not found' },
        });
      }

      const participants = await db.select({
        id: tournamentParticipants.id,
        userId: tournamentParticipants.userId,
        seed: tournamentParticipants.seed,
        status: tournamentParticipants.status,
        currentRound: tournamentParticipants.currentRound,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        elo: users.elo,
      })
        .from(tournamentParticipants)
        .innerJoin(users, eq(users.id, tournamentParticipants.userId))
        .where(eq(tournamentParticipants.tournamentId, tournamentId))
        .orderBy(tournamentParticipants.seed);

      const brackets = await db.select()
        .from(tournamentBrackets)
        .where(eq(tournamentBrackets.tournamentId, tournamentId))
        .orderBy(tournamentBrackets.round);

      // Check if user is registered
      const userRegistration = participants.find(p => p.userId === request.user!.id);

      return reply.send({
        success: true,
        data: {
          tournament: {
            ...tournament[0],
            participants,
            brackets,
            userRegistered: !!userRegistration,
            userStatus: userRegistration?.status,
          },
        },
      });
    },
  });

  // List tournaments
  fastify.get('/tournaments', {
    preHandler: authenticate,
    schema: {
      querystring: z.object({
        status: z.enum(['upcoming', 'registration', 'active', 'completed', 'cancelled', 'all']).default('all'),
        gameType: z.nativeEnum(GameType).optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      }),
    },
    handler: async (request, reply) => {
      const { status, gameType, limit, offset } = request.query as {
        status: string;
        gameType?: GameType;
        limit: number;
        offset: number;
      };

      const conditions = [];
      if (status !== 'all') conditions.push(eq(tournaments.status, status as any));
      if (gameType) conditions.push(eq(tournaments.gameType, gameType));

      const results = await db.select()
        .from(tournaments)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(tournaments.createdAt))
        .limit(limit)
        .offset(offset);

      return reply.send({
        success: true,
        data: { tournaments: results },
      });
    },
  });

  // Register for tournament
  fastify.post('/tournaments/:tournamentId/register', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { tournamentId } = request.params as { tournamentId: string };
      const userId = request.user!.id;

      const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
      if (tournament.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'TOURNAMENT_NOT_FOUND', message: 'Tournament not found' },
        });
      }

      const t = tournament[0];
      const now = new Date();
      const regEnd = new Date(t.schedule.registrationEnd);

      if (now > regEnd) {
        return reply.code(400).send({
          success: false,
          error: { code: 'REGISTRATION_CLOSED', message: 'Registration has ended' },
        });
      }

      if (t.status !== 'upcoming' && t.status !== 'registration') {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_STATUS', message: 'Tournament is not accepting registrations' },
        });
      }

      // Check if already registered
      const existing = await db.select()
        .from(tournamentParticipants)
        .where(and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.userId, userId)))
        .limit(1);

      if (existing.length > 0) {
        return reply.code(400).send({
          success: false,
          error: { code: 'ALREADY_REGISTERED', message: 'Already registered for this tournament' },
        });
      }

      // Check participant limit
      const participantCount = await db.select({ count: count() })
        .from(tournamentParticipants)
        .where(eq(tournamentParticipants.tournamentId, tournamentId));

      if (participantCount[0].count >= (t.format as any).maxParticipants) {
        return reply.code(400).send({
          success: false,
          error: { code: 'TOURNAMENT_FULL', message: 'Tournament is full' },
        });
      }

      const seed = participantCount[0].count + 1;
      await db.insert(tournamentParticipants).values({
        id: uuidv4(),
        tournamentId,
        userId,
        seed,
        status: 'registered',
        currentRound: 0,
        createdAt: now,
      });

      // Update tournament status to registration if first participant
      if (participantCount[0].count === 0) {
        await db.update(tournaments)
          .set({ status: 'registration', updatedAt: now })
          .where(eq(tournaments.id, tournamentId));
      }

      return reply.code(201).send({
        success: true,
        data: { message: 'Registered successfully', seed },
      });
    },
  });

  // Unregister from tournament
  fastify.post('/tournaments/:tournamentId/unregister', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { tournamentId } = request.params as { tournamentId: string };
      const userId = request.user!.id;

      const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
      if (tournament.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'TOURNAMENT_NOT_FOUND', message: 'Tournament not found' },
        });
      }

      const t = tournament[0];
      const now = new Date();
      const regEnd = new Date(t.schedule.registrationEnd);

      if (now > regEnd) {
        return reply.code(400).send({
          success: false,
          error: { code: 'REGISTRATION_CLOSED', message: 'Cannot unregister after registration ends' },
        });
      }

      await db.delete(tournamentParticipants)
        .where(and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.userId, userId)));

      return reply.send({
        success: true,
        data: { message: 'Unregistered successfully' },
      });
    },
  });

  // Check in for tournament
  fastify.post('/tournaments/:tournamentId/checkin', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { tournamentId } = request.params as { tournamentId: string };
      const userId = request.user!.id;

      const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
      if (tournament.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'TOURNAMENT_NOT_FOUND', message: 'Tournament not found' },
        });
      }

      const t = tournament[0];
      const settings = t.settings as any;

      if (!settings.requireCheckIn) {
        return reply.code(400).send({
          success: false,
          error: { code: 'CHECKIN_NOT_REQUIRED', message: 'Check-in not required for this tournament' },
        });
      }

      const participant = await db.select()
        .from(tournamentParticipants)
        .where(and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.userId, userId)))
        .limit(1);

      if (participant.length === 0) {
        return reply.code(400).send({
          success: false,
          error: { code: 'NOT_REGISTERED', message: 'Not registered for this tournament' },
        });
      }

      const now = new Date();
      const startDate = new Date(t.schedule.startDate);
      const checkInWindow = settings.checkInWindowMinutes * 60 * 1000;

      if (now < startDate - checkInWindow) {
        return reply.code(400).send({
          success: false,
          error: { code: 'CHECKIN_TOO_EARLY', message: 'Check-in not yet open' },
        });
      }

      if (now > startDate) {
        return reply.code(400).send({
          success: false,
          error: { code: 'CHECKIN_CLOSED', message: 'Check-in has closed' },
        });
      }

      await db.update(tournamentParticipants)
        .set({ status: 'checked_in' })
        .where(eq(tournamentParticipants.id, participant[0].id));

      return reply.send({
        success: true,
        data: { message: 'Checked in successfully' },
      });
    },
  });

  // Start tournament (admin only - would need role check)
  fastify.post('/tournaments/:tournamentId/start', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { tournamentId } = request.params as { tournamentId: string };
      const userId = request.user!.id;

      const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
      if (tournament.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'TOURNAMENT_NOT_FOUND', message: 'Tournament not found' },
        });
      }

      const t = tournament[0];

      if (t.status !== 'registration') {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_STATUS', message: 'Tournament cannot be started' },
        });
      }

      const participants = await db.select()
        .from(tournamentParticipants)
        .where(and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.status, 'checked_in')))
        .orderBy(tournamentParticipants.seed);

      if (participants.length < (t.format as any).minParticipants) {
        return reply.code(400).send({
          success: false,
          error: { code: 'NOT_ENOUGH_PARTICIPANTS', message: `Need at least ${(t.format as any).minParticipants} checked-in participants` },
        });
      }

      // Generate bracket based on format
      const bracket = generateBracket(participants.map(p => p.userId), t.format as any);

      await db.insert(tournamentBrackets).values({
        id: uuidv4(),
        tournamentId,
        round: 1,
        matches: bracket,
        createdAt: new Date(),
      });

      // Create first round games
      await createTournamentGames(tournamentId, bracket, t);

      await db.update(tournaments)
        .set({ status: 'active', updatedAt: new Date() })
        .where(eq(tournaments.id, tournamentId));

      // Notify participants
      for (const p of participants) {
        await db.insert(notifications).values({
          id: uuidv4(),
          userId: p.userId,
          type: 'tournament_started',
          title: 'Tournament Started',
          message: `${t.name} has started! Check your matches.`,
          data: { tournamentId },
          read: false,
          createdAt: new Date(),
        });
      }

      return reply.send({
        success: true,
        data: { message: 'Tournament started', bracket },
      });
    },
  });

  // Get tournament bracket
  fastify.get('/tournaments/:tournamentId/bracket', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { tournamentId } = request.params as { tournamentId: string };

      const brackets = await db.select()
        .from(tournamentBrackets)
        .where(eq(tournamentBrackets.tournamentId, tournamentId))
        .orderBy(tournamentBrackets.round);

      return reply.send({
        success: true,
        data: { brackets },
      });
    },
  });

  // Report match result (for tournament matches)
  fastify.post('/tournaments/:tournamentId/matches/:matchId/result', {
    preHandler: authenticate,
    schema: {
      params: z.object({
        tournamentId: z.string().uuid(),
        matchId: z.string().uuid(),
      }),
      body: z.object({
        winnerId: z.string().uuid(),
        gameId: z.string().uuid(),
      }),
    },
    handler: async (request, reply) => {
      const { tournamentId, matchId } = request.params as { tournamentId: string; matchId: string };
      const { winnerId, gameId } = request.body as { winnerId: string; gameId: string };

      // Verify game exists and is finished
      const game = await db.select().from(games).where(and(eq(games.id, gameId), eq(games.status, GameStatus.FINISHED))).limit(1);
      if (game.length === 0) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_GAME', message: 'Game not found or not finished' },
        });
      }

      // Verify winner is in the game
      const gamePlayer = await db.select().from(gamePlayers).where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.userId, winnerId))).limit(1);
      if (gamePlayer.length === 0) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_WINNER', message: 'Winner not in game' },
        });
      }

      // Update bracket
      const bracket = await db.select().from(tournamentBrackets).where(and(eq(tournamentBrackets.tournamentId, tournamentId), eq(tournamentBrackets.round, 1))).limit(1);
      if (bracket.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'BRACKET_NOT_FOUND', message: 'Bracket not found' },
        });
      }

      const matches = bracket[0].matches as any[];
      const match = matches.find(m => m.id === matchId);
      if (!match) {
        return reply.code(404).send({
          success: false,
          error: { code: 'MATCH_NOT_FOUND', message: 'Match not found' },
        });
      }

      if (match.status === 'completed') {
        return reply.code(400).send({
          success: false,
          error: { code: 'MATCH_COMPLETED', message: 'Match already completed' },
        });
      }

      match.winnerId = winnerId;
      match.gameId = gameId;
      match.status = 'completed';

      await db.update(tournamentBrackets)
        .set({ matches })
        .where(eq(tournamentBrackets.id, bracket[0].id));

      // Update participant
      await db.update(tournamentParticipants)
        .set({ currentRound: (tournamentParticipants.currentRound as number) + 1 })
        .where(eq(tournamentParticipants.userId, winnerId));

      // Check if round complete
      const allCompleted = matches.every(m => m.status === 'completed');
      if (allCompleted) {
        await advanceTournamentRound(tournamentId);
      }

      return reply.send({
        success: true,
        data: { message: 'Match result recorded' },
      });
    },
  });
}

function generateBracket(participants: string[], format: any): any[] {
  if (format.type === 'single_elimination') {
    const matches = [];
    for (let i = 0; i < participants.length; i += 2) {
      if (i + 1 < participants.length) {
        matches.push({
          id: uuidv4(),
          player1Id: participants[i],
          player2Id: participants[i + 1],
          gameId: null,
          winnerId: null,
          status: 'pending',
          scheduledAt: null,
        });
      } else {
        // Bye
        matches.push({
          id: uuidv4(),
          player1Id: participants[i],
          player2Id: null,
          gameId: null,
          winnerId: participants[i],
          status: 'completed',
          scheduledAt: null,
        });
      }
    }
    return matches;
  }
  // Other formats would be implemented similarly
  return [];
}

async function createTournamentGames(tournamentId: string, bracket: any[], tournament: any) {
  const settings = tournament.settings as any;

  for (const match of bracket) {
    if (match.player2Id && match.status === 'pending') {
      const gameSettings: GameSettings = {
        turnTimeLimitHours: settings.turnTimeLimitHours,
        allowSpectators: settings.allowSpectators,
        allowChat: false,
        allowUndo: false,
        difficulty: 'normal',
      };

      const game = createAscensionGame([match.player1Id, match.player2Id], gameSettings);
      game.metadata.tournamentId = tournamentId;
      game.metadata.matchId = match.id;

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

      match.gameId = game.id;
    }
  }
}

async function advanceTournamentRound(tournamentId: string) {
  // Implementation for advancing to next round
  // This would create new bracket round and games
}

import { notifications } from '../db/schema';