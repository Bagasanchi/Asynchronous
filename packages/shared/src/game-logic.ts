/**
 * Core game logic for Ascension (deckbuilder) game type
 */

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
} from './enums';
import type {
  Game,
  GamePlayer,
  Card,
  CardInstance,
  CardEffect,
  Enemy,
  EnemyInstance,
  EnemyIntent,
  Relic,
  RelicInstance,
  Potion,
  PotionInstance,
  BuffInstance,
  GameSettings,
  GameModifier,
  GameLogEntry,
  PlayerAction,
  GameEndReason, PlayCardAction,
  EndTurnAction,
  UsePotionAction,
  ChoiceAction,
  GameMetadata,
} from './types';
import { SeededRandom } from './seeded-random';
import { generateId, nowDate, addTime, formatDuration } from './utils';

// ============================================================================
// CARD DATABASE - Ascension (Slay the Spire-like)
// ============================================================================

export const ASCENSION_CARDS: Card[] = [
  // Starter Cards
  {
    id: 'strike',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Strike',
    description: 'Deal 6 damage.',
    type: CardType.ATTACK,
    rarity: CardRarity.BASIC,
    cost: 1,
    targetType: TargetType.ENEMY,
    effects: [{ type: EffectType.DAMAGE, value: 6 }],
    tags: ['starter', 'attack'],
  },
  {
    id: 'defend',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Defend',
    description: 'Gain 5 block.',
    type: CardType.SKILL,
    rarity: CardRarity.BASIC,
    cost: 1,
    targetType: TargetType.SELF,
    effects: [{ type: EffectType.GAIN_BLOCK, value: 5 }],
    tags: ['starter', 'defense'],
  },
  {
    id: 'bash',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Bash',
    description: 'Deal 8 damage. Apply 2 Vulnerable.',
    type: CardType.ATTACK,
    rarity: CardRarity.BASIC,
    cost: 2,
    targetType: TargetType.ENEMY,
    effects: [
      { type: EffectType.DAMAGE, value: 8 },
      { type: EffectType.APPLY_DEBUFF, value: 2, buffType: BuffType.VULNERABLE, buffDuration: 2 },
    ],
    tags: ['starter', 'attack', 'debuff'],
  },

  // Common Attacks
  {
    id: 'iron_wave',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Iron Wave',
    description: 'Deal 5 damage. Gain 5 block.',
    type: CardType.ATTACK,
    rarity: CardRarity.COMMON,
    cost: 1,
    targetType: TargetType.ENEMY,
    effects: [
      { type: EffectType.DAMAGE, value: 5 },
      { type: EffectType.GAIN_BLOCK, value: 5 },
    ],
    tags: ['attack', 'defense'],
  },
  {
    id: 'heavy_blade',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Heavy Blade',
    description: 'Deal 14 damage. Deal 4 extra damage for each point of Strength.',
    type: CardType.ATTACK,
    rarity: CardRarity.COMMON,
    cost: 1,
    targetType: TargetType.ENEMY,
    effects: [{ type: EffectType.DAMAGE, value: 14 }],
    tags: ['attack', 'strength_synergy'],
  },
  {
    id: 'pommel_strike',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Pommel Strike',
    description: 'Deal 9 damage. Draw 1 card.',
    type: CardType.ATTACK,
    rarity: CardRarity.COMMON,
    cost: 1,
    targetType: TargetType.ENEMY,
    effects: [
      { type: EffectType.DAMAGE, value: 9 },
      { type: EffectType.DRAW, value: 1 },
    ],
    tags: ['attack', 'draw'],
  },
  {
    id: 'sword_boomerang',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Sword Boomerang',
    description: 'Deal 4 damage to ALL enemies.',
    type: CardType.ATTACK,
    rarity: CardRarity.COMMON,
    cost: 1,
    targetType: TargetType.ALL_ENEMIES,
    effects: [{ type: EffectType.DAMAGE, value: 4, targetType: TargetType.ALL_ENEMIES }],
    tags: ['attack', 'aoe'],
  },
  {
    id: 'twin_strike',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Twin Strike',
    description: 'Deal 5 damage twice.',
    type: CardType.ATTACK,
    rarity: CardRarity.COMMON,
    cost: 1,
    targetType: TargetType.ENEMY,
    effects: [
      { type: EffectType.DAMAGE, value: 5 },
      { type: EffectType.DAMAGE, value: 5 },
    ],
    tags: ['attack', 'multi_hit'],
  },
  {
    id: 'wild_strike',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Wild Strike',
    description: 'Deal 12 damage. Add a Wound to your discard pile.',
    type: CardType.ATTACK,
    rarity: CardRarity.COMMON,
    cost: 1,
    targetType: TargetType.ENEMY,
    effects: [{ type: EffectType.DAMAGE, value: 12 }],
    tags: ['attack', 'wound'],
  },

  // Common Skills
  {
    id: 'neutralize',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Neutralize',
    description: 'Apply 2 Weak to an enemy.',
    type: CardType.SKILL,
    rarity: CardRarity.COMMON,
    cost: 0,
    targetType: TargetType.ENEMY,
    effects: [{ type: EffectType.APPLY_DEBUFF, value: 2, buffType: BuffType.WEAK }],
    tags: ['debuff', 'zero_cost'],
  },
  {
    id: 'survivor',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Survivor',
    description: 'Gain 8 block. If you have no block, gain 8 additional block.',
    type: CardType.SKILL,
    rarity: CardRarity.COMMON,
    cost: 1,
    targetType: TargetType.SELF,
    effects: [{ type: EffectType.GAIN_BLOCK, value: 8 }],
    tags: ['defense', 'conditional'],
  },
  {
    id: 'rugged',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Rugged',
    description: 'Gain 12 block. Exhaust.',
    type: CardType.SKILL,
    rarity: CardRarity.COMMON,
    cost: 1,
    targetType: TargetType.SELF,
    effects: [{ type: EffectType.GAIN_BLOCK, value: 12 }],
    tags: ['defense', 'exhaust'],
  },
  {
    id: 'shrug_it_off',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Shrug It Off',
    description: 'Gain 8 block. Draw 1 card.',
    type: CardType.SKILL,
    rarity: CardRarity.COMMON,
    cost: 1,
    targetType: TargetType.SELF,
    effects: [
      { type: EffectType.GAIN_BLOCK, value: 8 },
      { type: EffectType.DRAW, value: 1 },
    ],
    tags: ['defense', 'draw'],
  },
  {
    id: 'battle_trance',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Battle Trance',
    description: 'Draw 3 cards. Exhaust.',
    type: CardType.SKILL,
    rarity: CardRarity.COMMON,
    cost: 0,
    targetType: TargetType.SELF,
    effects: [{ type: EffectType.DRAW, value: 3 }],
    tags: ['draw', 'exhaust', 'zero_cost'],
  },
  {
    id: 'anger',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Anger',
    description: 'Add a copy of this card to your hand. It costs 0 this turn. Exhaust.',
    type: CardType.SKILL,
    rarity: CardRarity.COMMON,
    cost: 0,
    targetType: TargetType.SELF,
    effects: [],
    tags: ['zero_cost', 'exhaust', 'copy'],
  },
  {
    id: 'armaments',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Armaments',
    description: 'Gain 5 block. Upgrade a card in your hand for this combat.',
    type: CardType.SKILL,
    rarity: CardRarity.COMMON,
    cost: 1,
    targetType: TargetType.SELF,
    effects: [{ type: EffectType.GAIN_BLOCK, value: 5 }],
    tags: ['defense', 'upgrade'],
  },
  {
    id: 'flex',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Flex',
    description: 'Gain 2 Strength. At the end of your turn, lose 2 Strength.',
    type: CardType.SKILL,
    rarity: CardRarity.COMMON,
    cost: 0,
    targetType: TargetType.SELF,
    effects: [{ type: EffectType.APPLY_BUFF, value: 2, buffType: BuffType.STRENGTH }],
    tags: ['buff', 'strength', 'zero_cost', 'temporary'],
  },

  // Uncommon Attacks
  {
    id: 'clash',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Clash',
    description: 'Deal 14 damage. Can only be played if your hand is empty.',
    type: CardType.ATTACK,
    rarity: CardRarity.UNCOMMON,
    cost: 0,
    targetType: TargetType.ENEMY,
    effects: [{ type: EffectType.DAMAGE, value: 14 }],
    tags: ['attack', 'conditional', 'zero_cost'],
  },
  {
    id: 'cleave',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Cleave',
    description: 'Deal 8 damage to ALL enemies.',
    type: CardType.ATTACK,
    rarity: CardRarity.UNCOMMON,
    cost: 1,
    targetType: TargetType.ALL_ENEMIES,
    effects: [{ type: EffectType.DAMAGE, value: 8, targetType: TargetType.ALL_ENEMIES }],
    tags: ['attack', 'aoe'],
  },
  {
    id: 'dropkick',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Dropkick',
    description: 'Deal 5 damage. If the enemy has Vulnerable, gain 1 Energy and draw 1 card.',
    type: CardType.ATTACK,
    rarity: CardRarity.UNCOMMON,
    cost: 1,
    targetType: TargetType.ENEMY,
    effects: [{ type: EffectType.DAMAGE, value: 5 }],
    tags: ['attack', 'vulnerable_synergy', 'energy', 'draw'],
  },
  {
    id: 'uppercut',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Uppercut',
    description: 'Deal 13 damage. Apply 1 Weak.',
    type: CardType.ATTACK,
    rarity: CardRarity.UNCOMMON,
    cost: 2,
    targetType: TargetType.ENEMY,
    effects: [
      { type: EffectType.DAMAGE, value: 13 },
      { type: EffectType.APPLY_DEBUFF, value: 1, buffType: BuffType.WEAK },
    ],
    tags: ['attack', 'debuff'],
  },
  {
    id: 'whirlwind',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Whirlwind',
    description: 'Deal 5 damage to ALL enemies for each Attack in your hand.',
    type: CardType.ATTACK,
    rarity: CardRarity.UNCOMMON,
    cost: 1,
    targetType: TargetType.ALL_ENEMIES,
    effects: [{ type: EffectType.DAMAGE, value: 5, targetType: TargetType.ALL_ENEMIES }],
    tags: ['attack', 'aoe', 'hand_synergy'],
  },

  // Uncommon Skills
  {
    id: 'adrenaline',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Adrenaline',
    description: 'Gain 1 Energy. Draw 1 card. Exhaust.',
    type: CardType.SKILL,
    rarity: CardRarity.UNCOMMON,
    cost: 0,
    targetType: TargetType.SELF,
    effects: [
      { type: EffectType.GAIN_ENERGY, value: 1 },
      { type: EffectType.DRAW, value: 1 },
    ],
    tags: ['energy', 'draw', 'exhaust', 'zero_cost'],
  },
  {
    id: 'bludgeon',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Bludgeon',
    description: 'Deal 32 damage. Exhaust.',
    type: CardType.ATTACK,
    rarity: CardRarity.UNCOMMON,
    cost: 3,
    targetType: TargetType.ENEMY,
    effects: [{ type: EffectType.DAMAGE, value: 32 }],
    tags: ['attack', 'exhaust', 'high_damage'],
  },
  {
    id: 'dark_embrace',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Dark Embrace',
    description: 'Whenever you Exhaust a card, draw 1 card.',
    type: CardType.POWER,
    rarity: CardRarity.UNCOMMON,
    cost: 2,
    targetType: TargetType.SELF,
    effects: [],
    tags: ['power', 'exhaust_synergy', 'draw'],
  },
  {
    id: 'entrench',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Entrench',
    description: 'Double your block.',
    type: CardType.SKILL,
    rarity: CardRarity.UNCOMMON,
    cost: 1,
    targetType: TargetType.SELF,
    effects: [],
    tags: ['defense', 'block_manipulation'],
  },
  {
    id: 'feed',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Feed',
    description: 'Can only be played if it will kill an enemy. Increase your Max HP by 3.',
    type: CardType.SKILL,
    rarity: CardRarity.UNCOMMON,
    cost: 1,
    targetType: TargetType.ENEMY,
    effects: [{ type: EffectType.HEAL, value: 3 }],
    tags: ['heal', 'max_hp', 'conditional'],
  },
  {
    id: 'flame_barrier',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Flame Barrier',
    description: 'Gain 12 block. Whenever you are attacked this turn, deal 4 damage to the attacker.',
    type: CardType.SKILL,
    rarity: CardRarity.UNCOMMON,
    cost: 2,
    targetType: TargetType.SELF,
    effects: [{ type: EffectType.GAIN_BLOCK, value: 12 }],
    tags: ['defense', 'thorns'],
  },
  {
    id: 'grenade',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Grenade',
    description: 'Deal 10 damage to ALL enemies. Exhaust.',
    type: CardType.ATTACK,
    rarity: CardRarity.UNCOMMON,
    cost: 1,
    targetType: TargetType.ALL_ENEMIES,
    effects: [{ type: EffectType.DAMAGE, value: 10, targetType: TargetType.ALL_ENEMIES }],
    tags: ['attack', 'aoe', 'exhaust'],
  },
  {
    id: 'havoc',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Havoc',
    description: 'Play the top card of your draw pile. Exhaust.',
    type: CardType.SKILL,
    rarity: CardRarity.UNCOMMON,
    cost: 1,
    targetType: TargetType.SELF,
    effects: [],
    tags: ['draw_pile', 'exhaust'],
  },
  {
    id: 'headbutt',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Headbutt',
    description: 'Deal 9 damage. Put a card from your discard pile on top of your draw pile.',
    type: CardType.ATTACK,
    rarity: CardRarity.UNCOMMON,
    cost: 1,
    targetType: TargetType.ENEMY,
    effects: [{ type: EffectType.DAMAGE, value: 9 }],
    tags: ['attack', 'discard_manipulation'],
  },
  {
    id: 'heavy_blade_upgraded',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Heavy Blade+',
    description: 'Deal 18 damage. Deal 6 extra damage for each point of Strength.',
    type: CardType.ATTACK,
    rarity: CardRarity.UNCOMMON,
    cost: 1,
    targetType: TargetType.ENEMY,
    effects: [{ type: EffectType.DAMAGE, value: 18 }],
    tags: ['attack', 'strength_synergy', 'upgraded'],
  },

  // Rare Cards
  {
    id: 'barricade',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Barricade',
    description: 'Block is not removed at the start of your turn.',
    type: CardType.POWER,
    rarity: CardRarity.RARE,
    cost: 3,
    targetType: TargetType.SELF,
    effects: [],
    tags: ['power', 'block_retention'],
  },
  {
    id: 'berserk',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Berserk',
    description: 'Gain 1 Energy. Lose 5 HP. Exhaust.',
    type: CardType.SKILL,
    rarity: CardRarity.RARE,
    cost: 0,
    targetType: TargetType.SELF,
    effects: [{ type: EffectType.GAIN_ENERGY, value: 1 }],
    tags: ['energy', 'hp_cost', 'exhaust', 'zero_cost'],
  },
  {
    id: 'bludgeon_upgraded',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Bludgeon+',
    description: 'Deal 42 damage. Exhaust.',
    type: CardType.ATTACK,
    rarity: CardRarity.RARE,
    cost: 3,
    targetType: TargetType.ENEMY,
    effects: [{ type: EffectType.DAMAGE, value: 42 }],
    tags: ['attack', 'exhaust', 'high_damage', 'upgraded'],
  },
  {
    id: 'brutality',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Brutality',
    description: 'At the start of your turn, lose 1 HP. All your attacks deal 8 additional damage.',
    type: CardType.POWER,
    rarity: CardRarity.RARE,
    cost: 0,
    targetType: TargetType.SELF,
    effects: [],
    tags: ['power', 'hp_cost', 'damage_buff', 'zero_cost'],
  },
  {
    id: 'corruption',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Corruption',
    description: 'Skills cost 0. Whenever you play a Skill, Exhaust it.',
    type: CardType.POWER,
    rarity: CardRarity.RARE,
    cost: 3,
    targetType: TargetType.SELF,
    effects: [],
    tags: ['power', 'skill_synergy', 'exhaust'],
  },
  {
    id: 'demonic_form',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Demonic Form',
    description: 'At the start of your turn, gain 2 Strength.',
    type: CardType.POWER,
    rarity: CardRarity.RARE,
    cost: 3,
    targetType: TargetType.SELF,
    effects: [],
    tags: ['power', 'strength', 'scaling'],
  },
  {
    id: 'double_tap',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Double Tap',
    description: 'Choose an Attack in your hand. Play it twice. Exhaust.',
    type: CardType.SKILL,
    rarity: CardRarity.RARE,
    cost: 1,
    targetType: TargetType.SELF,
    effects: [],
    tags: ['attack_synergy', 'exhaust'],
  },
  {
    id: 'exhume',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Exhume',
    description: 'Put a card from your exhaust pile into your hand. It costs 0. Exhaust.',
    type: CardType.SKILL,
    rarity: CardRarity.RARE,
    cost: 1,
    targetType: TargetType.SELF,
    effects: [],
    tags: ['exhaust_pile', 'zero_cost', 'exhaust'],
  },
  {
    id: 'impervious',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Impervious',
    description: 'Gain 30 block. Exhaust.',
    type: CardType.SKILL,
    rarity: CardRarity.RARE,
    cost: 2,
    targetType: TargetType.SELF,
    effects: [{ type: EffectType.GAIN_BLOCK, value: 30 }],
    tags: ['defense', 'high_block', 'exhaust'],
  },
  {
    id: 'limit_break',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Limit Break',
    description: 'Double your Strength. Exhaust.',
    type: CardType.SKILL,
    rarity: CardRarity.RARE,
    cost: 1,
    targetType: TargetType.SELF,
    effects: [],
    tags: ['strength', 'scaling', 'exhaust'],
  },
  {
    id: 'offering',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Offering',
    description: 'Lose 6 HP. Gain 2 Energy. Draw 3 cards. Exhaust.',
    type: CardType.SKILL,
    rarity: CardRarity.RARE,
    cost: 0,
    targetType: TargetType.SELF,
    effects: [
      { type: EffectType.GAIN_ENERGY, value: 2 },
      { type: EffectType.DRAW, value: 3 },
    ],
    tags: ['energy', 'draw', 'hp_cost', 'exhaust', 'zero_cost'],
  },
  {
    id: 'reaper',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Reaper',
    description: 'Deal 4 damage to ALL enemies. Heal 3 HP for each enemy hit.',
    type: CardType.ATTACK,
    rarity: CardRarity.RARE,
    cost: 2,
    targetType: TargetType.ALL_ENEMIES,
    effects: [
      { type: EffectType.DAMAGE, value: 4, targetType: TargetType.ALL_ENEMIES },
      { type: EffectType.HEAL, value: 3 },
    ],
    tags: ['attack', 'aoe', 'heal', 'lifesteal'],
  },
  {
    id: 'seeing_red',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Seeing Red',
    description: 'Gain 2 Energy. Exhaust.',
    type: CardType.SKILL,
    rarity: CardRarity.RARE,
    cost: 1,
    targetType: TargetType.SELF,
    effects: [{ type: EffectType.GAIN_ENERGY, value: 2 }],
    tags: ['energy', 'exhaust'],
  },
];

