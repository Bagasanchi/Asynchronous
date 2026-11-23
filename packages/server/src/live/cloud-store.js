import { Pool } from 'pg'
import ca from './supabase-ca.pem'
import { randomUUID } from 'node:crypto'
import { startCombat } from './combat'
import { advance, detail, fail } from './rules'

export const pool = new Pool({
  connectionString: process.env.GAME_DATABASE_URL,
  ssl: { ca, rejectUnauthorized: true },
  max: 2,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 8000,
})
pool.on('error', (err) =>
  console.error('Idle database connection closed', err.code),
)
export const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
async function transaction(fn) {
  const c = await pool.connect()
  try {
    await c.query('begin')
    const value = await fn(c)
    await c.query('commit')
    return value
  } catch (e) {
    await c.query('rollback')
    throw e
  } finally {
    c.release()
  }
}
export async function one(c, query, values) {
  return (await c.query(query, values)).rows[0]
}
export async function create(owner, body) {
  if (!uuid.test(body.requestId) || !['solo', 'duo'].includes(body.mode))
    fail(400, 'Invalid match request.')
  return transaction(async (c) => {
    await c.query('select pg_advisory_xact_lock(5912340)')
    const existing = await one(
      c,
      'select * from asynchronous.matches where host=$1 and request=$2',
      [owner, body.requestId],
    )
    if (existing) return detail(existing, owner)
    const counts = await one(
      c,
      'select count(*) as total,count(*) filter(where host=$1) as personal from asynchronous.matches where updated>$2',
      [owner, Date.now() - 60000],
    )
    if (counts.total >= 120 || counts.personal >= 10)
      fail(429, 'Too many new matches. Try again in a minute.')
    const row = await one(
      c,
      'insert into asynchronous.matches(id,host,mode,status,state,updated,request) values($1,$2,$3,$4,$5,$6,$7) returning *',
      [
        randomUUID(),
        owner,
        body.mode,
        body.mode === 'duo' ? 'waiting' : 'active',
        JSON.stringify(startCombat()),
        Date.now(),
        body.requestId,
      ],
    )
    return detail(row, owner)
  })
}
export async function mutate(owner, id, action, body) {
  return transaction(async (c) => {
    let row = await one(
      c,
      'select * from asynchronous.matches where id=$1 for update',
      [id],
    )
    if (!row) fail(404, 'Match unavailable.')
    let handoff = false
    if (action === 'join') {
      if ([row.host, row.guest].includes(owner)) return detail(row, owner)
      if (row.status !== 'waiting')
        fail(409, 'This invitation has already been claimed.')
      row = await one(
        c,
        "update asynchronous.matches set guest=$1,status='active',revision=revision+1,updated=$2 where id=$3 returning *",
        [owner, Date.now(), id],
      )
      handoff = true
    } else {
      const next = advance(row, owner, body)
      handoff = next.nextSeat !== row.seat && next.status === 'active'
      row = await one(
        c,
        'update asynchronous.matches set state=$1,status=$2,seat=$3,revision=revision+1,updated=$4 where id=$5 returning *',
        [next.state, next.status, next.nextSeat, Date.now(), id],
      )
    }
    await c.query('delete from asynchronous.reminders where match=$1', [id])
    if (handoff)
      await c.query(
        'insert into asynchronous.reminders(match,owner,revision,due) select $1,owner,$2,$3 from asynchronous.devices where owner=$4',
        [id, row.revision, Date.now(), row.seat === 0 ? row.host : row.guest],
      )
    return detail(row, owner)
  })
}
