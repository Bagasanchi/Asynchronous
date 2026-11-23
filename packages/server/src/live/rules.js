import { GameEngine } from '../../../shared/src/game-logic'
import { board } from './combat'
export function fail(code, message) {
  throw Object.assign(new Error(message), { code })
}
export function summary(row, owner) {
  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    revision: row.revision,
    seat: row.host === owner ? 0 : 1,
    turnSeat: row.seat,
    updated: Number(row.updated),
  }
}
export function detail(row, owner) {
  if (owner !== row.host && owner !== row.guest) fail(404, 'Match unavailable.')
  return { ...summary(row, owner), board: board(JSON.parse(row.state)) }
}
export function advance(row, owner, body) {
  if (owner !== row.host && owner !== row.guest) fail(404, 'Match unavailable.')
  if (row.status !== 'active' || row.revision !== body.revision)
    fail(409, 'The board has changed. Review the latest turn.')
  if (owner !== (row.seat === 0 ? row.host : row.guest))
    fail(403, 'Your partner is playing this turn.')
  const engine = new GameEngine(JSON.parse(row.state))
  const player = engine.getCurrentPlayer()
  let nextSeat = row.seat
  if (body.action === 'end') {
    engine.endTurn(player)
    if (row.mode === 'duo') nextSeat = 1 - row.seat
  } else if (
    body.action !== 'card' ||
    !engine.playCard({ cardInstanceId: body.cardId, autoTarget: true }, player)
  )
    fail(400, 'This card cannot be played.')
  engine.checkVictory()
  const status =
    player.health <= 0
      ? 'defeat'
      : engine.getCurrentEnemy()
        ? 'active'
        : 'victory'
  return { state: JSON.stringify(engine.serialize()), status, nextSeat }
}
