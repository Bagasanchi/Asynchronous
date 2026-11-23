/**
 * Card database and utilities
 */

import { ASCENSION_CARDS, ASCENSION_RELICS, ASCENSION_ENEMIES, STARTER_DECKS } from './game-logic';
import { Card, Relic, Enemy, GameType } from './types';

// Export all card data
export { ASCENSION_CARDS, ASCENSION_RELICS, ASCENSION_ENEMIES, STARTER_DECKS };

// Database maps for fast lookup
export const cardDatabase = new Map<string, Card>(
  ASCENSION_CARDS.map(c => [c.id, c])
);

export const relicDatabase = new Map<string, Relic>(
  ASCENSION_RELICS.map(r => [r.id, r])
);

export const enemyDatabase = new Map<string, Enemy>(
  ASCENSION_ENEMIES.map(e => [e.id, e])
);

export const starterDecks = STARTER_DECKS;

/**
 * Get all cards for a specific game type
 */
export function getCardsByGameType(gameType: GameType): Card[] {
  return ASCENSION_CARDS.filter(c => c.gameType === gameType);
}

/**
 * Get cards by rarity
 */
export function getCardsByRarity(gameType: GameType, rarity: string): Card[] {
  return ASCENSION_CARDS.filter(c => c.gameType === gameType && c.rarity === rarity);
}

/**
 * Get cards by type
 */
export function getCardsByType(gameType: GameType, type: string): Card[] {
  return ASCENSION_CARDS.filter(c => c.gameType === gameType && c.type === type);
}

/**
 * Get starter deck for a character
 */
export function getStarterDeck(character: string): string[] {
  return STARTER_DECKS[character] || STARTER_DECKS.ironclad;
}

/**
 * Search cards by name or description
 */
export function searchCards(gameType: GameType, query: string): Card[] {
  const lowerQuery = query.toLowerCase();
  return ASCENSION_CARDS.filter(c =>
    c.gameType === gameType &&
    (c.name.toLowerCase().includes(lowerQuery) ||
     c.description.toLowerCase().includes(lowerQuery) ||
     c.tags.some(t => t.toLowerCase().includes(lowerQuery)))
  );
}

/**
 * Get random card of specific rarity
 */
export function getRandomCard(gameType: GameType, rarity: string, rng: () => number = Math.random): Card {
  const cards = getCardsByRarity(gameType, rarity);
  return cards[Math.floor(rng() * cards.length)];
}

/**
 * Get card by ID
 */
export function getCardById(id: string): Card | undefined {
  return cardDatabase.get(id);
}

/**
 * Get relic by ID
 */
export function getRelicById(id: string): Relic | undefined {
  return relicDatabase.get(id);
}

/**
 * Get enemy by ID
 */
export function getEnemyById(id: string): Enemy | undefined {
  return enemyDatabase.get(id);
}

/**
 * Get all relics for a game type
 */
export function getRelicsByGameType(gameType: GameType): Relic[] {
  return ASCENSION_RELICS.filter(r => r.gameType === gameType);
}

/**
 * Get all enemies for a game type
 */
export function getEnemiesByGameType(gameType: GameType): Enemy[] {
  return ASCENSION_ENEMIES.filter(e => e.gameType === gameType);
}

/**
 * Get enemies by tag
 */
export function getEnemiesByTag(gameType: GameType, tag: string): Enemy[] {
  return ASCENSION_ENEMIES.filter(e => e.gameType === gameType && e.tags.includes(tag));
}

/**
 * Get card upgrade
 */
export function getCardUpgrade(cardId: string, upgradeLevel: number): Card | undefined {
  const card = getCardById(cardId);
  if (!card || !card.upgrades || upgradeLevel < 1 || upgradeLevel > card.upgrades.length) {
    return undefined;
  }
  const upgrade = card.upgrades[upgradeLevel - 1];
  return {
    ...card,
    name: upgrade.name,
    description: upgrade.description,
    effects: upgrade.effects,
    cost: card.cost + (upgrade.costChange ?? 0),
  };
}