// ============================================================================
// RELIC DATABASE
// ============================================================================

export const ASCENSION_RELICS: Relic[] = [
  {
    id: 'burning_blood',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Burning Blood',
    description: 'Heal 6 HP at the end of each combat.',
    rarity: CardRarity.COMMON,
    effects: [
      { trigger: 'on_combat_end', effects: [{ type: EffectType.HEAL, value: 6 }] },
    ],
    tags: ['heal', 'combat_end'],
  },
  {
    id: 'wakizashi',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Wakizashi',
    description: 'Start each combat with a random Attack in your hand.',
    rarity: CardRarity.COMMON,
    effects: [
      { trigger: 'on_combat_start', effects: [{ type: EffectType.ADD_CARD, value: 1 }] },
    ],
    tags: ['combat_start', 'attack'],
  },
  {
    id: 'ring_of_the_snake',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Ring of the Snake',
    description: 'Draw 2 additional cards at the start of each combat.',
    rarity: CardRarity.COMMON,
    effects: [
      { trigger: 'on_combat_start', effects: [{ type: EffectType.DRAW, value: 2 }] },
    ],
    tags: ['combat_start', 'draw'],
  },
  {
    id: 'red_skull',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Red Skull',
    description: 'Gain 2 Energy at the start of each combat.',
    rarity: CardRarity.UNCOMMON,
    effects: [
      { trigger: 'on_combat_start', effects: [{ type: EffectType.GAIN_ENERGY, value: 2 }] },
    ],
    tags: ['combat_start', 'energy'],
  },
  {
    id: 'blood_vial',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Blood Vial',
    description: 'Heal 2 HP whenever you take damage.',
    rarity: CardRarity.UNCOMMON,
    effects: [
      { trigger: 'on_damage_taken', effects: [{ type: EffectType.HEAL, value: 2 }] },
    ],
    tags: ['heal', 'damage_taken'],
  },
  {
    id: 'ancient_tea_set',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Ancient Tea Set',
    description: 'Start each combat with 1 Energy. Lose 5 Max HP.',
    rarity: CardRarity.RARE,
    effects: [
      { trigger: 'on_combat_start', effects: [{ type: EffectType.GAIN_ENERGY, value: 1 }] },
    ],
    tags: ['combat_start', 'energy', 'hp_cost'],
  },
  {
    id: 'artifact',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Artifact',
    description: 'Negate the first time you would gain a debuff each combat.',
    rarity: CardRarity.RARE,
    effects: [],
    tags: ['debuff_immunity'],
  },
  {
    id: 'blue_candle',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Blue Candle',
    description: 'Cards in your exhaust pile can be played. They are exhausted.',
    rarity: CardRarity.RARE,
    effects: [],
    tags: ['exhaust_pile', 'play_from_exhaust'],
  },
  {
    id: 'bronze_scales',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Bronze Scales',
    description: 'Whenever you take unblocked attack damage, deal 3 damage to the attacker.',
    rarity: CardRarity.UNCOMMON,
    effects: [
      { trigger: 'on_damage_taken', effects: [{ type: EffectType.DAMAGE, value: 3 }] },
    ],
    tags: ['thorns', 'damage_taken'],
  },
  {
    id: 'centennial_puzzle',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Centennial Puzzle',
    description: 'When you die, revive with 15 HP. One use only.',
    rarity: CardRarity.RARE,
    effects: [],
    tags: ['revive', 'one_use'],
  },
];

