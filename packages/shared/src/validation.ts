/**
 * Zod validation schemas for the async card game
 */

import { z } from 'zod';
import {
  GameType,
  GameStatus,
  PlayerStatus,
  TurnPhase,
  CardType,
  CardRarity,
  TargetType,
  EffectType,
  BuffType,
  ActionType,
  NotificationType,
  WSMessageType,
  GameEndReason,
} from './enums';

// Base schemas
export const uuidSchema = z.string().uuid();
export const isoDateSchema = z.string().datetime();
export const positiveIntSchema = z.number().int().positive();
export const nonNegativeIntSchema = z.number().int().nonnegative();

// Enums
export const gameTypeSchema = z.nativeEnum(GameType);
export const gameStatusSchema = z.nativeEnum(GameStatus);
export const playerStatusSchema = z.nativeEnum(PlayerStatus);
export const turnPhaseSchema = z.nativeEnum(TurnPhase);
export const cardTypeSchema = z.nativeEnum(CardType);
export const cardRaritySchema = z.nativeEnum(CardRarity);
export const targetTypeSchema = z.nativeEnum(TargetType);
export const effectTypeSchema = z.nativeEnum(EffectType);
export const buffTypeSchema = z.nativeEnum(BuffType);
export const actionTypeSchema = z.nativeEnum(ActionType);
export const notificationTypeSchema = z.nativeEnum(NotificationType);
export const wsMessageTypeSchema = z.nativeEnum(WSMessageType);
export const gameEndReasonSchema = z.nativeEnum(GameEndReason);

// User Preferences
export const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  notifications: z.object({
    email: z.boolean().default(true),
    push: z.boolean().default(true),
    inGame: z.boolean().default(true),
  }).default({ email: true, push: true, inGame: true }),
  turnReminderHours: z.number().int().min(1).max(168).default(24), // 1 hour to 1 week
  autoEndTurn: z.boolean().default(false),
  showCardHints: z.boolean().default(true),
  animationsEnabled: z.boolean().default(true),
  soundEnabled: z.boolean().default(true),
  language: z.string().default('en'),
});

// User Statistics
export const gameTypeStatsSchema = z.object({
  gamesPlayed: nonNegativeIntSchema.default(0),
  gamesWon: nonNegativeIntSchema.default(0),
  winRate: z.number().min(0).max(1).default(0),
  averageTurns: z.number().nonnegative().default(0),
  favoriteArchetype: z.string().optional(),
});

export const userStatisticsSchema = z.object({
  byGameType: z.record(gameTypeSchema, gameTypeStatsSchema).default({}),
  favoriteCards: z.array(z.string()).default([]),
  longestGame: nonNegativeIntSchema.default(0),
  shortestGame: nonNegativeIntSchema.default(0),
  averageGameLength: z.number().nonnegative().default(0),
});

// Card Effect
export const cardEffectSchema = z.object({
  type: effectTypeSchema,
  value: z.number(),
  targetType: targetTypeSchema.optional(),
  condition: z.string().optional(),
  buffType: buffTypeSchema.optional(),
  buffDuration: z.number().int().optional(),
  buffStacks: z.number().int().optional(),
});

// Card Upgrade
export const cardUpgradeSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  effects: z.array(cardEffectSchema),
  costChange: z.number().int().optional(),
});

// Card (static definition)
export const cardSchema = z.object({
  id: uuidSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  gameType: gameTypeSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  type: cardTypeSchema,
  rarity: cardRaritySchema,
  cost: z.number().int().min(0).max(10),
  targetType: targetTypeSchema,
  effects: z.array(cardEffectSchema).min(1),
  upgrades: z.array(cardUpgradeSchema).max(2).optional(),
  artwork: z.string().url().optional(),
  flavorText: z.string().max(300).optional(),
  tags: z.array(z.string()).default([]),
});

// Card Instance (runtime)
export const cardInstanceSchema = z.object({
  id: uuidSchema,
  cardId: uuidSchema,
  upgrades: z.number().int().min(0).max(2).default(0),
  exhausted: z.boolean().default(false),
  modifiedCost: z.number().int().optional(),
  temporaryEffects: z.array(cardEffectSchema).optional(),
});

