import { accountCookie, currentAccount, authenticate } from './accounts'
import { createHash, randomBytes } from 'node:crypto'
import { waitUntil } from '@vercel/functions'
import { sendNotification } from 'web-push'
import { validSubscription } from './notifications'
import { detail, fail, summary } from './rules'
import { pool, one, uuid, create, mutate, transaction } from './cloud-store'

function accountSql(sql) {
  let index = 0
  return sql
    .replaceAll('@', 'asynchronous.')
    .replace(/\?/g, () => '$' + ++index)
}
const authDb = {
  one(sql, args) {
    return one(pool, accountSql(sql), args)
  },
  batch(commands) {
    return transaction(async (client) => {
      for (const [sql, args] of commands)
        await client.query(accountSql(sql), args)
    })
  },
}
async function deliver() {
  // Lease before delivery so a stopped function leaves a retryable job.
  const jobs = (
    await pool.query(
      `with ready as (
 select match from asynchronous.reminders where due <= $1 order by due limit 5 for update skip locked
 ) update asynchronous.reminders r set due=$2 from ready,asynchronous.devices d
 where r.match=ready.match and d.owner=r.owner returning r.*,d.subscription`,
      [Date.now(), Date.now() + 60000],
    )
  ).rows
  await Promise.all(
    jobs.map(async (j) => {
      try {
        await sendNotification(
          JSON.parse(j.subscription),
          JSON.stringify({ match: j.match }),
          {
            TTL: 3600,
            timeout: 5000,
            vapidDetails: {
              subject: 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL,
              publicKey: process.env.VAPID_PUBLIC_KEY,
              privateKey: process.env.VAPID_PRIVATE_KEY,
            },
          },
        )
      } catch (e) {
        if ([404, 410].includes(e.statusCode))
          await pool.query(
            'delete from asynchronous.devices where owner=$1 and subscription=$2',
            [j.owner, j.subscription],
          )
        else if (j.attempts < 5) {
          await pool.query(
            'update asynchronous.reminders set attempts=attempts+1,due=$1 where match=$2 and revision=$3',
            [Date.now() + 30000 * 2 ** j.attempts, j.match, j.revision],
          )
          return
        }
      }
      await pool.query(
        'delete from asynchronous.reminders where match=$1 and revision=$2',
        [j.match, j.revision],
      )
    }),
  )
}
function bodyOf(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json')
    fail(415, 'Send JSON.')
  if (Number(req.headers['content-length']) > 8192)
    fail(413, 'Request too large.')
  let value = req.body
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      fail(400, 'Invalid JSON object.')
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(400, 'Invalid JSON object.')
  if (Buffer.byteLength(JSON.stringify(value)) > 8192)
    fail(413, 'Request too large.')
  return value
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  const path = req.query.route
  try {
    if (req.method === 'GET' && path === 'health') {
      await pool.query('select id from asynchronous.matches limit 0')
      return res.json({ ok: true })
    }
    if (req.method === 'GET' && path === 'reminders') {
      if (
        !process.env.CRON_SECRET ||
        req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET
      )
        fail(401, 'Unauthorized.')
      await deliver()
      return res.json({ ok: true })
    }
    let token = /(?:^|;\s*)__Host-table=([\w-]{43})(?:;|$)/.exec(
      req.headers.cookie || '',
    )?.[1]
    if (!token) {
      if (req.method !== 'GET' || path !== 'session')
        fail(401, 'Open the lobby to start a session.')
      token = randomBytes(32).toString('base64url')
      res.setHeader(
        'Set-Cookie',
        '__Host-table=' +
          token +
          '; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=31536000',
      )
    }
    const guest = createHash('sha256').update(token).digest('hex')
    const cookie = accountCookie(req, true)
    const account = await currentAccount(authDb, cookie)
    const owner = account?.id || guest
    if (req.method === 'GET' && path === 'session') {
      const rows = (
        await pool.query(
          'select id,mode,status,revision,host,seat,updated from asynchronous.matches where host=$1 or guest=$1 order by updated desc limit 60',
          [owner],
        )
      ).rows
      const subscribed = !!(await one(
        pool,
        'select 1 from asynchronous.devices where owner=$1',
        [owner],
      ))
      return res.json({
        username: account?.username || null,
        matches: rows.map((r) => summary(r, owner)),
        pushKey: process.env.VAPID_PUBLIC_KEY || null,
        subscribed,
      })
    }
    const [resource, id, action, extra] = String(path).split('/')
    if (extra !== undefined || (id && !uuid.test(id)))
      fail(404, 'Match unavailable.')
    if (req.method === 'GET' && resource === 'matches' && id && !action) {
      const row = await one(
        pool,
        'select * from asynchronous.matches where id=$1 and (host=$2 or guest=$2)',
        [id, owner],
      )
      if (!row) fail(404, 'Match unavailable.')
      return res.json(detail(row, owner))
    }
    if (req.method !== 'POST') fail(404, 'Page unavailable.')
    if (req.headers.origin !== 'https://' + req.headers.host)
      fail(403, 'Origin mismatch.')
    const body = bodyOf(req)
    if (['signup', 'login', 'logout'].includes(path)) {
      await authenticate({
        db: authDb,
        path: path,
        body,
        guest,
        account,
        cookie,
        res,
        address:
          req.headers['x-vercel-forwarded-for'] || req.socket.remoteAddress,
      })
      return res.json({ ok: true })
    }
    if (path === 'notifications') {
      if (!body.subscription)
        await pool.query('delete from asynchronous.devices where owner=$1', [
          owner,
        ])
      else {
        if (
          !process.env.VAPID_PUBLIC_KEY ||
          !validSubscription(body.subscription)
        )
          fail(400, 'Unsupported push subscription.')
        await pool.query(
          'insert into asynchronous.devices values($1,$2) on conflict(owner) do update set subscription=excluded.subscription',
          [owner, JSON.stringify(body.subscription)],
        )
      }
      return res.json({ ok: true })
    }
    if (path === 'matches') return res.json(await create(owner, body))
    if (resource === 'matches' && id && ['join', 'move'].includes(action)) {
      const result = await mutate(owner, id, action, body)
      if (action === 'join' || body.action === 'end')
        waitUntil(
          deliver().catch((e) =>
            console.error('Reminder delivery deferred', e.code),
          ),
        )
      return res.json(result)
    }
    fail(404, 'Page unavailable.')
  } catch (e) {
    const code = Number.isInteger(e.code) ? e.code : 500
    if (code === 500) console.error('Game API error', e.name, e.code, e.message)
    res
      .status(code)
      .json({ error: code === 500 ? 'Server error. Please retry.' : e.message })
  }
}
