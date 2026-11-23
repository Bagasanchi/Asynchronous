import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'

test(
  'release serves a complete encounter and recovers both seats after restart',
  { timeout: 60000 },
  async (t) => {
    const data = await mkdtemp(join(tmpdir(), 'asynchronous-'))
    let proc, base
    let activeDirectory = data
    async function start() {
      proc = spawn(process.execPath, ['release/server.cjs'], {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          PUBLIC_ORIGIN: '',
          HOST: '127.0.0.1',
          PORT: '0',
          DATA_DIR: activeDirectory,
          VAPID_SUBJECT: 'mailto:operator@example.org',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const port = await new Promise((resolve, reject) => {
        proc.stdout.on('data', (chunk) => {
          const m = /Listening on port (\d+)/.exec(chunk)
          if (m) resolve(m[1])
        })
        proc.stderr.on('data', (chunk) => {
          if (!String(chunk).includes('ExperimentalWarning'))
            process.stderr.write(chunk)
        })
        proc.once('exit', (code) => reject(Error('Server exited ' + code)))
      })
      base = 'http://127.0.0.1:' + port
    }
    async function stop() {
      if (proc && proc.exitCode === null && !proc.signalCode) {
        const done = once(proc, 'exit')
        proc.kill()
        await done
      }
    }
    t.after(async () => {
      await stop()
      await rm(data, { recursive: true, force: true })
    })
    await start()
    const html = await (await fetch(base)).text()
    for (const [, asset] of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g))
      assert.equal((await fetch(base + asset)).status, 200)
    assert.match(html, /\/assets\/table-.*\.js/)
    assert.equal((await fetch(base + '/health')).status, 200)
    async function session() {
      const response = await fetch(base + '/api/session')
      return response.headers.get('set-cookie').split(';')[0]
    }
    const [host, guest, stranger] = await Promise.all([
      session(),
      session(),
      session(),
    ])
    async function api(cookie, path, body, status = 200, origin = base) {
      const r = await fetch(
        base + '/api/' + path,
        body === undefined
          ? { headers: { cookie } }
          : {
              method: 'POST',
              headers: { cookie, origin, 'content-type': 'application/json' },
              body: JSON.stringify(body),
            },
      )
      const value = await r.json()
      assert.equal(r.status, status, JSON.stringify(value))
      return value
    }
    const request = { mode: 'duo', requestId: randomUUID() }
    await api(host, 'matches', request, 403, 'https://elsewhere.invalid')
    const match = await api(host, 'matches', request)
    assert.equal((await api(host, 'matches', request)).id, match.id)
    assert.equal(match.status, 'waiting')
    const path = 'matches/' + match.id
    await api(stranger, path, undefined, 404)
    let m = await api(guest, path + '/join', {})
    await api(stranger, path + '/join', {}, 409)
    assert.equal(m.seat, 1)
    const end = { action: 'end', revision: m.revision }
    await api(guest, path + '/move', end, 403)
    await Promise.all(
      [0, 1].map(async () =>
        fetch(base + '/api/' + path + '/move', {
          method: 'POST',
          headers: {
            cookie: host,
            origin: base,
            'content-type': 'application/json',
          },
          body: JSON.stringify(end),
        }),
      ),
    ).then((rr) => assert.deepEqual(rr.map((r) => r.status).sort(), [200, 409]))
    m = await api(guest, path)
    assert.equal(m.turnSeat, 1)
    const key = (await api(guest, 'session')).pushKey
    await stop()
    await start()
    assert.deepEqual(await api(guest, path), m)
    assert.equal((await api(guest, 'session')).pushKey, key)
    while (m.status === 'active' && m.board.turn < 40) {
      const card = m.board.hand.find(
        (c) => c.type === 'attack' && c.cost <= m.board.energy,
      )
      m = await api(m.turnSeat === 0 ? host : guest, path + '/move', {
        action: card ? 'card' : 'end',
        cardId: card?.id,
        revision: m.revision,
      })
    }
    assert.equal(m.status, 'victory')
    await api(
      host,
      path + '/move',
      { revision: m.revision, action: 'end' },
      409,
    )
    let solo = await api(host, 'matches', {
      mode: 'solo',
      requestId: randomUUID(),
    })
    const soloPath = 'matches/' + solo.id + '/move'
    await api(
      host,
      soloPath,
      { action: 'card', cardId: 'missing', revision: 0 },
      400,
    )
    while (solo.status === 'active' && solo.board.turn < 60)
      solo = await api(host, soloPath, {
        action: 'end',
        revision: solo.revision,
      })
    assert.equal(solo.status, 'defeat')
    assert.equal((await api(host, 'session')).matches.length, 2)
    // Serve a live snapshot from a separate directory, including its seat credentials.
    activeDirectory = join(data, 'restore')
    await mkdir(activeDirectory)
    execFileSync(process.execPath, ['scripts/backup.cjs', join(activeDirectory,'tables.sqlite')], {
      env: {...process.env, DATA_DIR:data}
    })
    await stop()
    await start()
    assert.deepEqual(await api(guest,path),{...m,seat:1})
    assert.deepEqual(await api(host,'matches/'+solo.id),solo)
    assert.equal((await api(guest,'session')).pushKey,key)
    // Claim existing seats and resume from an independent browser.
    const credentials = {username:'test_player', password:randomUUID()}
    async function accountRequest(cookie, action) {
      const response = await fetch(base + '/api/' + action, {
        method: 'POST', headers: {cookie, origin:base, 'content-type':'application/json'},
        body: JSON.stringify(credentials),
      })
      assert.equal(response.status, 200)
      return response.headers.get('set-cookie').split(';')[0]
    }
    const firstSession = await accountRequest(host,'signup')
    await api(host, path, undefined, 404)
    const secondSession = await accountRequest(stranger,'login')
    const signedIn = stranger + '; ' + secondSession
    assert.equal((await api(signedIn,'session')).username, credentials.username)
    assert.equal((await api(signedIn,path)).id,m.id)
    await api(stranger,'login',{...credentials,password:randomUUID()},401)
    await api(stranger,'signup',credentials,409)
    await accountRequest(signedIn,'logout')
    await api(signedIn,path,undefined,404)
    assert.equal((await api(host + '; ' + firstSession,'matches/'+solo.id)).id,solo.id)

  },
)
