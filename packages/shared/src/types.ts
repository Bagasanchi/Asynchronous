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
} from './enums';

/**
 * Base entity with ID and timestamps
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User account
 */
export interface User extends BaseEntity {
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
  avatarUrl?: string;
  elo: number;
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  totalPlayTime: number; // in minutes
  preferences: UserPreferences;
  statistics: UserStatistics;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    push: boolean;
    inGame: boolean;
  };
  turnReminderHours: number; // hours before turn expires
  autoEndTurn: boolean;
  showCardHints: boolean;
  animationsEnabled: boolean;
  soundEnabled: boolean;
  language: string;
}

export interface UserStatistics {
  byGameType: Record<GameType, GameTypeStats>;
  favoriteCards: string[]; // card IDs
  longestGame: number; // in turns
  shortestGame: number; // in turns
  averageGameLength: number; // in turns
}

export interface GameTypeStats {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  averageTurns: number;
  favoriteArchetype?: string;
}

/**
 * Card definition (static data)
 */
export interface Card extends BaseEntity {
  gameType: GameType;
  name: string;
  description: string;
  type: CardType;
  rarity: CardRarity;
  cost: number; // energy cost
  targetType: TargetType;
  effects: CardEffect[];
  upgrades?: CardUpgrade[];
  artwork?: string; // URL to artwork
  flavorText?: string;
  tags: string[]; // for filtering/searching
}

export interface CardEffect {
  type: EffectType;
  value: number;
  targetType?: TargetType; // overrides card's targetType
  condition?: string; // conditional effect (evaluated at runtime)
  buffType?: BuffType;
  buffDuration?: number;
  buffStacks?: number;
}

export interface CardUpgrade {
  name: string;
  description: string;
  effects: CardEffect[];
  costChange?: number;
}

/**
 * Card instance (runtime)
 */
export interface CardInstance {
  id: string; // unique instance ID
  cardId: string; // references Card.id
  upgrades: number; // number of times upgraded (0, 1, 2)
  exhausted: boolean; // exhausted this turn
  modifiedCost?: number; // temporary cost modification
  temporaryEffects?: CardEffect[]; // temporary effects applied this turn
}

/**
 * Relic definition
 */
export interface Relic extends BaseEntity {
  gameType: GameType;
  name: string;
  description: string;
  rarity: CardRarity;
  effects: RelicEffect[];
  artwork?: string;
  flavorText?: string;
}

export interface RelicEffect {
  trigger: RelicTrigger;
  effects: CardEffect[];
  condition?: string;
}

export type RelicTrigger =
  | 'on_turn_start'
  | 'on_turn_end'
  | 'on_card_played'
  | 'on_card_drawn'
  | 'on_damage_taken'
  | 'on_damage_dealt'
  | 'on_enemy_defeated'
  | 'on_combat_start'
  | 'on_combat_end'
  | 'on_heal'
  | 'on_block_gained'
  | 'on_energy_gained'
  | 'on_shuffle'
  | 'on_exhaust'
  | 'on_upgrade'
  | 'on_potion_used';

/**
 * Potion definition
 */
export interface Potion extends BaseEntity {
  gameType: GameType;
  name: string;
  description: string;
  rarity: CardRarity;
  effects: CardEffect[];
  maxCharges: number;
  artwork?: string;
}

/**
 * Enemy definition
 */
export interface Enemy extends BaseEntity {
  gameType: GameType;
  name: string;
  maxHp: number;
  artwork?: string;
  intentPattern: EnemyIntent[];
  rewards: EnemyRewards;
  tags: string[];
}

export interface EnemyIntent {
  type: 'attack' | 'buff' | 'debuff' | 'special';
  value: number;
  description: string;
  probability: number; // 0-1
}

export interface EnemyRewards {
  gold: { min: number; max: number };
  cards: { count: number; rarityWeights: Record<CardRarity, number> };
  relics?: { probability: number };
  potions?: { probability: number };
}

/**
 * Player in a game
 */
export interface GamePlayer extends BaseEntity {
  gameId: string;
  userId: string;
  seatIndex: number;
  status: PlayerStatus;
  health: number;
  maxHealth: number;
  block: number;
  energy: number;
  maxEnergy: number;
  gold: number;
  deck: CardInstance[];
  hand: CardInstance[];
  discardPile: CardInstance[];
  exhaustPile: CardInstance[];
  relics: RelicInstance[];
  potions: PotionInstance[];
  buffs: BuffInstance[];
  turnNumber: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalBlockGained: number;
  totalCardsPlayed: number;
  totalGoldGained: number;
  connected: boolean;
  lastActionAt?: Date;
}

