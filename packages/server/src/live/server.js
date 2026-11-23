import { createServer } from 'node:http'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {detail, summary, fail, advance} from './rules'
import { startCombat } from './combat'
import { notifications, validSubscription } from './notifications'

const directory = resolve(process.env.DATA_DIR || 'data')
mkdirSync(directory, { recursive: true })
const db = new DatabaseSync(join(directory, 'tables.sqlite'))
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS matches (
 id TEXT PRIMARY KEY, host TEXT NOT NULL, guest TEXT, mode TEXT NOT NULL, status TEXT NOT NULL,
 seat INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL, updated INTEGER NOT NULL,
 request TEXT NOT NULL, UNIQUE(host,request));
 CREATE INDEX IF NOT EXISTS matches_host ON matches(host,updated);
 CREATE INDEX IF NOT EXISTS matches_guest ON matches(guest,updated);
 CREATE INDEX IF NOT EXISTS matches_updated ON matches(updated);`)
const push = notifications(db)
const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST || '127.0.0.1'
const origin =
  process.env.PUBLIC_ORIGIN && new URL(process.env.PUBLIC_ORIGIN).origin
if (process.env.NODE_ENV === 'production' && !origin)
  throw Error('Set PUBLIC_ORIGIN to the external site origin')
const files = new Map()
const dir = join(__dirname, 'public')
for (const file of [
  'index.html',
  'sw.js',
  ...readdirSync(join(dir, 'assets')).map((x) => 'assets/' + x),
]) {
  files.set(file === 'index.html' ? '/' : '/' + file, {
    content: readFileSync(join(dir, file)),
    type: file.endsWith('.html')
      ? 'text/html'
      : file.endsWith('.css')
        ? 'text/css'
        : 'text/javascript',
  })
}
function lookup(id) {
  return (
    db.prepare('SELECT * FROM matches WHERE id=?').get(id) ||
    fail(404, 'Match unavailable.')
  )
}
function remind(row, owner) {
  db.prepare('DELETE FROM reminders WHERE match=?').run(row.id)
  if (row.status === 'active' && row.mode === 'duo')
    db.prepare(
      'INSERT INTO reminders(match,owner,revision,due) SELECT ?,owner,?,? FROM devices WHERE owner=?',
    ).run(row.id, row.revision, Date.now(), owner)
}
function transaction(fn) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}
async function payload(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json')
    fail(415, 'Send JSON.')
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 8192) fail(413, 'Request too large.')
    chunks.push(chunk)
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString())
    if (value && typeof value === 'object' && !Array.isArray(value))
      return value
  } catch {}
  fail(400, 'Invalid JSON object.')
}
const matchPath = /^\/api\/matches\/([a-f0-9-]{36})(?:\/(join|move))?$/
const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
  )
  function json(data) {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(data))
  }
  try {
    const path = req.url.split('?')[0]
    if (req.method === 'GET') {
      if (path === '/health') {
        db.prepare('SELECT 1').get()
        return json({ ok: true })
      }
      const file = files.get(path)
      if (file) {
        if (path.startsWith('/assets/'))
          res.setHeader('Cache-Control', 'public,max-age=31536000,immutable')
        res.setHeader('Content-Type', file.type + '; charset=utf-8')
        return res.end(file.content)
      }
    }
    const cookieName = origin?.startsWith('https:') ? '__Host-table' : 'table'
    let token = (req.headers.cookie || '')
      .split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookieName + '='))
      ?.slice(cookieName.length + 1)
    if (!token || !/^[\w-]{43}$/.test(token)) {
      if (path !== '/api/session' || req.method !== 'GET')
        fail(401, 'Open the lobby to start a session.')
      token = randomBytes(32).toString('base64url')
      res.setHeader(
        'Set-Cookie',
        cookieName +
          '=' +
          token +
          '; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000' +
          (origin?.startsWith('https:') ? '; Secure' : ''),
      )
    }
    const owner = createHash('sha256').update(token).digest('hex')
    if (req.method === 'GET' && path === '/api/session') {
      const rows = db
        .prepare(
          'SELECT id,mode,status,revision,host,seat,updated FROM matches WHERE host=? OR guest=? ORDER BY updated DESC LIMIT 60',
        )
        .all(owner, owner)
      return json({
        matches: rows.map((r) => summary(r, owner)),
        pushKey: push.publicKey,
        subscribed: !!db
          .prepare('SELECT 1 FROM devices WHERE owner=?')
          .get(owner),
      })
    }
    const route = matchPath.exec(path)
    if (req.method === 'GET' && route && !route[2])
      return json(detail(lookup(route[1]), owner))
    if (req.method !== 'POST') fail(404, 'Page unavailable.')
    if (req.headers.origin !== (origin || 'http://' + req.headers.host))
      fail(403, 'Origin mismatch.')
    const body = await payload(req)
    if (path === '/api/notifications') {
      if (!body.subscription) {
        db.prepare('DELETE FROM devices WHERE owner=?').run(owner)
        db.prepare('DELETE FROM reminders WHERE owner=?').run(owner)
      } else {
        if (!push.publicKey || !validSubscription(body.subscription))
          fail(400, 'Unsupported push subscription.')
        db.prepare('INSERT OR REPLACE INTO devices VALUES(?,?)').run(
          owner,
          JSON.stringify(body.subscription),
        )
      }
      return json({ ok: true })
    }
    const result = transaction(() => {
      if (path === '/api/matches') {
        if (
          !['duo', 'solo'].includes(body.mode) ||
          !/^[a-f0-9-]{36}$/.test(body.requestId)
        )
          fail(400, 'Invalid match request.')
        const existing = db
          .prepare('SELECT * FROM matches WHERE host=? AND request=?')
          .get(owner, body.requestId)
        if (existing) return detail(existing, owner)
        const recent = db
          .prepare('SELECT count(*) AS total FROM matches WHERE updated>?')
          .get(Date.now() - 60000)
        const personal = db
          .prepare(
            'SELECT count(*) AS total FROM matches WHERE host=? AND updated>?',
          )
          .get(owner, Date.now() - 60000)
        if (recent.total >= 120 || personal.total >= 10)
          fail(429, 'Too many new matches. Try again in a minute.')
        const id = randomUUID()
        db.prepare(
          'INSERT INTO matches(id,host,mode,status,state,updated,request) VALUES(?,?,?,?,?,?,?)',
        ).run(
          id,
          owner,
          body.mode,
          body.mode === 'solo' ? 'active' : 'waiting',
          JSON.stringify(startCombat()),
          Date.now(),
          body.requestId,
        )
        return detail(lookup(id), owner)
      }
      if (!route) fail(404, 'Page unavailable.')
      const row = lookup(route[1])
      if (route[2] === 'join') {
        if (owner === row.host || owner === row.guest) return detail(row, owner)
        if (row.status !== 'waiting')
          fail(409, 'This invitation has already been claimed.')
        db.prepare(
          "UPDATE matches SET guest=?,status='active',revision=revision+1,updated=? WHERE id=?",
        ).run(owner, Date.now(), row.id)
        const next = lookup(row.id)
        remind(next, row.host)
        return detail(next, owner)
      }
      if (route[2] !== 'move') fail(404, 'Page unavailable.')
      const {state, status, nextSeat} = advance(row, owner, body)
      db.prepare(
        'UPDATE matches SET state=?,status=?,seat=?,revision=revision+1,updated=? WHERE id=?',
      ).run(
        state,
        status,
        nextSeat,
        Date.now(),
        row.id,
      )
      const next = lookup(row.id)
      if (nextSeat !== row.seat || status !== 'active')
        remind(next, nextSeat === 0 ? row.host : row.guest)
      else db.prepare('DELETE FROM reminders WHERE match=?').run(row.id)
      return detail(next, owner)
    })
    json(result)
  } catch (err) {
    const code = Number.isInteger(err.code) ? err.code : 500
    if (code === 500) console.error(err.stack)
    res.statusCode = code
    json({ error: code === 500 ? 'Server error. Please retry.' : err.message })
  }
})
server.requestTimeout = 15000
server.headersTimeout = 10000
server.listen(port, host, () =>
  console.log('Listening on port ' + server.address().port),
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    push.close()
    server.close(() => {
      db.close()
      process.exit(0)
    })
  })