// Relic Effect
export const relicTriggerSchema = z.enum([
  'on_turn_start', 'on_turn_end', 'on_card_played', 'on_card_drawn',
  'on_damage_taken', 'on_damage_dealt', 'on_enemy_defeated',
  'on_combat_start', 'on_combat_end', 'on_heal', 'on_block_gained',
  'on_energy_gained', 'on_shuffle', 'on_exhaust', 'on_upgrade', 'on_potion_used'
]);

export const relicEffectSchema = z.object({
  trigger: relicTriggerSchema,
  effects: z.array(cardEffectSchema),
  condition: z.string().optional(),
});

// Relic
export const relicSchema = z.object({
  id: uuidSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  gameType: gameTypeSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  rarity: cardRaritySchema,
  effects: z.array(relicEffectSchema),
  artwork: z.string().url().optional(),
  flavorText: z.string().max(300).optional(),
});

// Relic Instance
export const relicInstanceSchema = z.object({
  relicId: uuidSchema,
  counter: z.number().int().optional(),
  active: z.boolean().default(true),
});

// Potion
export const potionSchema = z.object({
  id: uuidSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  gameType: gameTypeSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  rarity: cardRaritySchema,
  effects: z.array(cardEffectSchema),
  maxCharges: z.number().int().positive(),
  artwork: z.string().url().optional(),
});

// Potion Instance
export const potionInstanceSchema = z.object({
  potionId: uuidSchema,
  charges: z.number().int().positive(),
});

// Buff Instance
export const buffInstanceSchema = z.object({
  type: buffTypeSchema,
  stacks: z.number().int().positive(),
  duration: z.number().int(), // -1 for permanent
  source: z.string().optional(),
});

// Enemy Intent
export const enemyIntentSchema = z.object({
  type: z.enum(['attack', 'buff', 'debuff', 'special']),
  value: z.number().int(),
  description: z.string(),
  probability: z.number().min(0).max(1),
});

// Enemy Rewards
export const enemyRewardsSchema = z.object({
  gold: z.object({
    min: nonNegativeIntSchema,
    max: nonNegativeIntSchema,
  }),
  cards: z.object({
    count: z.number().int().nonnegative(),
    rarityWeights: z.record(cardRaritySchema, z.number().nonnegative()),
  }),
  relics: z.object({
    probability: z.number().min(0).max(1),
  }).optional(),
  potions: z.object({
    probability: z.number().min(0).max(1),
  }).optional(),
});

// Enemy
export const enemySchema = z.object({
  id: uuidSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  gameType: gameTypeSchema,
  name: z.string().min(1).max(100),
  maxHp: positiveIntSchema,
  artwork: z.string().url().optional(),
  intentPattern: z.array(enemyIntentSchema).min(1),
  rewards: enemyRewardsSchema,
  tags: z.array(z.string()).default([]),
});

// Enemy Instance
export const enemyInstanceSchema = z.object({
  enemyId: uuidSchema,
  currentHp: z.number().int().nonnegative(),
  maxHp: positiveIntSchema,
  block: z.number().int().nonnegative().default(0),
  buffs: z.array(buffInstanceSchema).default([]),
  intent: enemyIntentSchema,
  intentIndex: z.number().int().nonnegative(),
});

// Game Modifier
export const gameModifierSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  effects: z.array(cardEffectSchema),
});

// Game Log Entry
export const gameLogEntrySchema = z.object({
  id: uuidSchema,
  turnNumber: nonNegativeIntSchema,
  playerIndex: nonNegativeIntSchema,
  action: actionTypeSchema,
  details: z.string(),
  timestamp: isoDateSchema,
  data: z.record(z.unknown()).optional(),
});

// Game Settings
export const gameSettingsSchema = z.object({
  turnTimeLimitHours: z.number().int().min(1).max(168).default(24),
  allowSpectators: z.boolean().default(true),
  allowChat: z.boolean().default(true),
  allowUndo: z.boolean().default(false),
  maxUndos: z.number().int().min(0).max(10).default(3),
  difficulty: z.enum(['easy', 'normal', 'hard', 'custom']).default('normal'),
  customSettings: z.record(z.unknown()).optional(),
});