// ============================================================================
// ENEMY DATABASE
// ============================================================================

export const ASCENSION_ENEMIES: Enemy[] = [
  {
    id: 'cultist',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Cultist',
    maxHp: 48,
    intentPattern: [
      { type: 'attack', value: 6, description: 'Attack (6)', probability: 0.6 },
      { type: 'buff', value: 3, description: 'Gain 3 Strength', probability: 0.4 },
    ],
    rewards: {
      gold: { min: 10, max: 15 },
      cards: { count: 1, rarityWeights: { basic: 0, common: 1, uncommon: 0, rare: 0, special: 0, boss: 0 } },
    },
    tags: ['basic', 'humanoid'],
  },
  {
    id: 'jaw_worm',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Jaw Worm',
    maxHp: 40,
    intentPattern: [
      { type: 'attack', value: 11, description: 'Bite (11)', probability: 0.45 },
      { type: 'attack', value: 7, description: 'Thrash (7+7)', probability: 0.3 },
      { type: 'buff', value: 3, description: 'Gain 3 Block', probability: 0.25 },
    ],
    rewards: {
      gold: { min: 12, max: 17 },
      cards: { count: 1, rarityWeights: { basic: 0, common: 1, uncommon: 0, rare: 0, special: 0, boss: 0 } },
    },
    tags: ['basic', 'beast'],
  },
  {
    id: 'gremlin_nob',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Gremlin Nob',
    maxHp: 60,
    intentPattern: [
      { type: 'attack', value: 6, description: 'Rush (6)', probability: 0.2 },
      { type: 'buff', value: 2, description: 'Gain 2 Strength', probability: 0.3 },
      { type: 'special', value: 0, description: 'Call for Backup (Spawn Gremlin)', probability: 0.15 },
      { type: 'attack', value: 5, description: 'Stab x3 (5x3)', probability: 0.35 },
    ],
    rewards: {
      gold: { min: 25, max: 30 },
      cards: { count: 1, rarityWeights: { basic: 0, common: 0.5, uncommon: 0.5, rare: 0, special: 0, boss: 0 } },
      relics: { probability: 0.1 },
    },
    tags: ['elite', 'humanoid', 'gremlin'],
  },
  {
    id: 'lagavulin',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Lagavulin',
    maxHp: 120,
    intentPattern: [
      { type: 'debuff', value: 1, description: 'Apply 1 Weak', probability: 0.3 },
      { type: 'attack', value: 18, description: 'Attack (18)', probability: 0.4 },
      { type: 'special', value: 0, description: 'Sleep (Skip turn)', probability: 0.3 },
    ],
    rewards: {
      gold: { min: 30, max: 35 },
      cards: { count: 1, rarityWeights: { basic: 0, common: 0.3, uncommon: 0.7, rare: 0, special: 0, boss: 0 } },
      relics: { probability: 0.15 },
    },
    tags: ['elite', 'construct'],
  },
  {
    id: 'slime_boss',
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    name: 'Slime Boss',
    maxHp: 250,
    intentPattern: [
      { type: 'attack', value: 14, description: 'Tackle (14)', probability: 0.3 },
      { type: 'special', value: 0, description: 'Split (Spawn 2 Small Slimes)', probability: 0.25 },
      { type: 'attack', value: 8, description: 'Slam (8) + Gain 5 Strength', probability: 0.25 },
      { type: 'buff', value: 10, description: 'Gain 10 Block', probability: 0.2 },
    ],
    rewards: {
      gold: { min: 99, max: 105 },
      cards: { count: 3, rarityWeights: { basic: 0, common: 0.2, uncommon: 0.6, rare: 0.2, special: 0, boss: 0 } },
      relics: { probability: 1.0 },
    },
    tags: ['boss', 'slime'],
  },
];