export interface RelicInstance {
  relicId: string;
  counter?: number; // for relics with counters
  active: boolean;
}

export interface PotionInstance {
  potionId: string;
  charges: number;
}

export interface BuffInstance {
  type: BuffType;
  stacks: number;
  duration: number; // -1 for permanent
  source?: string; // card/relic ID that applied it
}

/**
 * Game state
 */
export interface Game extends BaseEntity {
  gameType: GameType;
  status: GameStatus;
  currentPlayerIndex: number;
  turnNumber: number;
  turnPhase: TurnPhase;
  turnStartTime: Date;
  turnTimeLimit: number; // in milliseconds
  players: GamePlayer[];
  maxPlayers: number;
  seed: string; // for deterministic RNG
  rngState: string; // serialized RNG state
  currentEnemy?: EnemyInstance;
  enemiesDefeated: number;
  floor: number;
  act: number;
  ascensionLevel: number;
  modifiers: GameModifier[];
  log: GameLogEntry[];
  winner?: string; // userId
  endReason?: GameEndReason;
  metadata: GameMetadata;
}

export interface EnemyInstance {
  enemyId: string;
  currentHp: number;
  maxHp: number;
  block: number;
  buffs: BuffInstance[];
  intent: EnemyIntent;
  intentIndex: number;
}

export interface GameModifier {
  id: string;
  name: string;
  description: string;
  effects: CardEffect[];
}

export type GameEndReason =
  | 'victory'
  | 'defeat'
  | 'forfeit'
  | 'timeout'
  | 'disconnect'
  | 'abandoned';

export interface GameLogEntry {
  id: string;
  turnNumber: number;
  playerIndex: number;
  action: ActionType;
  details: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

export interface GameMetadata {
  name?: string;
  description?: string;
  isRanked: boolean;
  isPrivate: boolean;
  inviteCode?: string;
  clubId?: string;
  tournamentId?: string;
  settings: GameSettings;
}

export interface GameSettings {
  turnTimeLimitHours: number;
  allowSpectators: boolean;
  allowChat: boolean;
  allowUndo: boolean;
  maxUndos: number;
  difficulty: 'easy' | 'normal' | 'hard' | 'custom';
  customSettings?: Record<string, unknown>;
}

/**
 * Player action (for serialization)
 */
export interface PlayerAction {
  type: ActionType;
  playerId: string;
  gameId: string;
  timestamp: Date;
  data: PlayCardAction | EndTurnAction | UsePotionAction | ChoiceAction;
}

export interface PlayCardAction {
  cardInstanceId: string;
  targetId?: string; // target entity ID
  targetIndex?: number; // for multi-target
  autoTarget: boolean;
}

export interface EndTurnAction {
  // no additional data
}

export interface UsePotionAction {
  potionInstanceId: string;
  targetId?: string;
}

export interface ChoiceAction {
  choiceId: string;
  selectedOption: number;
}

/**
 * Matchmaking
 */
export interface MatchmakingQueue {
  id: string;
  gameType: GameType;
  status: 'waiting' | 'matched' | 'cancelled';
  players: QueuePlayer[];
  createdAt: Date;
  matchedAt?: Date;
  gameId?: string;
}

export interface QueuePlayer {
  userId: string;
  elo: number;
  joinedAt: Date;
  preferences: QueuePreferences;
}

export interface QueuePreferences {
  minPlayers: number;
  maxPlayers: number;
  turnTimeLimitHours: number;
  ranked: boolean;
}

/**
 * WebSocket messages
 */
export interface WSMessage<T = unknown> {
  type: WSMessageType;
  payload: T;
  timestamp: Date;
  messageId: string;
}

export interface WSConnectPayload {
  userId: string;
  token: string;
}

export interface WSJoinGamePayload {
  gameId: string;
}

export interface WSLeaveGamePayload {
  gameId: string;
}

export interface WSGameStatePayload {
  game: Game;
  yourPlayerIndex: number;
}

export interface WSPlayerActionPayload {
  action: PlayerAction;
}

export interface WSTurnChangePayload {
  currentPlayerIndex: number;
  turnNumber: number;
  phase: TurnPhase;
  timeRemaining: number;
}

export interface WSGameUpdatePayload {
  updates: Partial<Game>;
  playerIndex: number;
}

export interface WSChatPayload {
  gameId: string;
  message: string;
}

export interface WSErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * API Request/Response types
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  field?: string;
}

