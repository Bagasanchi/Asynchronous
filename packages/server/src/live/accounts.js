import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'
import { fail } from './rules'

const derive = promisify(scrypt)
const lifetime = 30 * 86400
const digest = (value) => createHash('sha256').update(value).digest('hex')
export function accountCookie(req, secure) {
  const name = secure ? '__Host-account' : 'account'
  const token = (req.headers.cookie || '')
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(name + '='))
    ?.slice(name.length + 1)
  return {
    digest: token && /^[\w-]{43}$/.test(token) ? digest(token) : null,
    header: (value) =>
      name +
      '=' +
      value +
      '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' +
      (value ? lifetime : 0) +
      (secure ? '; Secure' : ''),
  }
}
export async function currentAccount(db, cookie) {
  if (!cookie.digest) return null
  return db.one(
    'select a.id,a.username from @account_sessions s join @accounts a on s.account=a.id where s.digest=? and s.expires>?',
    [cookie.digest, Date.now()],
  )
}
export async function authenticate({
  db,
  path,
  body,
  guest,
  account,
  cookie,
  address,
  res,
}) {
  if (path === 'logout') {
    if (cookie.digest)
      await db.batch([
        ['delete from @account_sessions where digest=?', [cookie.digest]],
      ])
    res.setHeader('Set-Cookie', cookie.header(''))
    return
  }
  if (account) fail(409, 'Log out before switching accounts.')
  const username =
    typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
  if (!/^[a-z0-9_]{3,24}$/.test(username))
    fail(400, 'Use 3–24 letters, numbers or underscores for your username.')
  if (
    typeof body.password !== 'string' ||
    body.password.length < 12 ||
    body.password.length > 128
  )
    fail(400, 'Use a password with 12–128 characters.')
  const now = Date.now()
  await db.batch([
    ['delete from @login_limits where expires<=?', [now]],
    ['delete from @account_sessions where expires<=?', [now]],
  ])
  for (const [key, limit] of [
    ['ip:' + address, 40],
    ['name:' + username, 12],
  ]) {
    const row = await db.one(
      'insert into @login_limits(bucket,attempts,expires) values(?,1,?) on conflict(bucket) do update set attempts=login_limits.attempts+1 returning attempts',
      [digest(key), now + 600000],
    )
    if (row.attempts > limit)
      fail(429, 'Too many attempts. Try again in ten minutes.')
  }
  const signup = path === 'signup'
  const existing = signup
    ? null
    : await db.one('select * from @accounts where username=?', [username])
  const salt = existing?.salt || randomBytes(16).toString('hex')
  const hash = await derive(body.password, salt, 64, {
    N: 32768,
    r: 8,
    p: 3,
    maxmem: 64 * 1024 * 1024,
  })
  if (
    !signup &&
    (!existing || !timingSafeEqual(hash, Buffer.from(existing.verifier, 'hex')))
  )
    fail(401, 'Incorrect username or password.')
  const id = existing?.id || randomUUID()
  const token = randomBytes(32).toString('base64url')
  const commands = []
  if (signup) {
    commands.push(
      [
        'insert into @accounts(id,username,salt,verifier) values(?,?,?,?)',
        [id, username, salt, hash.toString('hex')],
      ],
      ['update @matches set host=? where host=?', [id, guest]],
      ['update @matches set guest=? where guest=?', [id, guest]],
      ['delete from @reminders where owner=?', [guest]],
      ['delete from @devices where owner=?', [guest]],
    )
  }
  commands.push([
    'insert into @account_sessions(digest,account,expires) values(?,?,?)',
    [digest(token), id, now + lifetime * 1000],
  ])
  try {
    await db.batch(commands)
  } catch (e) {
    if (signup && (e.code === '23505' || e.errcode === 2067))
      fail(409, 'That username is taken.')
    throw e
  }
  res.setHeader('Set-Cookie', cookie.header(token))
}