// ============================================================================
// STARTER DECKS
// ============================================================================

export const STARTER_DECKS: Record<string, string[]> = {
  ironclad: [
    'strike', 'strike', 'strike', 'strike', 'strike',
    'defend', 'defend', 'defend', 'defend',
    'bash',
  ],
  silent: [
    'strike', 'strike', 'strike', 'strike',
    'defend', 'defend', 'defend', 'defend',
    'neutralize', 'survivor',
  ],
  defect: [
    'strike', 'strike', 'strike', 'strike',
    'defend', 'defend', 'defend', 'defend',
    'zap', 'dualcast',
  ],
  watcher: [
    'strike', 'strike', 'strike', 'strike',
    'defend', 'defend', 'defend', 'defend',
    'eruption', 'vigilance',
  ],
};

// ============================================================================
// GAME ENGINE CLASS
// ============================================================================

export class GameEngine {
  private game: Game;
  private rng: SeededRandom;
  private cardDatabase: Map<string, Card>;
  private relicDatabase: Map<string, Relic>;
  private enemyDatabase: Map<string, Enemy>;

  constructor(game: Game) {
    this.game = game;
    this.rng = new SeededRandom(game.seed);
    this.rng.setState(game.rngState);

    this.cardDatabase = new Map(ASCENSION_CARDS.map(c => [c.id, c]));
    this.relicDatabase = new Map(ASCENSION_RELICS.map(r => [r.id, r]));
    this.enemyDatabase = new Map(ASCENSION_ENEMIES.map(e => [e.id, e]));
  }

  // ========================================================================
  // GAME STATE ACCESSORS
  // ========================================================================

  getGame(): Game {
    return this.game;
  }

  getCurrentPlayer(): GamePlayer {
    return this.game.players[this.game.currentPlayerIndex];
  }

  getCurrentEnemy(): EnemyInstance | undefined {
    return this.game.currentEnemy;
  }

  getRNG(): SeededRandom {
    return this.rng;
  }

  // ========================================================================
  // CARD HELPERS
  // ========================================================================

  getCard(cardId: string): Card | undefined {
    return this.cardDatabase.get(cardId);
  }

  getCardInstance(instanceId: string): CardInstance | undefined {
    const player = this.getCurrentPlayer();
    return [...player.hand, ...player.discardPile, ...player.drawPile, ...player.exhaustPile]
      .find(c => c.id === instanceId);
  }

  createCardInstance(cardId: string, upgrades: number = 0): CardInstance {
    return {
      id: generateId(),
      cardId,
      upgrades,
      exhausted: false,
    };
  }

  // ========================================================================
  // DECK MANAGEMENT
  // ========================================================================

  shuffleDrawPile(player: GamePlayer): void {
    player.deck = this.rng.shuffle(player.deck);
    this.logAction(player, ActionType.INSPECT, 'Shuffled draw pile');
  }

  drawCards(player: GamePlayer, count: number): CardInstance[] {
    const drawn: CardInstance[] = [];

    for (let i = 0; i < count; i++) {
      if (player.deck.length === 0) {
        if (player.discardPile.length === 0) break;
        // Shuffle discard into deck
        player.deck = this.rng.shuffle([...player.discardPile]);
        player.discardPile = [];
        this.logAction(player, ActionType.INSPECT, 'Shuffled discard pile into draw pile');
      }

      if (player.deck.length > 0) {
        const card = player.deck.pop()!;
        player.hand.push(card);
        drawn.push(card);
        this.logAction(player, ActionType.DRAW, `Drew ${this.getCard(card.cardId)?.name ?? 'Unknown'}`);
      }
    }

    return drawn;
  }

  discardCard(player: GamePlayer, cardInstanceId: string): boolean {
    const index = player.hand.findIndex(c => c.id === cardInstanceId);
    if (index === -1) return false;

    const [card] = player.hand.splice(index, 1);
    card.exhausted = false;
    player.discardPile.push(card);
    this.logAction(player, ActionType.DISCARD, `Discarded ${this.getCard(card.cardId)?.name ?? 'Unknown'}`);
    return true;
  }

  exhaustCard(player: GamePlayer, cardInstanceId: string): boolean {
    // Check hand
    let index = player.hand.findIndex(c => c.id === cardInstanceId);
    if (index !== -1) {
      const [card] = player.hand.splice(index, 1);
      player.exhaustPile.push(card);
      this.logAction(player, ActionType.EXHAUST, `Exhausted ${this.getCard(card.cardId)?.name ?? 'Unknown'}`);
      return true;
    }

    // Check discard
    index = player.discardPile.findIndex(c => c.id === cardInstanceId);
    if (index !== -1) {
      const [card] = player.discardPile.splice(index, 1);
      player.exhaustPile.push(card);
      this.logAction(player, ActionType.EXHAUST, `Exhausted ${this.getCard(card.cardId)?.name ?? 'Unknown'}`);
      return true;
    }

    return false;
  }

