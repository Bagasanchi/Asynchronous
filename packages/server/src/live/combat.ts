import { createAscensionGame, GameEngine } from '../../../shared/src/game-logic'
import { GameStatus } from '../../../shared/src/enums'

export function startCombat() {
  const game = createAscensionGame(['ironclad'], {
    turnTimeLimitHours: 24,
    difficulty: 'normal',
    allowChat: false,
    allowSpectators: false,
    allowUndo: false,
    maxUndos: 0,
  })
  game.status = GameStatus.ACTIVE
  game.players[0].turnNumber = 1
  const engine = new GameEngine(game)
  engine.startCombat('cultist')
  return engine.serialize()
}

export function board(game: ReturnType<typeof startCombat>) {
  const engine = new GameEngine(game)
  const player = engine.getCurrentPlayer()
  const enemy = engine.getCurrentEnemy()
  const strength =
    enemy?.buffs.find((buff) => buff.type === 'strength')?.stacks ?? 0
  return {
    turn: game.turnNumber,
    health: player.health,
    block: player.block,
    energy: player.energy,
    enemyHealth: enemy?.currentHp ?? 0,
    intent:
      enemy?.intent.type === 'attack'
        ? 'Attack for ' + (enemy.intent.value + strength)
        : enemy?.intent.description,
    buffs: enemy?.buffs ?? [],
    deck: player.deck.length,
    discard: player.discardPile.length,
    hand: player.hand.map((instance) => {
      const card = engine.getCard(instance.cardId)!
      return {
        id: instance.id,
        name: card.name,
        cost: card.cost,
        type: card.type,
        description: card.description,
      }
    }),
    log: game.log
      .slice(-32)
      .reverse()
      .map((entry) => entry.details),
  }
}
