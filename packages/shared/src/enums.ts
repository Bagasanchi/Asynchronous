/**
 * Game type identifiers
 */
export enum GameType {
  ASCENSION = 'ascension',        // Deckbuilder like Slay the Spire
  HEARTS = 'hearts',              // Trick-taking
  MAFIA = 'mafia',                // Social deduction
  POKER = 'poker',                // Poker variant
}

/**
 * Game status
 */
export enum GameStatus {
  WAITING = 'waiting',            // Waiting for players to join
  ACTIVE = 'active',              // Game in progress
  PAUSED = 'paused',              // Game paused
  FINISHED = 'finished',          // Game completed
  ABANDONED = 'abandoned',        // Game abandoned
}

/**
 * Player status in a game
 */
export enum PlayerStatus {
  WAITING = 'waiting',            // Waiting for game to start
  ACTIVE = 'active',              // It's their turn
  INACTIVE = 'inactive',          // Not their turn
  FINISHED = 'finished',          // Player has finished (won/lost)
  DISCONNECTED = 'disconnected',  // Player disconnected
  FORFEITED = 'forfeited',        // Player forfeited
}

/**
 * Turn phase
 */
export enum TurnPhase {
  START = 'start',                // Turn start effects
  DRAW = 'draw',                  // Draw phase
  MAIN = 'main',                  // Main phase (play cards)
  COMBAT = 'combat',              // Combat phase
  END = 'end',                    // End phase
  DISCARD = 'discard',            // Discard phase
}

/**
 * Card types
 */
export enum CardType {
  ACTION = 'action',              // Action card
  ATTACK = 'attack',              // Attack card
  SKILL = 'skill',                // Skill card
  POWER = 'power',                // Power card
  CURSE = 'curse',                // Curse card
  STATUS = 'status',              // Status card
  RELIC = 'relic',                // Relic (persistent effect)
}

/**
 * Card rarity
 */
export enum CardRarity {
  BASIC = 'basic',
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  SPECIAL = 'special',
  BOSS = 'boss',
}

/**
 * Target types for card effects
 */
export enum TargetType {
  SELF = 'self',
  ENEMY = 'enemy',
  ALL_ENEMIES = 'all_enemies',
  RANDOM_ENEMY = 'random_enemy',
  ALLY = 'ally',
  ALL_ALLIES = 'all_allies',
  SPECIFIC = 'specific',
}

/**
 * Effect types
 */
export enum EffectType {
  DAMAGE = 'damage',
  HEAL = 'heal',
  GAIN_BLOCK = 'gain_block',
  DRAW = 'draw',
  DISCARD = 'discard',
  EXHAUST = 'exhaust',
  GAIN_ENERGY = 'gain_energy',
  LOSE_ENERGY = 'lose_energy',
  APPLY_BUFF = 'apply_buff',
  APPLY_DEBUFF = 'apply_debuff',
  REMOVE_BUFF = 'remove_buff',
  REMOVE_DEBUFF = 'remove_debuff',
  GAIN_GOLD = 'gain_gold',
  GAIN_POTION = 'gain_potion',
  ADD_CARD = 'add_card',
  REMOVE_CARD = 'remove_card',
  UPGRADE_CARD = 'upgrade_card',
  TRANSFORM_CARD = 'transform_card',
}

/**
 * Buff/Debuff types
 */
export enum BuffType {
  STRENGTH = 'strength',
  DEXTERITY = 'dexterity',
  FOCUS = 'focus',
  THORNS = 'thorns',
  REGENERATION = 'regeneration',
  PLATED_ARMOR = 'plated_armor',
  METALLICIZE = 'metallicize',
  VULNERABLE = 'vulnerable',
  WEAK = 'weak',
  FRAIL = 'frail',
  POISON = 'poison',
  BURN = 'burn',
  ENTANGLED = 'entangled',
  STUN = 'stun',
  CONFUSION = 'confusion',
}

/**
 * Player action types
 */
export enum ActionType {
  PLAY_CARD = 'play_card',
  END_TURN = 'end_turn',
  USE_POTION = 'use_potion',
  INSPECT = 'inspect',
  CHOICE = 'choice',
}

/**
 * Notification types
 */
export enum NotificationType {
  GAME_INVITE = 'game_invite',
  YOUR_TURN = 'your_turn',
  GAME_STARTED = 'game_started',
  GAME_ENDED = 'game_ended',
  PLAYER_JOINED = 'player_joined',
  PLAYER_LEFT = 'player_left',
  TURN_ENDED = 'turn_ended',
  ACTION_TAKEN = 'action_taken',
  CHAT_MESSAGE = 'chat_message',
}

/**
 * WebSocket message types
 */
export enum WSMessageType {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  JOIN_GAME = 'join_game',
  LEAVE_GAME = 'leave_game',
  GAME_STATE = 'game_state',
  PLAYER_ACTION = 'player_action',
  TURN_CHANGE = 'turn_change',
  GAME_UPDATE = 'game_update',
  CHAT = 'chat',
  PING = 'ping',
  PONG = 'pong',
  ERROR = 'error',
}