  addCardToDiscard(player: GamePlayer, cardId: string, upgrades: number = 0): CardInstance {
    const instance = this.createCardInstance(cardId, upgrades);
    player.discardPile.push(instance);
    this.logAction(player, ActionType.ADD_CARD, `Added ${this.getCard(cardId)?.name ?? 'Unknown'} to discard`);
    return instance;
  }

  addCardToHand(player: GamePlayer, cardId: string, upgrades: number = 0): CardInstance {
    const instance = this.createCardInstance(cardId, upgrades);
    player.hand.push(instance);
    this.logAction(player, ActionType.ADD_CARD, `Added ${this.getCard(cardId)?.name ?? 'Unknown'} to hand`);
    return instance;
  }

  addCardToDrawPile(player: GamePlayer, cardId: string, upgrades: number = 0, top: boolean = false): CardInstance {
    const instance = this.createCardInstance(cardId, upgrades);
    if (top) {
      player.deck.push(instance);
    } else {
      player.deck.unshift(instance);
    }
    this.logAction(player, ActionType.ADD_CARD, `Added ${this.getCard(cardId)?.name ?? 'Unknown'} to draw pile`);
    return instance;
  }

  removeCardFromDeck(player: GamePlayer, cardInstanceId: string): CardInstance | undefined {
    const allPiles = [
      { pile: player.deck, name: 'deck' },
      { pile: player.hand, name: 'hand' },
      { pile: player.discardPile, name: 'discard' },
      { pile: player.exhaustPile, name: 'exhaust' },
    ];

    for (const { pile, name } of allPiles) {
      const index = pile.findIndex(c => c.id === cardInstanceId);
      if (index !== -1) {
        const [card] = pile.splice(index, 1);
        this.logAction(player, ActionType.REMOVE_CARD, `Removed ${this.getCard(card.cardId)?.name ?? 'Unknown'} from ${name}`);
        return card;
      }
    }
    return undefined;
  }

  upgradeCard(player: GamePlayer, cardInstanceId: string): boolean {
    const card = this.getCardInstance(cardInstanceId);
    if (!card || card.upgrades >= 2) return false;

    card.upgrades++;
    this.logAction(player, ActionType.UPGRADE_CARD, `Upgraded ${this.getCard(card.cardId)?.name ?? 'Unknown'}`);
    return true;
  }

  // ========================================================================
  // COMBAT HELPERS
  // ========================================================================

  startCombat(enemyId: string): void {
    const enemyData = this.enemyDatabase.get(enemyId);
    if (!enemyData) throw new Error(`Enemy not found: ${enemyId}`);

    const player = this.getCurrentPlayer();

    // Select initial intent
    const intent = this.selectEnemyIntent(enemyData);

    this.game.currentEnemy = {
      enemyId,
      currentHp: enemyData.maxHp,
      maxHp: enemyData.maxHp,
      block: 0,
      buffs: [],
      intent,
      intentIndex: 0,
    };

    this.game.turnPhase = TurnPhase.START;
    this.game.turnNumber = 1;
    this.game.turnStartTime = nowDate();
    this.game.turnTimeLimit = this.game.metadata.settings.turnTimeLimitHours * 60 * 60 * 1000;

    // Start of combat effects
    this.triggerRelics(player, 'on_combat_start');
    this.applyStartOfCombatEffects(player);

    // Draw initial hand
    this.drawCards(player, 5);

    this.logAction(player, ActionType.INSPECT, `Combat started vs ${enemyData.name}`);
  }

  selectEnemyIntent(enemy: Enemy): EnemyIntent {
    const validIntents = enemy.intentPattern.filter(i => i.probability > 0);
    const totalWeight = validIntents.reduce((sum, i) => sum + i.probability, 0);
    let random = this.rng.next() * totalWeight;

    for (const intent of validIntents) {
      random -= intent.probability;
      if (random <= 0) return intent;
    }

    return validIntents[validIntents.length - 1];
  }

  executeEnemyIntent(): void {
    const enemy = this.game.currentEnemy;
    if (!enemy) return;

    const enemyData = this.enemyDatabase.get(enemy.enemyId);
    if (!enemyData) return;

    const player = this.getCurrentPlayer();
    const intent = enemy.intent;

    switch (intent.type) {
      case 'attack':
        this.dealDamageToPlayer(player, intent.value + (enemy.buffs.find(buff => buff.type === BuffType.STRENGTH)?.stacks ?? 0));
        break;
      case 'buff':
        this.applyBuffToEnemy(enemy, BuffType.STRENGTH, intent.value);
        break;
      case 'debuff':
        this.applyDebuffToPlayer(player, BuffType.WEAK, intent.value);
        break;
      case 'special':
        // Handle special intents (spawn, split, etc.)
        this.handleSpecialIntent(enemy, intent);
        break;
    }

    // Select next intent
    enemy.intent = this.selectEnemyIntent(enemyData);
    enemy.intentIndex++;

    this.logAction(player, ActionType.INSPECT, `Enemy ${enemyData.name} used ${intent.description}`);
  }

  handleSpecialIntent(enemy: EnemyInstance, intent: EnemyIntent): void {
    // Handle special enemy abilities
    const enemyData = this.enemyDatabase.get(enemy.enemyId);
    if (!enemyData) return;

    switch (enemyData.id) {
      case 'gremlin_nob':
        if (intent.description.includes('Call for Backup')) {
          // Spawn a gremlin (simplified - just log)
          this.logAction(this.getCurrentPlayer(), ActionType.INSPECT, 'Gremlin Nob calls for backup!');
        }
        break;
      case 'slime_boss':
        if (intent.description.includes('Split')) {
          this.logAction(this.getCurrentPlayer(), ActionType.INSPECT, 'Slime Boss splits into two Small Slimes!');
        }
        break;
    }
  }

  // ========================================================================
  // DAMAGE & BLOCK
  // ========================================================================

  dealDamageToPlayer(player: GamePlayer, rawDamage: number): number {
    let damage = rawDamage;

    // Apply Vulnerable
    const vulnerable = player.buffs.find(b => b.type === BuffType.VULNERABLE);
    if (vulnerable) {
      damage = Math.ceil(damage * 1.5);
    }

    // Apply Weak (on enemy, but player might have it from confusion)
    const weak = player.buffs.find(b => b.type === BuffType.WEAK);
    if (weak) {
      damage = Math.floor(damage * 0.75);
    }

    // Block
    const blocked = Math.min(player.block, damage);
    player.block -= blocked;
    damage -= blocked;

    // Apply damage
    player.health = Math.max(0, player.health - damage);
    player.totalDamageTaken += damage;

    // Trigger on_damage_taken effects
    this.triggerRelics(player, 'on_damage_taken');
    this.applyThornsToAttacker(damage);

    this.logAction(player, ActionType.INSPECT, `Player took ${damage} damage (${blocked} blocked)`);
    return damage;
  }

  dealDamageToEnemy(enemy: EnemyInstance, rawDamage: number, source: GamePlayer): number {
    let damage = rawDamage;

    // Apply Strength
    const strength = source.buffs.find(b => b.type === BuffType.STRENGTH);
    if (strength) {
      damage += strength.stacks;
    }

    // Apply Vulnerable on enemy
    const vulnerable = enemy.buffs.find(b => b.type === BuffType.VULNERABLE);
    if (vulnerable) {
      damage = Math.ceil(damage * 1.5);
    }

    // Apply Weak on enemy
    const weak = enemy.buffs.find(b => b.type === BuffType.WEAK);
    if (weak) {
      damage = Math.floor(damage * 0.75);
    }

    // Block
    const blocked = Math.min(enemy.block, damage);
    enemy.block -= blocked;
    damage -= blocked;

    // Apply damage
    enemy.currentHp = Math.max(0, enemy.currentHp - damage);
    source.totalDamageDealt += damage;

    // Trigger on_damage_dealt effects
    this.triggerRelics(source, 'on_damage_dealt');

    this.logAction(source, ActionType.INSPECT, `Enemy took ${damage} damage (${blocked} blocked)`);
    return damage;
  }

