/**
 * Club routes
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { clubs, clubMembers, users, games, gamePlayers } from '../db/schema';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';
import { GameType } from '@async-card-game/shared/types';
import { createAscensionGame } from '@async-card-game/shared/game-logic';
import { GameStatus, GameSettings, PlayerStatus } from '@async-card-game/shared/types';

const createClubSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(true),
  requireApproval: z.boolean().default(false),
});

const updateClubSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
  requireApproval: z.boolean().optional(),
});

export async function registerClubRoutes(fastify: FastifyInstance): Promise<void> {
  // Create club
  fastify.post('/clubs', {
    preHandler: authenticate,
    schema: {
      body: createClubSchema,
    },
    handler: async (request, reply) => {
      const { name, description, isPublic, requireApproval } = request.body as z.infer<typeof createClubSchema>;
      const userId = request.user!.id;

      // Check if name is taken
      const existing = await db.select().from(clubs).where(eq(clubs.name, name)).limit(1);
      if (existing.length > 0) {
        return reply.code(409).send({
          success: false,
          error: { code: 'NAME_TAKEN', message: 'Club name already taken' },
        });
      }

      const clubId = uuidv4();
      const now = new Date();

      await db.insert(clubs).values({
        id: clubId,
        name,
        description,
        ownerId: userId,
        settings: { isPublic, requireApproval, defaultGameSettings: {} },
        statistics: { totalGames: 0, activeMembers: 1, topPlayers: [userId] },
        createdAt: now,
        updatedAt: now,
      });

      // Add owner as member
      await db.insert(clubMembers).values({
        id: uuidv4(),
        clubId,
        userId,
        role: 'owner',
        joinedAt: now,
        gamesPlayed: 0,
      });

      return reply.code(201).send({
        success: true,
        data: {
          club: {
            id: clubId,
            name,
            description,
            ownerId: userId,
            settings: { isPublic, requireApproval, defaultGameSettings: {} },
            statistics: { totalGames: 0, activeMembers: 1, topPlayers: [userId] },
            createdAt: now,
            updatedAt: now,
          },
        },
      });
    },
  });

  // Get club
  fastify.get('/clubs/:clubId', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { clubId } = request.params as { clubId: string };

      const club = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
      if (club.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'CLUB_NOT_FOUND', message: 'Club not found' },
        });
      }

      const members = await db.select({
        id: clubMembers.id,
        userId: clubMembers.userId,
        role: clubMembers.role,
        joinedAt: clubMembers.joinedAt,
        gamesPlayed: clubMembers.gamesPlayed,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        elo: users.elo,
      })
        .from(clubMembers)
        .innerJoin(users, eq(users.id, clubMembers.userId))
        .where(eq(clubMembers.clubId, clubId))
        .orderBy(desc(clubMembers.joinedAt));

      // Check if user is member
      const membership = members.find(m => m.userId === request.user!.id);

      return reply.send({
        success: true,
        data: {
          club: {
            ...club[0],
            members,
            isMember: !!membership,
            userRole: membership?.role,
          },
        },
      });
    },
  });

  // Search clubs
  fastify.get('/clubs', {
    preHandler: authenticate,
    schema: {
      querystring: z.object({
        q: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      }),
    },
    handler: async (request, reply) => {
      const { q, limit, offset } = request.query as { q?: string; limit: number; offset: number };

      const conditions = [eq(clubs.settings.isPublic, true)];
      if (q) {
        conditions.push(sql`${clubs.name} LIKE ${'%' + q + '%'} OR ${clubs.description} LIKE ${'%' + q + '%'}`);
      }

      const results = await db.select({
        id: clubs.id,
        name: clubs.name,
        description: clubs.description,
        ownerId: clubs.ownerId,
        settings: clubs.settings,
        statistics: clubs.statistics,
        createdAt: clubs.createdAt,
      })
        .from(clubs)
        .where(and(...conditions))
        .orderBy(desc(clubs.createdAt))
        .limit(limit)
        .offset(offset);

      return reply.send({
        success: true,
        data: { clubs: results },
      });
    },
  });

  // Join club
  fastify.post('/clubs/:clubId/join', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { clubId } = request.params as { clubId: string };
      const userId = request.user!.id;

      const club = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
      if (club.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'CLUB_NOT_FOUND', message: 'Club not found' },
        });
      }

      // Check if already member
      const existing = await db.select()
        .from(clubMembers)
        .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)))
        .limit(1);

      if (existing.length > 0) {
        return reply.code(400).send({
          success: false,
          error: { code: 'ALREADY_MEMBER', message: 'Already a member of this club' },
        });
      }

      const settings = club[0].settings as any;
      const requireApproval = settings?.requireApproval || false;

      const role = requireApproval ? 'pending' : 'member';
      const now = new Date();

      await db.insert(clubMembers).values({
        id: uuidv4(),
        clubId,
        userId,
        role,
        joinedAt: now,
        gamesPlayed: 0,
      });

      // Update club stats
      await db.update(clubs)
        .set({
          statistics: {
            ...club[0].statistics,
            activeMembers: (club[0].statistics as any).activeMembers + 1,
          },
          updatedAt: now,
        })
        .where(eq(clubs.id, clubId));

      if (requireApproval) {
        // Notify admins
        const admins = await db.select()
          .from(clubMembers)
          .where(and(eq(clubMembers.clubId, clubId), sql`${clubMembers.role} IN ('owner', 'admin')`));

        for (const admin of admins) {
          await db.insert(notifications).values({
            id: uuidv4(),
            userId: admin.userId,
            type: 'club_join_request',
            title: 'New Join Request',
            message: `${request.user!.displayName} wants to join ${club[0].name}`,
            data: { clubId, userId },
            read: false,
            createdAt: now,
          });
        }

        return reply.send({
          success: true,
          data: { status: 'pending', message: 'Join request sent for approval' },
        });
      }

      return reply.code(201).send({
        success: true,
        data: { status: 'member', message: 'Joined club successfully' },
      });
    },
  });

  // Leave club
  fastify.post('/clubs/:clubId/leave', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { clubId } = request.params as { clubId: string };
      const userId = request.user!.id;

      const membership = await db.select()
        .from(clubMembers)
        .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)))
        .limit(1);

      if (membership.length === 0) {
        return reply.code(400).send({
          success: false,
          error: { code: 'NOT_MEMBER', message: 'Not a member of this club' },
        });
      }

      if (membership[0].role === 'owner') {
        return reply.code(400).send({
          success: false,
          error: { code: 'OWNER_CANNOT_LEAVE', message: 'Owner cannot leave. Transfer ownership first.' },
        });
      }

      await db.delete(clubMembers).where(eq(clubMembers.id, membership[0].id));

      // Update club stats
      const club = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
      if (club.length > 0) {
        await db.update(clubs)
          .set({
            statistics: {
              ...club[0].statistics,
              activeMembers: Math.max(0, (club[0].statistics as any).activeMembers - 1),
            },
            updatedAt: new Date(),
          })
          .where(eq(clubs.id, clubId));
      }

      return reply.send({
        success: true,
        data: { message: 'Left club successfully' },
      });
    },
  });

  // Manage member (kick, promote, demote)
  fastify.patch('/clubs/:clubId/members/:memberId', {
    preHandler: authenticate,
    schema: {
      params: z.object({
        clubId: z.string().uuid(),
        memberId: z.string().uuid(),
      }),
      body: z.object({
        action: z.enum(['kick', 'promote', 'demote', 'approve', 'reject']),
      }),
    },
    handler: async (request, reply) => {
      const { clubId, memberId } = request.params as { clubId: string; memberId: string };
      const { action } = request.body as { action: string };
      const userId = request.user!.id;

      // Check requester permissions
      const requester = await db.select()
        .from(clubMembers)
        .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)))
        .limit(1);

      if (requester.length === 0) {
        return reply.code(403).send({
          success: false,
          error: { code: 'NOT_MEMBER', message: 'You are not a member of this club' },
        });
      }

      if (!['owner', 'admin'].includes(requester[0].role)) {
        return reply.code(403).send({
          success: false,
          error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only admins can manage members' },
        });
      }

      const target = await db.select()
        .from(clubMembers)
        .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, memberId)))
        .limit(1);

      if (target.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found' },
        });
      }

      const targetMember = target[0];

      // Can't manage owner
      if (targetMember.role === 'owner') {
        return reply.code(403).send({
          success: false,
          error: { code: 'CANNOT_MANAGE_OWNER', message: 'Cannot manage club owner' },
        });
      }

      // Can't promote/demote someone with higher/equal role
      const roleHierarchy = { owner: 3, admin: 2, member: 1, pending: 0 };
      if (roleHierarchy[requester[0].role as keyof typeof roleHierarchy] <= roleHierarchy[targetMember.role as keyof typeof roleHierarchy]) {
        return reply.code(403).send({
          success: false,
          error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Cannot manage member with higher or equal role' },
        });
      }

      switch (action) {
        case 'kick':
          await db.delete(clubMembers).where(eq(clubMembers.id, targetMember.id));
          return reply.send({ success: true, data: { message: 'Member kicked' } });

        case 'promote':
          const newRole = targetMember.role === 'member' ? 'admin' : 'member';
          await db.update(clubMembers)
            .set({ role: newRole })
            .where(eq(clubMembers.id, targetMember.id));
          return reply.send({ success: true, data: { message: `Member promoted to ${newRole}`, role: newRole } });

        case 'demote':
          await db.update(clubMembers)
            .set({ role: 'member' })
            .where(eq(clubMembers.id, targetMember.id));
          return reply.send({ success: true, data: { message: 'Member demoted to member', role: 'member' } });

        case 'approve':
          if (targetMember.role !== 'pending') {
            return reply.code(400).send({ success: false, error: { code: 'INVALID_ACTION', message: 'Member is not pending approval' } });
          }
          await db.update(clubMembers)
            .set({ role: 'member' })
            .where(eq(clubMembers.id, targetMember.id));
          return reply.send({ success: true, data: { message: 'Join request approved', role: 'member' } });

        case 'reject':
          if (targetMember.role !== 'pending') {
            return reply.code(400).send({ success: false, error: { code: 'INVALID_ACTION', message: 'Member is not pending approval' } });
          }
          await db.delete(clubMembers).where(eq(clubMembers.id, targetMember.id));
          return reply.send({ success: true, data: { message: 'Join request rejected' } });

        default:
          return reply.code(400).send({ success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action' } });
      }
    },
  });

  // Create club game
  fastify.post('/clubs/:clubId/games', {
    preHandler: authenticate,
    schema: {
      params: z.object({ clubId: z.string().uuid() }),
      body: z.object({
        gameType: z.nativeEnum(GameType),
        settings: z.object({
          turnTimeLimitHours: z.number().int().min(1).max(168).default(24),
          allowSpectators: z.boolean().default(true),
          allowChat: z.boolean().default(true),
          allowUndo: z.boolean().default(false),
          maxUndos: z.number().int().min(0).max(10).default(3),
          difficulty: z.enum(['easy', 'normal', 'hard', 'custom']).default('normal'),
        }).optional(),
        invitedPlayers: z.array(z.string().uuid()).max(5).optional(),
      }),
    },
    handler: async (request, reply) => {
      const { clubId } = request.params as { clubId: string };
      const { gameType, settings, invitedPlayers } = request.body as any;
      const userId = request.user!.id;

      // Check membership
      const membership = await db.select()
        .from(clubMembers)
        .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)))
        .limit(1);

      if (membership.length === 0) {
        return reply.code(403).send({
          success: false,
          error: { code: 'NOT_MEMBER', message: 'You are not a member of this club' },
        });
      }

      // Get club
      const club = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
      if (club.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: 'CLUB_NOT_FOUND', message: 'Club not found' },
        });
      }

      const gameSettings: GameSettings = {
        turnTimeLimitHours: settings?.turnTimeLimitHours || 24,
        allowSpectators: settings?.allowSpectators ?? true,
        allowChat: settings?.allowChat ?? true,
        allowUndo: settings?.allowUndo ?? false,
        maxUndos: settings?.maxUndos ?? 3,
        difficulty: settings?.difficulty || 'normal',
      };

      const playerIds = [userId, ...(invitedPlayers || [])];
      const game = createAscensionGame(playerIds, gameSettings);
      game.metadata.clubId = clubId;

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

      // Update club stats
      await db.update(clubs)
        .set({
          statistics: {
            ...club[0].statistics,
            totalGames: (club[0].statistics as any).totalGames + 1,
          },
          updatedAt: new Date(),
        })
        .where(eq(clubs.id, clubId));

      if (playerIds.length === 1) {
        const engine = getOrCreateGameEngine(game);
        engine.startCombat('cultist');
      }

      return reply.code(201).send({
        success: true,
        data: { game },
      });
    },
  });

  // Get user's clubs
  fastify.get('/clubs/me', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const memberships = await db.select({
        id: clubMembers.id,
        clubId: clubMembers.clubId,
        role: clubMembers.role,
        joinedAt: clubMembers.joinedAt,
        gamesPlayed: clubMembers.gamesPlayed,
        name: clubs.name,
        description: clubs.description,
        ownerId: clubs.ownerId,
        settings: clubs.settings,
        statistics: clubs.statistics,
        createdAt: clubs.createdAt,
      })
        .from(clubMembers)
        .innerJoin(clubs, eq(clubs.id, clubMembers.clubId))
        .where(eq(clubMembers.userId, request.user!.id))
        .orderBy(desc(clubMembers.joinedAt));

      return reply.send({
        success: true,
        data: { clubs: memberships },
      });
    },
  });
}

import { notifications } from '../db/schema';
import { getOrCreateGameEngine } from '../index';