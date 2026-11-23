/**
 * Database schema using Drizzle ORM with SQLite
 */

import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// USERS
// ============================================================================

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  elo: integer('elo').default(1000).notNull(),
  gamesPlayed: integer('games_played').default(0).notNull(),
  gamesWon: integer('games_won').default(0).notNull(),
  currentStreak: integer('current_streak').default(0).notNull(),
  maxStreak: integer('max_streak').default(0).notNull(),
  totalPlayTime: integer('total_play_time').default(0).notNull(), // minutes
  preferences: text('preferences', { mode: 'json' }).$type<Record<string, unknown>>().default({}).notNull(),
  statistics: text('statistics', { mode: 'json' }).$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
}, (table) => ({
  usernameIdx: uniqueIndex('users_username_idx').on(table.username),
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
  eloIdx: index('users_elo_idx').on(table.elo),
}));

// ============================================================================
// REFRESH TOKENS
// ============================================================================

export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
}, (table) => ({
  userIdIdx: index('refresh_tokens_user_id_idx').on(table.userId),
  tokenIdx: uniqueIndex('refresh_tokens_token_idx').on(table.token),
  expiresAtIdx: index('refresh_tokens_expires_at_idx').on(table.expiresAt),
}));

// ============================================================================
// GAMES
// ============================================================================

export const games = sqliteTable('games', {
  id: text('id').primaryKey(),
  gameType: text('game_type').notNull(),
  status: text('status').notNull(),
  currentPlayerIndex: integer('current_player_index').default(0).notNull(),
  turnNumber: integer('turn_number').default(0).notNull(),
  turnPhase: text('turn_phase').notNull(),
  turnStartTime: integer('turn_start_time', { mode: 'timestamp' }).notNull(),
  turnTimeLimit: integer('turn_time_limit').notNull(), // milliseconds
  maxPlayers: integer('max_players').notNull(),
  seed: text('seed').notNull(),
  rngState: text('rng_state').notNull(),
  enemiesDefeated: integer('enemies_defeated').default(0).notNull(),
  floor: integer('floor').default(0).notNull(),
  act: integer('act').default(0).notNull(),
  ascensionLevel: integer('ascension_level').default(0).notNull(),
  modifiers: text('modifiers', { mode: 'json' }).$type<unknown[]>().default([]).notNull(),
  log: text('log', { mode: 'json' }).$type<unknown[]>().default([]).notNull(),
  winnerId: text('winner_id').references(() => users.id),
  endReason: text('end_reason'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  finishedAt: integer('finished_at', { mode: 'timestamp' }),
}, (table) => ({
  statusIdx: index('games_status_idx').on(table.status),
  gameTypeIdx: index('games_game_type_idx').on(table.gameType),
  createdAtIdx: index('games_created_at_idx').on(table.createdAt),
  winnerIdIdx: index('games_winner_id_idx').on(table.winnerId),
}));

// ============================================================================
// GAME PLAYERS
// ============================================================================

export const gamePlayers = sqliteTable('game_players', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  seatIndex: integer('seat_index').notNull(),
  status: text('status').notNull(),
  health: integer('health').notNull(),
  maxHealth: integer('max_health').notNull(),
  block: integer('block').default(0).notNull(),
  energy: integer('energy').notNull(),
  maxEnergy: integer('max_energy').notNull(),
  gold: integer('gold').default(0).notNull(),
  deck: text('deck', { mode: 'json' }).$type<unknown[]>().default([]).notNull(),
  hand: text('hand', { mode: 'json' }).$type<unknown[]>().default([]).notNull(),
  discardPile: text('discard_pile', { mode: 'json' }).$type<unknown[]>().default([]).notNull(),
  exhaustPile: text('exhaust_pile', { mode: 'json' }).$type<unknown[]>().default([]).notNull(),
  relics: text('relics', { mode: 'json' }).$type<unknown[]>().default([]).notNull(),
  potions: text('potions', { mode: 'json' }).$type<unknown[]>().default([]).notNull(),
  buffs: text('buffs', { mode: 'json' }).$type<unknown[]>().default([]).notNull(),
  turnNumber: integer('turn_number').default(0).notNull(),
  totalDamageDealt: integer('total_damage_dealt').default(0).notNull(),
  totalDamageTaken: integer('total_damage_taken').default(0).notNull(),
  totalBlockGained: integer('total_block_gained').default(0).notNull(),
  totalCardsPlayed: integer('total_cards_played').default(0).notNull(),
  totalGoldGained: integer('total_gold_gained').default(0).notNull(),
  connected: integer('connected', { mode: 'boolean' }).default(true).notNull(),
  lastActionAt: integer('last_action_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  gameIdIdx: index('game_players_game_id_idx').on(table.gameId),
  userIdIdx: index('game_players_user_id_idx').on(table.userId),
  gameUserIdx: uniqueIndex('game_players_game_user_idx').on(table.gameId, table.userId),
}));