  dealDamageToAllEnemies(rawDamage: number, source: GamePlayer): void {
    // In this simplified version, only one enemy at a time
    if (this.game.currentEnemy) {
      this.dealDamageToEnemy(this.game.currentEnemy, rawDamage, source);
    }
  }

  gainBlock(player: GamePlayer, amount: number): void {
    // Apply Dexterity (focus) - in STS, Dexterity increases block gained
    const dexterity = player.buffs.find(b => b.type === BuffType.DEXTERITY);
    if (dexterity) {
      amount += dexterity.stacks;
    }

    // Apply Frail
    const frail = player.buffs.find(b => b.type === BuffType.FRAIL);
    if (frail) {
      amount = Math.floor(amount * 0.75);
    }

    player.block += amount;
    player.totalBlockGained += amount;

    this.logAction(player, ActionType.GAIN_BLOCK, `Gained ${amount} block`);
  }

  applyThornsToAttacker(damageTaken: number): void {
    const player = this.getCurrentPlayer();
    const thorns = player.buffs.find(b => b.type === BuffType.THORNS);
    if (thorns && this.game.currentEnemy) {
      this.dealDamageToEnemy(this.game.currentEnemy, thorns.stacks, player);
      this.logAction(player, ActionType.INSPECT, `Thorns dealt ${thorns.stacks} damage`);
    }
  }

  // ========================================================================
  // BUFFS & DEBUFFS
  // ========================================================================

  applyBuffToPlayer(player: GamePlayer, type: BuffType, stacks: number, duration: number = -1): void {
    const existing = player.buffs.find(b => b.type === type);
    if (existing) {
      existing.stacks += stacks;
      if (duration > 0) existing.duration = Math.max(existing.duration, duration);
    } else {
      player.buffs.push({ type, stacks, duration });
    }
    this.logAction(player, ActionType.APPLY_BUFF, `Gained ${stacks} ${type}`);
  }

  applyBuffToEnemy(enemy: EnemyInstance, type: BuffType, stacks: number, duration: number = -1): void {
    const existing = enemy.buffs.find(b => b.type === type);
    if (existing) {
      existing.stacks += stacks;
      if (duration > 0) existing.duration = Math.max(existing.duration, duration);
    } else {
      enemy.buffs.push({ type, stacks, duration });
    }
    this.logAction(this.getCurrentPlayer(), ActionType.APPLY_BUFF, `Enemy gained ${stacks} ${type}`);
  }

  applyDebuffToPlayer(player: GamePlayer, type: BuffType, stacks: number, duration: number = -1): void {
    // Check Artifact relic
    const hasArtifact = player.relics.some(r => r.relicId === 'artifact' && r.active);
    if (hasArtifact) {
      const artifact = player.relics.find(r => r.relicId === 'artifact')!;
      artifact.active = false;
      this.logAction(player, ActionType.INSPECT, 'Artifact negated a debuff!');
      return;
    }

    this.applyBuffToPlayer(player, type, stacks, duration);
  }

  applyDebuffToEnemy(enemy: EnemyInstance, type: BuffType, stacks: number, duration: number = -1): void {
    this.applyBuffToEnemy(enemy, type, stacks, duration);
  }

  removeBuff(player: GamePlayer, type: BuffType, stacks: number = 1): void {
    const index = player.buffs.findIndex(b => b.type === type);
    if (index !== -1) {
      player.buffs[index].stacks -= stacks;
      if (player.buffs[index].stacks <= 0) {
        player.buffs.splice(index, 1);
      }
    }
  }

  tickBuffs(player: GamePlayer): void {
    player.buffs = player.buffs.filter(buff => {
      if (buff.duration > 0) {
        buff.duration--;
        return buff.duration > 0;
      }
      return true; // Permanent buffs stay
    });
  }

  tickEnemyBuffs(enemy: EnemyInstance): void {
    enemy.buffs = enemy.buffs.filter(buff => {
      if (buff.duration > 0) {
        buff.duration--;
        return buff.duration > 0;
      }
      return true;
    });
  }

  // ========================================================================
  // CARD PLAYING
  // ========================================================================

  canPlayCard(player: GamePlayer, cardInstance: CardInstance): boolean {
    const card = this.getCard(cardInstance.cardId);
    if (!card) return false;

    let cost = card.cost;
    if (cardInstance.modifiedCost !== undefined) {
      cost = cardInstance.modifiedCost;
    }

    // Check energy
    if (player.energy < cost) return false;

    // Check if exhausted
    if (cardInstance.exhausted) return false;

    return true;
  }

  playCard(action: PlayCardAction, player: GamePlayer): boolean {
    const cardInstance = player.hand.find(c => c.id === action.cardInstanceId);
    if (!cardInstance) return false;

    const card = this.getCard(cardInstance.cardId);
    if (!card) return false;

    if (!this.canPlayCard(player, cardInstance)) return false;

    // Pay cost
    let cost = card.cost;
    if (cardInstance.modifiedCost !== undefined) {
      cost = cardInstance.modifiedCost;
    }
    player.energy -= cost;
    player.totalCardsPlayed++;

    // Move card from hand to discard (unless it exhausts)
    const cardIndex = player.hand.findIndex(c => c.id === action.cardInstanceId);
    if (cardIndex !== -1) {
      player.hand.splice(cardIndex, 1);
    }

    // Determine target
    let target: GamePlayer | EnemyInstance | undefined;
    if (action.targetId) {
      if (this.game.currentEnemy?.enemyId === action.targetId) {
        target = this.game.currentEnemy;
      } else {
        target = this.game.players.find(p => p.id === action.targetId);
      }
    } else if (card.targetType === TargetType.ENEMY || card.targetType === TargetType.ALL_ENEMIES) {
      target = this.game.currentEnemy;
    } else {
      target = player;
    }

    // Apply card effects
    this.applyCardEffects(card, cardInstance, player, target);

    // Check for exhaust
    const shouldExhaust = card.type === CardType.STATUS ||
      card.rarity === CardRarity.BASIC && card.tags.includes('exhaust') ||
      player.buffs.some(b => b.type === BuffType.CORRUPTION && card.type === CardType.SKILL);

    if (shouldExhaust) {
      player.exhaustPile.push(cardInstance);
      this.logAction(player, ActionType.EXHAUST, `${card.name} exhausted`);
    } else {
      player.discardPile.push(cardInstance);
    }

    // Trigger relics
    this.triggerRelics(player, 'on_card_played');

    this.logAction(player, ActionType.PLAY_CARD, `Played ${card.name}`);
    return true;
  }

  applyCardEffects(card: Card, instance: CardInstance, source: GamePlayer, target?: GamePlayer | EnemyInstance): void {
    for (const effect of card.effects) {
      this.applyEffect(effect, source, target);
    }

    // Apply temporary effects
    if (instance.temporaryEffects) {
      for (const effect of instance.temporaryEffects) {
        this.applyEffect(effect, source, target);
      }
    }
  }

