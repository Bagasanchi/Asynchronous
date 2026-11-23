import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ASCENSION_ENEMIES, createAscensionGame, GameEngine } from '../../shared/src/game-logic'
import { GameStatus, PlayerStatus } from '../../shared/src/enums'
import './solo.css'

const opponent = ASCENSION_ENEMIES.find(enemy => enemy.id === 'cultist')!

function newMatch() {
  const game = createAscensionGame(['local'], {
    turnTimeLimitHours: 24, difficulty: 'normal', allowChat: false,
    allowSpectators: false, allowUndo: false, maxUndos: 0,
  })
  const engine = new GameEngine(game)
  game.status = GameStatus.ACTIVE
  game.players[0].status = PlayerStatus.ACTIVE
  game.players[0].turnNumber = 1
  engine.startCombat(opponent.id)
  return engine
}

function Match() {
  const [engine, setEngine] = useState(newMatch)
  const [, refresh] = useState(0)
  const game = engine.getGame()
  const player = engine.getCurrentPlayer()
  const enemy = engine.getCurrentEnemy()
  const finished = !enemy || player.health === 0
  function move(action: () => void) {
    if (finished) return
    action()
    engine.checkVictory()
    refresh(value => value + 1)
  }
  const strength = enemy?.buffs.find(buff => buff.type === 'strength')?.stacks ?? 0
  return <main>
    <header><h1>Asynchronous</h1><span>Solo encounter</span></header>
    <section className="arena">
      <small>Turn {game.turnNumber}</small>
      <h2>{finished ? (player.health === 0 ? 'Defeat' : 'Victory') : opponent.name}</h2>
      {enemy && <><p>{enemy.currentHp} / {enemy.maxHp} health</p>
        <progress value={enemy.currentHp} max={enemy.maxHp} aria-label="Enemy health" />
        {!finished && <p>Next move · {enemy.intent.type === 'attack' ? 'Attack for ' + (enemy.intent.value + strength) : enemy.intent.description}</p>}
        {enemy.buffs.map(buff => <span className="buff" key={buff.type}>{buff.type} {buff.stacks}</span>)}</>}
      {!enemy && <p>You defeated the Cultist.</p>}
    </section>
    <section><div className="row"><h2>Ironclad</h2>{finished ? <button onClick={() => setEngine(newMatch())}>Play again</button> :
      <button onClick={() => move(() => engine.endTurn(player))}>End turn</button>}</div>
      <p className="stats">{player.health} / {player.maxHealth} health　·　{player.block} block　·　{player.energy} / {player.maxEnergy} energy</p>
      {!finished && <><h3>Your hand</h3><div className="hand">{player.hand.map(instance => {
        const card = engine.getCard(instance.cardId)!
        return <button className={'card ' + card.type} key={instance.id} disabled={!engine.canPlayCard(player, instance)}
          onClick={() => move(() => engine.playCard({cardInstanceId: instance.id, autoTarget: true}, player))}>
          <small>{card.type} · {card.cost} energy</small><strong>{card.name}</strong><span>{card.description}</span>
        </button>
      })}</div><p>Draw pile {player.deck.length}　·　Discard pile {player.discardPile.length}</p></>}
    </section>
    <details><summary>Combat log</summary><ol reversed>{[...game.log].reverse().map(entry => <li key={entry.id}>{entry.details}</li>)}</ol></details>
  </main>
}
createRoot(document.getElementById('root')!).render(<Match />)