// Game Metadata
export const gameMetadataSchema = z.object({
  name: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  isRanked: z.boolean().default(false),
  isPrivate: z.boolean().default(false),
  inviteCode: z.string().optional(),
  clubId: uuidSchema.optional(),
  tournamentId: uuidSchema.optional(),
  settings: gameSettingsSchema,
});

// Game Player
export const gamePlayerSchema = z.object({
  id: uuidSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  gameId: uuidSchema,
  userId: uuidSchema,
  seatIndex: nonNegativeIntSchema,
  status: playerStatusSchema,
  health: z.number().int().nonnegative(),
  maxHealth: positiveIntSchema,
  block: z.number().int().nonnegative().default(0),
  energy: z.number().int().nonnegative(),
  maxEnergy: z.number().int().positive().default(3),
  gold: z.number().int().nonnegative().default(0),
  deck: z.array(cardInstanceSchema).default([]),
  hand: z.array(cardInstanceSchema).default([]),
  discardPile: z.array(cardInstanceSchema).default([]),
  exhaustPile: z.array(cardInstanceSchema).default([]),
  relics: z.array(relicInstanceSchema).default([]),
  potions: z.array(potionInstanceSchema).default([]),
  buffs: z.array(buffInstanceSchema).default([]),
  turnNumber: nonNegativeIntSchema.default(0),
  totalDamageDealt: nonNegativeIntSchema.default(0),
  totalDamageTaken: nonNegativeIntSchema.default(0),
  totalBlockGained: nonNegativeIntSchema.default(0),
  totalCardsPlayed: nonNegativeIntSchema.default(0),
  totalGoldGained: nonNegativeIntSchema.default(0),
  connected: z.boolean().default(true),
  lastActionAt: isoDateSchema.optional(),
});

// Game
export const gameSchema = z.object({
  id: uuidSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  gameType: gameTypeSchema,
  status: gameStatusSchema,
  currentPlayerIndex: nonNegativeIntSchema,
  turnNumber: nonNegativeIntSchema,
  turnPhase: turnPhaseSchema,
  turnStartTime: isoDateSchema,
  turnTimeLimit: positiveIntSchema,
  players: z.array(gamePlayerSchema).min(1).max(6),
  maxPlayers: z.number().int().min(1).max(6),
  seed: z.string(),
  rngState: z.string(),
  currentEnemy: enemyInstanceSchema.optional(),
  enemiesDefeated: nonNegativeIntSchema.default(0),
  floor: nonNegativeIntSchema.default(0),
  act: nonNegativeIntSchema.default(0),
  ascensionLevel: nonNegativeIntSchema.default(0),
  modifiers: z.array(gameModifierSchema).default([]),
  log: z.array(gameLogEntrySchema).default([]),
  winner: uuidSchema.optional(),
  endReason: gameEndReasonSchema.optional(),
  metadata: gameMetadataSchema,
});

// Player Actions
export const playCardActionSchema = z.object({
  cardInstanceId: uuidSchema,
  targetId: uuidSchema.optional(),
  targetIndex: z.number().int().nonnegative().optional(),
  autoTarget: z.boolean().default(true),
});

export const endTurnActionSchema = z.object({});

export const usePotionActionSchema = z.object({
  potionInstanceId: uuidSchema,
  targetId: uuidSchema.optional(),
});

export const choiceActionSchema = z.object({
  choiceId: z.string(),
  selectedOption: z.number().int().nonnegative(),
});

export const playerActionDataSchema = z.union([
  playCardActionSchema,
  endTurnActionSchema,
  usePotionActionSchema,
  choiceActionSchema,
]);

export const playerActionSchema = z.object({
  type: actionTypeSchema,
  playerId: uuidSchema,
  gameId: uuidSchema,
  timestamp: isoDateSchema,
  data: playerActionDataSchema,
});

// Matchmaking
export const queuePreferencesSchema = z.object({
  minPlayers: z.number().int().min(1).max(6).default(2),
  maxPlayers: z.number().int().min(2).max(6).default(4),
  turnTimeLimitHours: z.number().int().min(1).max(168).default(24),
  ranked: z.boolean().default(false),
});

export const queuePlayerSchema = z.object({
  userId: uuidSchema,
  elo: z.number().int(),
  joinedAt: isoDateSchema,
  preferences: queuePreferencesSchema,
});