// ============================================================================
// CURRENT ENEMY (for active combats)
// ============================================================================

export const currentEnemies = sqliteTable('current_enemies', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().unique().references(() => games.id, { onDelete: 'cascade' }),
  enemyId: text('enemy_id').notNull(),
  currentHp: integer('current_hp').notNull(),
  maxHp: integer('max_hp').notNull(),
  block: integer('block').default(0).notNull(),
  buffs: text('buffs', { mode: 'json' }).$type<unknown[]>().default([]).notNull(),
  intent: text('intent', { mode: 'json' }).$type<unknown>().notNull(),
  intentIndex: integer('intent_index').default(0).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
});

// ============================================================================
// MATCHMAKING QUEUES
// ============================================================================

export const matchmakingQueues = sqliteTable('matchmaking_queues', {
  id: text('id').primaryKey(),
  gameType: text('game_type').notNull(),
  status: text('status').notNull(),
  players: text('players', { mode: 'json' }).$type<unknown[]>().default([]).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  matchedAt: integer('matched_at', { mode: 'timestamp' }),
  gameId: text('game_id').references(() => games.id),
}, (table) => ({
  statusIdx: index('matchmaking_queues_status_idx').on(table.status),
  gameTypeIdx: index('matchmaking_queues_game_type_idx').on(table.gameType),
}));

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  data: text('data', { mode: 'json' }).$type<Record<string, unknown>>(),
  read: integer('read', { mode: 'boolean' }).default(false).notNull(),
  actionUrl: text('action_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  userIdIdx: index('notifications_user_id_idx').on(table.userId),
  readIdx: index('notifications_read_idx').on(table.read),
  createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
}));

// ============================================================================
// CLUBS
// ============================================================================

export const clubs = sqliteTable('clubs', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  ownerId: text('owner_id').notNull().references(() => users.id),
  settings: text('settings', { mode: 'json' }).$type<Record<string, unknown>>().default({}).notNull(),
  statistics: text('statistics', { mode: 'json' }).$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  nameIdx: uniqueIndex('clubs_name_idx').on(table.name),
  ownerIdIdx: index('clubs_owner_id_idx').on(table.ownerId),
}));

export const clubMembers = sqliteTable('club_members', {
  id: text('id').primaryKey(),
  clubId: text('club_id').notNull().references(() => clubs.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  gamesPlayed: integer('games_played').default(0).notNull(),
}, (table) => ({
  clubIdIdx: index('club_members_club_id_idx').on(table.clubId),
  userIdIdx: index('club_members_user_id_idx').on(table.userId),
  clubUserIdx: uniqueIndex('club_members_club_user_idx').on(table.clubId, table.userId),
}));

// ============================================================================
// TOURNAMENTS
// ============================================================================

export const tournaments = sqliteTable('tournaments', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  gameType: text('game_type').notNull(),
  status: text('status').notNull(),
  format: text('format', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  schedule: text('schedule', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  prizes: text('prizes', { mode: 'json' }).$type<unknown[]>().default([]).notNull(),
  settings: text('settings', { mode: 'json' }).$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  statusIdx: index('tournaments_status_idx').on(table.status),
  gameTypeIdx: index('tournaments_game_type_idx').on(table.gameType),
}));

export const tournamentParticipants = sqliteTable('tournament_participants', {
  id: text('id').primaryKey(),
  tournamentId: text('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  seed: integer('seed').default(0).notNull(),
  status: text('status').notNull(),
  currentRound: integer('current_round').default(0).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  tournamentIdIdx: index('tournament_participants_tournament_id_idx').on(table.tournamentId),
  userIdIdx: index('tournament_participants_user_id_idx').on(table.userId),
  tournamentUserIdx: uniqueIndex('tournament_participants_tournament_user_idx').on(table.tournamentId, table.userId),
}));

export const tournamentBrackets = sqliteTable('tournament_brackets', {
  id: text('id').primaryKey(),
  tournamentId: text('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  round: integer('round').notNull(),
  matches: text('matches', { mode: 'json' }).$type<unknown[]>().default([]).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  tournamentIdIdx: index('tournament_brackets_tournament_id_idx').on(table.tournamentId),
}));

// ============================================================================
// DAILY RUNS
// ============================================================================

export const dailyRuns = sqliteTable('daily_runs', {
  id: text('id').primaryKey(),
  date: text('date').notNull().unique(), // YYYY-MM-DD
  gameType: text('game_type').notNull(),
  seed: text('seed').notNull(),
  modifiers: text('modifiers', { mode: 'json' }).$type<unknown[]>().default([]).notNull(),
  leaderboard: text('leaderboard', { mode: 'json' }).$type<unknown[]>().default([]).notNull(),
  totalParticipants: integer('total_participants').default(0).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  dateIdx: uniqueIndex('daily_runs_date_idx').on(table.date),
  gameTypeIdx: index('daily_runs_game_type_idx').on(table.gameType),
}));