  applyEffect(effect: CardEffect, source: GamePlayer, target?: GamePlayer | EnemyInstance): void {
    const offensive = effect.type === EffectType.DAMAGE || effect.type === EffectType.APPLY_DEBUFF;
    const actualTarget = this.resolveTarget(effect.targetType ?? (offensive ? TargetType.SPECIFIC : TargetType.SELF), source, target);

    switch (effect.type) {
      case EffectType.DAMAGE:
        if (actualTarget && 'enemyId' in actualTarget) {
          this.dealDamageToEnemy(actualTarget, effect.value, source);
        } else if (actualTarget) {
          this.dealDamageToPlayer(actualTarget, effect.value);
        }
        break;

      case EffectType.HEAL:
        if (actualTarget) {
          const healAmount = Math.min(effect.value, actualTarget.maxHealth - actualTarget.health);
          actualTarget.health += healAmount;
          this.logAction(source, ActionType.HEAL, `Healed ${healAmount} HP`);
        }
        break;

      case EffectType.GAIN_BLOCK:
        if (actualTarget) {
          this.gainBlock(actualTarget, effect.value);
        }
        break;

      case EffectType.DRAW:
        this.drawCards(source, effect.value);
        break;

      case EffectType.DISCARD:
        // Random discard
        for (let i = 0; i < effect.value && source.hand.length > 0; i++) {
          const randomIndex = this.rng.nextInt(0, source.hand.length - 1);
          const [card] = source.hand.splice(randomIndex, 1);
          source.discardPile.push(card);
        }
        break;

      case EffectType.EXHAUST:
        if (actualTarget && actualTarget === source) {
          // Exhaust random card from hand
          if (source.hand.length > 0) {
            const randomIndex = this.rng.nextInt(0, source.hand.length - 1);
            const [card] = source.hand.splice(randomIndex, 1);
            source.exhaustPile.push(card);
          }
        }
        break;

      case EffectType.GAIN_ENERGY:
        source.energy = Math.min(source.maxEnergy, source.energy + effect.value);
        break;

      case EffectType.LOSE_ENERGY:
        source.energy = Math.max(0, source.energy - effect.value);
        break;

      case EffectType.APPLY_BUFF:
        if (effect.buffType && actualTarget) {
          if ('enemyId' in actualTarget) {
            this.applyBuffToEnemy(actualTarget, effect.buffType, effect.value, effect.buffDuration);
          } else {
            this.applyBuffToPlayer(actualTarget, effect.buffType, effect.value, effect.buffDuration);
          }
        }
        break;

      case EffectType.APPLY_DEBUFF:
        if (effect.buffType && actualTarget) {
          if ('enemyId' in actualTarget) {
            this.applyDebuffToEnemy(actualTarget, effect.buffType, effect.value, effect.buffDuration);
          } else {
            this.applyDebuffToPlayer(actualTarget, effect.buffType, effect.value, effect.buffDuration);
          }
        }
        break;

      case EffectType.REMOVE_BUFF:
        if (effect.buffType && actualTarget && 'enemyId' in actualTarget === false) {
          this.removeBuff(actualTarget, effect.buffType, effect.value);
        }
        break;

      case EffectType.REMOVE_DEBUFF:
        if (effect.buffType && actualTarget && 'enemyId' in actualTarget === false) {
          this.removeBuff(actualTarget, effect.buffType, effect.value);
        }
        break;

      case EffectType.ADD_CARD:
        if (actualTarget && 'enemyId' in actualTarget === false) {
          // Add random card (simplified)
          const commonCards = ASCENSION_CARDS.filter(c => c.rarity === CardRarity.COMMON);
          const randomCard = this.rng.nextChoice(commonCards);
          this.addCardToDiscard(actualTarget, randomCard.id);
        }
        break;

      case EffectType.UPGRADE_CARD:
        // Upgrade random card in hand
        if (source.hand.length > 0) {
          const randomIndex = this.rng.nextInt(0, source.hand.length - 1);
          this.upgradeCard(source, source.hand[randomIndex].id);
        }
        break;
    }
  }

  resolveTarget(
    targetType: TargetType | undefined,
    source: GamePlayer,
    defaultTarget?: GamePlayer | EnemyInstance
  ): GamePlayer | EnemyInstance | undefined {
    const type = targetType ?? TargetType.SELF;

    switch (type) {
      case TargetType.SELF:
        return source;
      case TargetType.ENEMY:
        return this.game.currentEnemy;
      case TargetType.ALL_ENEMIES:
        return this.game.currentEnemy; // Simplified - single enemy
      case TargetType.ALLY:
      case TargetType.ALL_ALLIES:
        return source; // Single player for now
      case TargetType.SPECIFIC:
        return defaultTarget;
      default:
        return source;
    }
  }

  // ========================================================================
  // TURN MANAGEMENT
  // ========================================================================

  startTurn(player: GamePlayer): void {
    player.turnNumber++;
    player.energy = player.maxEnergy;
    player.block = 0; // Block resets at start of turn (unless Barricade)

    // Check Barricade relic
    const hasBarricade = player.relics.some(r => r.relicId === 'barricade' && r.active);
    if (!hasBarricade) {
      player.block = 0;
    }

    // Draw cards
    this.drawCards(player, 5);

    // Tick buffs
    this.tickBuffs(player);

    // Trigger start of turn relics
    this.triggerRelics(player, 'on_turn_start');

    // Apply start of turn effects (e.g., Demonic Form)
    this.applyStartOfTurnEffects(player);

    this.game.turnPhase = TurnPhase.DRAW;
    this.logAction(player, ActionType.INSPECT, `Turn ${player.turnNumber} started`);
  }

  applyStartOfTurnEffects(player: GamePlayer): void {
    // Demonic Form
    const demonicForm = player.buffs.find(b => b.type === BuffType.STRENGTH && b.source === 'demonic_form');
    if (demonicForm) {
      this.applyBuffToPlayer(player, BuffType.STRENGTH, 2);
    }
  }

  applyStartOfCombatEffects(player: GamePlayer): void {
    // Burning Blood handled at combat end
    // Other relics handled via triggers
  }

  endTurn(player: GamePlayer): void {
    // Discard remaining hand
    while (player.hand.length > 0) {
      const card = player.hand.pop()!;
      card.exhausted = false;
      player.discardPile.push(card);
    }

    // Trigger end of turn relics
    this.triggerRelics(player, 'on_turn_end');

    // Lose temporary Strength (from Flex)
    const flexBuff = player.buffs.find(b => b.type === BuffType.STRENGTH && b.source === 'flex');
    if (flexBuff) {
      this.removeBuff(player, BuffType.STRENGTH, flexBuff.stacks);
      player.buffs = player.buffs.filter(b => b.source !== 'flex');
    }

    // Apply poison damage
    const poison = player.buffs.find(b => b.type === BuffType.POISON);
    if (poison) {
      this.dealDamageToPlayer(player, poison.stacks);
      this.removeBuff(player, BuffType.POISON, 1);
    }

    // Apply burn damage
    const burn = player.buffs.find(b => b.type === BuffType.BURN);
    if (burn) {
      this.dealDamageToPlayer(player, burn.stacks);
      this.removeBuff(player, BuffType.BURN, 1);
    }

    // Next player's turn
    this.advanceTurn();
  }

  advanceTurn(): void {
    this.game.currentPlayerIndex = (this.game.currentPlayerIndex + 1) % this.game.players.length;
    this.game.turnNumber++;
    this.game.turnPhase = TurnPhase.START;
    this.game.turnStartTime = nowDate();

    const nextPlayer = this.getCurrentPlayer();

    // Check for enemy turn (after all players have gone)
    if (this.game.currentPlayerIndex === 0 && this.game.currentEnemy) {
      this.executeEnemyIntent();
      this.tickEnemyBuffs(this.game.currentEnemy);
    }
    if (nextPlayer.health > 0) this.startTurn(nextPlayer);
  }

  // ========================================================================
  // RELIC SYSTEM
  // ========================================================================

  triggerRelics(player: GamePlayer, trigger: string): void {
    for (const relicInstance of player.relics) {
      if (!relicInstance.active) continue;

      const relic = this.relicDatabase.get(relicInstance.relicId);
      if (!relic) continue;

      for (const effect of relic.effects) {
        if (effect.trigger === trigger) {
          // Check condition
          if (effect.condition && !this.evaluateCondition(effect.condition, player)) {
            continue;
          }

          for (const eff of effect.effects) {
            this.applyEffect(eff, player, player);
          }
        }
      }
    }
  }