export const matchmakingQueueSchema = z.object({
  id: uuidSchema,
  gameType: gameTypeSchema,
  status: z.enum(['waiting', 'matched', 'cancelled']),
  players: z.array(queuePlayerSchema),
  createdAt: isoDateSchema,
  matchedAt: isoDateSchema.optional(),
  gameId: uuidSchema.optional(),
});

// WebSocket Messages
export const wsConnectPayloadSchema = z.object({
  userId: uuidSchema,
  token: z.string(),
});

export const wsJoinGamePayloadSchema = z.object({
  gameId: uuidSchema,
});

export const wsLeaveGamePayloadSchema = z.object({
  gameId: uuidSchema,
});

export const wsGameStatePayloadSchema = z.object({
  game: gameSchema,
  yourPlayerIndex: nonNegativeIntSchema,
});

export const wsPlayerActionPayloadSchema = z.object({
  action: playerActionSchema,
});

export const wsTurnChangePayloadSchema = z.object({
  currentPlayerIndex: nonNegativeIntSchema,
  turnNumber: nonNegativeIntSchema,
  phase: turnPhaseSchema,
  timeRemaining: positiveIntSchema,
});

export const wsGameUpdatePayloadSchema = z.object({
  updates: gameSchema.partial(),
  playerIndex: nonNegativeIntSchema,
});

export const wsChatPayloadSchema = z.object({
  gameId: uuidSchema,
  message: z.string().min(1).max(500),
});

export const wsErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

// API Types
export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  field: z.string().optional(),
});

export const responseMetaSchema = z.object({
  timestamp: isoDateSchema,
  requestId: uuidSchema,
  version: z.string(),
});

export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: apiErrorSchema.optional(),
    meta: responseMetaSchema.optional(),
  });

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  apiResponseSchema(z.array(dataSchema)).extend({
    meta: responseMetaSchema.extend({
      pagination: z.object({
        page: positiveIntSchema,
        limit: positiveIntSchema,
        total: nonNegativeIntSchema,
        totalPages: nonNegativeIntSchema,
      }),
    }),
  });

// Auth
export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: positiveIntSchema,
});

export const jwtPayloadSchema = z.object({
  userId: uuidSchema,
  username: z.string(),
  iat: z.number().int(),
  exp: z.number().int(),
});

export const registerRequestSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(50),
});

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string(),
});

// Game Creation
export const createGameRequestSchema = z.object({
  gameType: gameTypeSchema,
  settings: gameSettingsSchema,
  invitedPlayers: z.array(uuidSchema).max(5).optional(),
  isPrivate: z.boolean().default(false),
  clubId: uuidSchema.optional(),
  tournamentId: uuidSchema.optional(),
});

export const joinGameRequestSchema = z.object({
  gameId: uuidSchema,
  inviteCode: z.string().optional(),
});

// Notification
export const notificationSchema = z.object({
  id: uuidSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  userId: uuidSchema,
  type: notificationTypeSchema,
  title: z.string().max(100),
  message: z.string().max(500),
  data: z.record(z.unknown()).optional(),
  read: z.boolean().default(false),
  actionUrl: z.string().url().optional(),
});

// Club
export const clubMemberSchema = z.object({
  userId: uuidSchema,
  role: z.enum(['owner', 'admin', 'member']),
  joinedAt: isoDateSchema,
  gamesPlayed: nonNegativeIntSchema.default(0),
});

export const clubSettingsSchema = z.object({
  isPublic: z.boolean().default(true),
  requireApproval: z.boolean().default(false),
  defaultGameSettings: gameSettingsSchema,
});

export const clubStatisticsSchema = z.object({
  totalGames: nonNegativeIntSchema.default(0),
  activeMembers: nonNegativeIntSchema.default(0),
  topPlayers: z.array(uuidSchema).default([]),
});

export const clubSchema = z.object({
  id: uuidSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  name: z.string().min(1).max(50),
  description: z.string().max(500),
  ownerId: uuidSchema,
  members: z.array(clubMemberSchema),
  settings: clubSettingsSchema,
  statistics: clubStatisticsSchema,
});