export interface ResponseMeta {
  timestamp: Date;
  requestId: string;
  version: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: ResponseMeta & {
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Auth types
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JWTPayload {
  userId: string;
  username: string;
  iat: number;
  exp: number;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Game creation
 */
export interface CreateGameRequest {
  gameType: GameType;
  settings: GameSettings;
  invitedPlayers?: string[]; // userIds
  isPrivate: boolean;
  clubId?: string;
  tournamentId?: string;
}

export interface JoinGameRequest {
  gameId: string;
  inviteCode?: string;
}

/**
 * Notification
 */
export interface Notification extends BaseEntity {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  actionUrl?: string;
}

/**
 * Club/Guild
 */
export interface Club extends BaseEntity {
  name: string;
  description: string;
  ownerId: string;
  members: ClubMember[];
  settings: ClubSettings;
  statistics: ClubStatistics;
}

export interface ClubMember {
  userId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
  gamesPlayed: number;
}

export interface ClubSettings {
  isPublic: boolean;
  requireApproval: boolean;
  defaultGameSettings: GameSettings;
}

export interface ClubStatistics {
  totalGames: number;
  activeMembers: number;
  topPlayers: string[]; // userIds
}

/**
 * Tournament
 */
export interface Tournament extends BaseEntity {
  name: string;
  description: string;
  gameType: GameType;
  status: 'upcoming' | 'registration' | 'active' | 'completed' | 'cancelled';
  format: TournamentFormat;
  schedule: TournamentSchedule;
  prizes: TournamentPrize[];
  participants: TournamentParticipant[];
  brackets: TournamentBracket[];
  settings: TournamentSettings;
}

export interface TournamentFormat {
  type: 'single_elimination' | 'double_elimination' | 'swiss' | 'round_robin';
  maxParticipants: number;
  minParticipants: number;
  bestOf: number;
}

export interface TournamentSchedule {
  registrationStart: Date;
  registrationEnd: Date;
  startDate: Date;
  endDate?: Date;
  timezone: string;
}

export interface TournamentPrize {
  rank: number;
  reward: string; // description
  value?: number; // monetary value
}

export interface TournamentParticipant {
  userId: string;
  seed: number;
  status: 'registered' | 'checked_in' | 'playing' | 'eliminated' | 'winner';
  currentRound: number;
}

export interface TournamentBracket {
  round: number;
  matches: TournamentMatch[];
}

export interface TournamentMatch {
  id: string;
  player1Id: string;
  player2Id: string;
  gameId?: string;
  winnerId?: string;
  status: 'pending' | 'active' | 'completed';
  scheduledAt?: Date;
}

export interface TournamentSettings {
  turnTimeLimitHours: number;
  allowSpectators: boolean;
  requireCheckIn: boolean;
  checkInWindowMinutes: number;
}

/**
 * Daily Run / Challenge
 */
export interface DailyRun extends BaseEntity {
  date: string; // YYYY-MM-DD
  gameType: GameType;
  seed: string;
  modifiers: GameModifier[];
  leaderboard: DailyRunEntry[];
  totalParticipants: number;
}

export interface DailyRunEntry {
  userId: string;
  score: number;
  turns: number;
  timeElapsed: number; // milliseconds
  completed: boolean;
  defeatedEnemies: number;
  floorReached: number;
  damageTaken: number;
  deck: string[]; // card IDs
  relics: string[]; // relic IDs
  submittedAt: Date;
}

/**
 * Leaderboard
 */
export interface Leaderboard extends BaseEntity {
  gameType: GameType;
  period: 'daily' | 'weekly' | 'monthly' | 'seasonal' | 'all_time';
  periodStart: Date;
  periodEnd: Date;
  entries: LeaderboardEntry[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  score: number;
  gamesPlayed: number;
  winRate: number;
  avatarUrl?: string;
}

/**
 * Replay
 */
export interface Replay extends BaseEntity {
  gameId: string;
  gameType: GameType;
  players: ReplayPlayer[];
  actions: PlayerAction[];
  seed: string;
  winner: string;
  duration: number; // milliseconds
  turnCount: number;
  version: string; // game version for compatibility
}

export interface ReplayPlayer {
  userId: string;
  seatIndex: number;
  finalHealth: number;
  totalDamageDealt: number;
  totalCardsPlayed: number;
}

/**
 * Achievement
 */
export interface Achievement extends BaseEntity {
  gameType: GameType;
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  criteria: AchievementCriteria;
  reward?: AchievementReward;
}

export interface AchievementCriteria {
  type: 'games_won' | 'games_played' | 'enemies_defeated' | 'cards_played' | 'damage_dealt' | 'custom';
  target: number;
  customCondition?: string;
}

export interface AchievementReward {
  type: 'cosmetic' | 'currency' | 'title' | 'badge';
  value: string;
  amount?: number;
}

export interface UserAchievement {
  userId: string;
  achievementId: string;
  unlockedAt: Date;
  progress: number;
  completed: boolean;
}