  evaluateCondition(condition: string, player: GamePlayer): boolean {
    // Relic predicates may compare a numeric player stat to a literal.
    const match = /^player\.(health|maxHealth|block|energy|turnNumber)\s*(<=|>=|===|==|<|>)\s*(\d+)$/.exec(condition.trim());
    if (!match) return condition.trim() === 'true';
    const value = player[match[1] as 'health' | 'maxHealth' | 'block' | 'energy' | 'turnNumber'];
    const limit = Number(match[3]);
    switch (match[2]) {
      case '<': return value < limit;
      case '>': return value > limit;
      case '<=': return value <= limit;
      case '>=': return value >= limit;
      default: return value === limit;
    }
  }

  addRelic(player: GamePlayer, relicId: string): void {
    const relic = this.relicDatabase.get(relicId);
    if (!relic) return;

    // Check if already have
    if (player.relics.some(r => r.relicId === relicId)) return;

    player.relics.push({ relicId, active: true });
    this.logAction(player, ActionType.INSPECT, `Obtained ${relic.name}`);
  }

  // ========================================================================
  // POTIONS
  // ========================================================================

  usePotion(action: UsePotionAction, player: GamePlayer): boolean {
    const potionIndex = player.potions.findIndex(p => p.id === action.potionInstanceId);
    if (potionIndex === -1) return false;

    const potionInstance = player.potions[potionIndex];
    const potion = this.getPotion(potionInstance.potionId);
    if (!potion) return false;

    if (potionInstance.charges <= 0) return false;

    potionInstance.charges--;
    if (potionInstance.charges <= 0) {
      player.potions.splice(potionIndex, 1);
    }

    // Apply potion effects
    for (const effect of potion.effects) {
      this.applyEffect(effect, player, player);
    }

    this.triggerRelics(player, 'on_potion_used');
    this.logAction(player, ActionType.USE_POTION, `Used ${potion.name}`);
    return true;
  }

  getPotion(potionId: string): Potion | undefined {
    // Potion database would be separate
    return undefined;
  }

  addPotion(player: GamePlayer, potionId: string): boolean {
    if (player.potions.length >= 3) return false; // Max 3 potions

    const potion = this.getPotion(potionId);
    if (!potion) return false;

    player.potions.push({ potionId, charges: potion.maxCharges });
    this.logAction(player, ActionType.INSPECT, `Obtained potion`);
    return true;
  }

  // ========================================================================
  // VICTORY / DEFEAT
  // ========================================================================

  checkVictory(): GameEndReason | null {
    const player = this.getCurrentPlayer();

    // Check player death
    if (player.health <= 0) {
      // Check for revival relics
      const centennial = player.relics.find(r => r.relicId === 'centennial_puzzle' && r.active);
      if (centennial) {
        centennial.active = false;
        player.health = 15;
        this.logAction(player, ActionType.INSPECT, 'Centennial Puzzle revived you!');
        return null;
      }
      return 'defeat';
    }

    // Check enemy death
    if (this.game.currentEnemy && this.game.currentEnemy.currentHp <= 0) {
      this.handleEnemyDefeated();
      return null;
    }

    return null;
  }

  handleEnemyDefeated(): void {
    const player = this.getCurrentPlayer();
    const enemy = this.game.currentEnemy!;
    const enemyData = this.enemyDatabase.get(enemy.enemyId)!;

    this.game.enemiesDefeated++;
    this.logAction(player, ActionType.INSPECT, `Defeated ${enemyData.name}!`);

    // Rewards
    const gold = this.rng.nextInt(enemyData.rewards.gold.min, enemyData.rewards.gold.max);
    player.gold += gold;
    player.totalGoldGained += gold;

    // Card reward
    // Simplified: just log
    this.logAction(player, ActionType.INSPECT, `Gained ${gold} gold`);

    // Relic reward chance
    if (enemyData.rewards.relics && this.rng.nextBoolean(enemyData.rewards.relics.probability)) {
      const commonRelics = ASCENSION_RELICS.filter(r => r.rarity === CardRarity.COMMON);
      const relic = this.rng.nextChoice(commonRelics);
      this.addRelic(player, relic.id);
    }

    // Potion reward chance
    if (enemyData.rewards.potions && this.rng.nextBoolean(enemyData.rewards.potions.probability)) {
      // Add potion
    }

    // Check for boss victory
    if (enemyData.tags.includes('boss')) {
      this.game.status = GameStatus.FINISHED;
      this.game.winner = player.userId;
      this.game.endReason = 'victory';
      this.logAction(player, ActionType.INSPECT, 'VICTORY!');
      return;
    }

    // Start next combat (simplified - would go to map)
    this.game.currentEnemy = undefined;
    this.game.turnPhase = TurnPhase.END;
  }

  checkDefeat(): GameEndReason | null {
    const player = this.getCurrentPlayer();
    if (player.health <= 0) {
      return 'defeat';
    }
    return null;
  }

  // ========================================================================
  // LOGGING
  // ========================================================================

  logAction(player: GamePlayer, action: ActionType, details: string, data?: Record<string, unknown>): void {
    const entry: GameLogEntry = {
      id: generateId(),
      turnNumber: this.game.turnNumber,
      playerIndex: this.game.currentPlayerIndex,
      action,
      details,
      timestamp: nowDate(),
      data,
    };
    this.game.log.push(entry);
  }

  // ========================================================================
  // SERIALIZATION
  // ========================================================================

  serialize(): Game {
    this.game.rngState = this.rng.getState();
    return { ...this.game };
  }

  static deserialize(game: Game): GameEngine {
    return new GameEngine(game);
  }
}

// ============================================================================
// GAME CREATION FACTORY
// ============================================================================

export function createAscensionGame(
  playerUserIds: string[],
  settings: GameSettings,
  seed?: string
): Game {
  const gameSeed = seed ?? generateId();
  const rng = new SeededRandom(gameSeed);

  const players: GamePlayer[] = playerUserIds.map((userId, index) => {
    const starterDeck = STARTER_DECKS.ironclad; // Default to Ironclad
    const deck = starterDeck.map(cardId => ({
      id: generateId(),
      cardId,
      upgrades: 0,
      exhausted: false,
    }));

    rng.shuffle(deck);

    return {
      id: generateId(),
      createdAt: nowDate(),
      updatedAt: nowDate(),
      gameId: '', // Will be set after game creation
      userId,
      seatIndex: index,
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
    };
  });

  const game: Game = {
    id: generateId(),
    createdAt: nowDate(),
    updatedAt: nowDate(),
    gameType: GameType.ASCENSION,
    status: GameStatus.WAITING,
    currentPlayerIndex: 0,
    turnNumber: 0,
    turnPhase: TurnPhase.START,
    turnStartTime: nowDate(),
    turnTimeLimit: settings.turnTimeLimitHours * 60 * 60 * 1000,
    players,
    maxPlayers: playerUserIds.length,
    seed: gameSeed,
    rngState: rng.getState(),
    enemiesDefeated: 0,
    floor: 0,
    act: 0,
    ascensionLevel: 0,
    modifiers: [],
    log: [],
    metadata: {
      isRanked: false,
      isPrivate: false,
      settings,
    },
  };

  // Set gameId on players
  players.forEach(p => { p.gameId = game.id; });

  return game;
}

export function createDailyRunGame(
  userId: string,
  date: string,
  seed: string,
  modifiers: GameModifier[] = []
): Game {
  const settings: GameSettings = {
    turnTimeLimitHours: 24,
    allowSpectators: true,
    allowChat: false,
    allowUndo: false,
    maxUndos: 0,
    difficulty: 'normal',
  };

  const game = createAscensionGame([userId], settings, seed);
  game.metadata.name = `Daily Run - ${date}`;
  game.metadata.isRanked = true;
  game.modifiers = modifiers;

  return game;
}