// Tournament
export const tournamentFormatSchema = z.object({
  type: z.enum(['single_elimination', 'double_elimination', 'swiss', 'round_robin']),
  maxParticipants: positiveIntSchema,
  minParticipants: positiveIntSchema,
  bestOf: z.number().int().min(1).max(7).default(1),
});

export const tournamentScheduleSchema = z.object({
  registrationStart: isoDateSchema,
  registrationEnd: isoDateSchema,
  startDate: isoDateSchema,
  endDate: isoDateSchema.optional(),
  timezone: z.string().default('UTC'),
});

export const tournamentPrizeSchema = z.object({
  rank: positiveIntSchema,
  reward: z.string(),
  value: z.number().nonnegative().optional(),
});

export const tournamentParticipantSchema = z.object({
  userId: uuidSchema,
  seed: nonNegativeIntSchema,
  status: z.enum(['registered', 'checked_in', 'playing', 'eliminated', 'winner']),
  currentRound: nonNegativeIntSchema.default(0),
});

export const tournamentMatchSchema = z.object({
  id: uuidSchema,
  player1Id: uuidSchema,
  player2Id: uuidSchema,
  gameId: uuidSchema.optional(),
  winnerId: uuidSchema.optional(),
  status: z.enum(['pending', 'active', 'completed']),
  scheduledAt: isoDateSchema.optional(),
});

export const tournamentBracketSchema = z.object({
  round: positiveIntSchema,
  matches: z.array(tournamentMatchSchema),
});

export const tournamentSettingsSchema = z.object({
  turnTimeLimitHours: z.number().int().min(1).max(168).default(24),
  allowSpectators: z.boolean().default(true),
  requireCheckIn: z.boolean().default(true),
  checkInWindowMinutes: z.number().int().min(5).max(120).default(30),
});

export const tournamentSchema = z.object({
  id: uuidSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  gameType: gameTypeSchema,
  status: z.enum(['upcoming', 'registration', 'active', 'completed', 'cancelled']),
  format: tournamentFormatSchema,
  schedule: tournamentScheduleSchema,
  prizes: z.array(tournamentPrizeSchema),
  participants: z.array(tournamentParticipantSchema),
  brackets: z.array(tournamentBracketSchema),
  settings: tournamentSettingsSchema,
});

// Daily Run
export const dailyRunEntrySchema = z.object({
  userId: uuidSchema,
  score: z.number().int(),
  turns: nonNegativeIntSchema,
  timeElapsed: nonNegativeIntSchema,
  completed: z.boolean(),
  defeatedEnemies: nonNegativeIntSchema,
  floorReached: nonNegativeIntSchema,
  damageTaken: nonNegativeIntSchema,
  deck: z.array(uuidSchema),
  relics: z.array(uuidSchema),
  submittedAt: isoDateSchema,
});

export const dailyRunSchema = z.object({
  id: uuidSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gameType: gameTypeSchema,
  seed: z.string(),
  modifiers: z.array(gameModifierSchema),
  leaderboard: z.array(dailyRunEntrySchema),
  totalParticipants: nonNegativeIntSchema.default(0),
});

// Leaderboard
export const leaderboardEntrySchema = z.object({
  rank: positiveIntSchema,
  userId: uuidSchema,
  username: z.string(),
  displayName: z.string(),
  score: z.number().int(),
  gamesPlayed: nonNegativeIntSchema,
  winRate: z.number().min(0).max(1),
  avatarUrl: z.string().url().optional(),
});

export const leaderboardSchema = z.object({
  id: uuidSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  gameType: gameTypeSchema,
  period: z.enum(['daily', 'weekly', 'monthly', 'seasonal', 'all_time']),
  periodStart: isoDateSchema,
  periodEnd: isoDateSchema,
  entries: z.array(leaderboardEntrySchema),
});

// Replay
export const replayPlayerSchema = z.object({
  userId: uuidSchema,
  seatIndex: nonNegativeIntSchema,
  finalHealth: z.number().int(),
  totalDamageDealt: nonNegativeIntSchema,
  totalCardsPlayed: nonNegativeIntSchema,
});