// ============================================================================
// LEADERBOARDS
// ============================================================================

export const leaderboards = sqliteTable('leaderboards', {
  id: text('id').primaryKey(),
  gameType: text('game_type').notNull(),
  period: text('period').notNull(),
  periodStart: integer('period_start', { mode: 'timestamp' }).notNull(),
  periodEnd: integer('period_end', { mode: 'timestamp' }).notNull(),
  entries: text('entries', { mode: 'json' }).$type<unknown[]>().default([]).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  gameTypePeriodIdx: uniqueIndex('leaderboards_game_type_period_idx').on(table.gameType, table.period, table.periodStart),
}));

// ============================================================================
// REPLAYS
// ============================================================================

export const replays = sqliteTable('replays', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().unique().references(() => games.id, { onDelete: 'cascade' }),
  gameType: text('game_type').notNull(),
  players: text('players', { mode: 'json' }).$type<unknown[]>().notNull(),
  actions: text('actions', { mode: 'json' }).$type<unknown[]>().notNull(),
  seed: text('seed').notNull(),
  winnerId: text('winner_id').notNull().references(() => users.id),
  duration: integer('duration').notNull(),
  turnCount: integer('turn_count').notNull(),
  version: text('version').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  gameTypeIdx: index('replays_game_type_idx').on(table.gameType),
  winnerIdIdx: index('replays_winner_id_idx').on(table.winnerId),
  createdAtIdx: index('replays_created_at_idx').on(table.createdAt),
}));

// ============================================================================
// ACHIEVEMENTS
// ============================================================================

export const achievements = sqliteTable('achievements', {
  id: text('id').primaryKey(),
  gameType: text('game_type').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(),
  rarity: text('rarity').notNull(),
  criteria: text('criteria', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  reward: text('reward', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  gameTypeIdx: index('achievements_game_type_idx').on(table.gameType),
}));

export const userAchievements = sqliteTable('user_achievements', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  achievementId: text('achievement_id').notNull().references(() => achievements.id, { onDelete: 'cascade' }),
  unlockedAt: integer('unlocked_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  progress: real('progress').default(0).notNull(),
  completed: integer('completed', { mode: 'boolean' }).default(false).notNull(),
}, (table) => ({
  userIdIdx: index('user_achievements_user_id_idx').on(table.userId),
  achievementIdIdx: index('user_achievements_achievement_id_idx').on(table.achievementId),
  userAchievementIdx: uniqueIndex('user_achievements_user_achievement_idx').on(table.userId, table.achievementId),
}));

// ============================================================================
// FRIENDS
// ============================================================================

export const friends = sqliteTable('friends', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  friendId: text('friend_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull(), // 'pending', 'accepted', 'blocked'
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  userIdIdx: index('friends_user_id_idx').on(table.userId),
  friendIdIdx: index('friends_friend_id_idx').on(table.friendId),
  userFriendIdx: uniqueIndex('friends_user_friend_idx').on(table.userId, table.friendId),
}));

// ============================================================================
// CHAT MESSAGES
// ============================================================================

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  gameIdIdx: index('chat_messages_game_id_idx').on(table.gameId),
  createdAtIdx: index('chat_messages_created_at_idx').on(table.createdAt),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type GamePlayer = typeof gamePlayers.$inferSelect;
export type NewGamePlayer = typeof gamePlayers.$inferInsert;
export type CurrentEnemy = typeof currentEnemies.$inferSelect;
export type NewCurrentEnemy = typeof currentEnemies.$inferInsert;
export type MatchmakingQueue = typeof matchmakingQueues.$inferSelect;
export type NewMatchmakingQueue = typeof matchmakingQueues.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type Club = typeof clubs.$inferSelect;
export type NewClub = typeof clubs.$inferInsert;
export type ClubMember = typeof clubMembers.$inferSelect;
export type NewClubMember = typeof clubMembers.$inferInsert;
export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;
export type TournamentParticipant = typeof tournamentParticipants.$inferSelect;
export type NewTournamentParticipant = typeof tournamentParticipants.$inferInsert;
export type TournamentBracket = typeof tournamentBrackets.$inferSelect;
export type NewTournamentBracket = typeof tournamentBrackets.$inferInsert;
export type DailyRun = typeof dailyRuns.$inferSelect;
export type NewDailyRun = typeof dailyRuns.$inferInsert;
export type Leaderboard = typeof leaderboards.$inferSelect;
export type NewLeaderboard = typeof leaderboards.$inferInsert;
export type Replay = typeof replays.$inferSelect;
export type NewReplay = typeof replays.$inferInsert;
export type Achievement = typeof achievements.$inferSelect;
export type NewAchievement = typeof achievements.$inferInsert;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type NewUserAchievement = typeof userAchievements.$inferInsert;
export type Friend = typeof friends.$inferSelect;
export type NewFriend = typeof friends.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;