export const replaySchema = z.object({
  id: uuidSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  gameId: uuidSchema,
  gameType: gameTypeSchema,
  players: z.array(replayPlayerSchema),
  actions: z.array(playerActionSchema),
  seed: z.string(),
  winner: uuidSchema,
  duration: nonNegativeIntSchema,
  turnCount: nonNegativeIntSchema,
  version: z.string(),
});

// Achievement
export const achievementCriteriaSchema = z.object({
  type: z.enum(['games_won', 'games_played', 'enemies_defeated', 'cards_played', 'damage_dealt', 'custom']),
  target: positiveIntSchema,
  customCondition: z.string().optional(),
});

export const achievementRewardSchema = z.object({
  type: z.enum(['cosmetic', 'currency', 'title', 'badge']),
  value: z.string(),
  amount: z.number().int().optional(),
});

export const achievementSchema = z.object({
  id: uuidSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  gameType: gameTypeSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  icon: z.string(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'legendary']),
  criteria: achievementCriteriaSchema,
  reward: achievementRewardSchema.optional(),
});

export const userAchievementSchema = z.object({
  userId: uuidSchema,
  achievementId: uuidSchema,
  unlockedAt: isoDateSchema,
  progress: z.number().min(0).max(1).default(0),
  completed: z.boolean().default(false),
});

// Type exports
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type UserStatistics = z.infer<typeof userStatisticsSchema>;
export type Card = z.infer<typeof cardSchema>;
export type CardInstance = z.infer<typeof cardInstanceSchema>;
export type Relic = z.infer<typeof relicSchema>;
export type RelicInstance = z.infer<typeof relicInstanceSchema>;
export type Potion = z.infer<typeof potionSchema>;
export type PotionInstance = z.infer<typeof potionInstanceSchema>;
export type BuffInstance = z.infer<typeof buffInstanceSchema>;
export type Enemy = z.infer<typeof enemySchema>;
export type EnemyInstance = z.infer<typeof enemyInstanceSchema>;
export type GameModifier = z.infer<typeof gameModifierSchema>;
export type GameLogEntry = z.infer<typeof gameLogEntrySchema>;
export type GameSettings = z.infer<typeof gameSettingsSchema>;
export type GameMetadata = z.infer<typeof gameMetadataSchema>;
export type GamePlayer = z.infer<typeof gamePlayerSchema>;
export type Game = z.infer<typeof gameSchema>;
export type PlayerAction = z.infer<typeof playerActionSchema>;
export type PlayCardAction = z.infer<typeof playCardActionSchema>;
export type EndTurnAction = z.infer<typeof endTurnActionSchema>;
export type UsePotionAction = z.infer<typeof usePotionActionSchema>;
export type ChoiceAction = z.infer<typeof choiceActionSchema>;
export type MatchmakingQueue = z.infer<typeof matchmakingQueueSchema>;
export type QueuePlayer = z.infer<typeof queuePlayerSchema>;
export type QueuePreferences = z.infer<typeof queuePreferencesSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type Club = z.infer<typeof clubSchema>;
export type ClubMember = z.infer<typeof clubMemberSchema>;
export type ClubSettings = z.infer<typeof clubSettingsSchema>;
export type ClubStatistics = z.infer<typeof clubStatisticsSchema>;
export type Tournament = z.infer<typeof tournamentSchema>;
export type TournamentFormat = z.infer<typeof tournamentFormatSchema>;
export type TournamentSchedule = z.infer<typeof tournamentScheduleSchema>;
export type TournamentPrize = z.infer<typeof tournamentPrizeSchema>;
export type TournamentParticipant = z.infer<typeof tournamentParticipantSchema>;
export type TournamentMatch = z.infer<typeof tournamentMatchSchema>;
export type TournamentBracket = z.infer<typeof tournamentBracketSchema>;
export type TournamentSettings = z.infer<typeof tournamentSettingsSchema>;
export type DailyRun = z.infer<typeof dailyRunSchema>;
export type DailyRunEntry = z.infer<typeof dailyRunEntrySchema>;
export type Leaderboard = z.infer<typeof leaderboardSchema>;
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
export type Replay = z.infer<typeof replaySchema>;
export type ReplayPlayer = z.infer<typeof replayPlayerSchema>;
export type Achievement = z.infer<typeof achievementSchema>;
export type UserAchievement = z.infer<typeof userAchievementSchema>;