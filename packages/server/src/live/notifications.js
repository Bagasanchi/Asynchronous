import { generateVAPIDKeys, sendNotification, setVapidDetails } from 'web-push'

export function notifications(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS devices (owner TEXT PRIMARY KEY, subscription TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reminders (match TEXT PRIMARY KEY, owner TEXT NOT NULL, revision INTEGER, due INTEGER, attempts INTEGER DEFAULT 0);`)
  const subject = process.env.VAPID_SUBJECT
  if (!subject) return { publicKey: null, close() {} }
  const stored = db
    .prepare("SELECT value FROM settings WHERE name='vapid'")
    .get()
  const keys = stored ? JSON.parse(stored.value) : generateVAPIDKeys()
  if (!stored)
    db.prepare("INSERT INTO settings VALUES ('vapid',?)").run(
      JSON.stringify(keys),
    )
  setVapidDetails(subject, keys.publicKey, keys.privateKey)
  let busy = false
  const timer = setInterval(async () => {
    if (busy) return
    busy = true
    try {
      const job = db
        .prepare(
          'SELECT r.*, d.subscription FROM reminders r JOIN devices d USING(owner) WHERE due<=? ORDER BY due LIMIT 1',
        )
        .get(Date.now())
      if (!job) return
      try {
        await sendNotification(
          JSON.parse(job.subscription),
          JSON.stringify({ match: job.match }),
          { TTL: 3600, timeout: 10000 },
        )
      } catch (err) {
        if ([404, 410].includes(err.statusCode))
          db.prepare(
            'DELETE FROM devices WHERE owner=? AND subscription=?',
          ).run(job.owner, job.subscription)
        else if (job.attempts < 5) {
          db.prepare(
            'UPDATE reminders SET attempts=attempts+1,due=? WHERE match=? AND revision=?',
          ).run(Date.now() + 30000 * 2 ** job.attempts, job.match, job.revision)
          return
        }
      }
      db.prepare('DELETE FROM reminders WHERE match=? AND revision=?').run(
        job.match,
        job.revision,
      )
    } catch {
      console.error('Turn reminder processing failed')
    } finally {
      busy = false
    }
  }, 5000)
  return { publicKey: keys.publicKey, close: () => clearInterval(timer) }
}

export function validSubscription(sub) {
  try {
    const url = new URL(sub.endpoint)
    const trusted =
      [
        'fcm.googleapis.com',
        'updates.push.services.mozilla.com',
        'web.push.apple.com',
      ].includes(url.hostname) ||
      url.hostname.endsWith('.push.apple.com') ||
      url.hostname.endsWith('.notify.windows.com')
    return (
      trusted &&
      url.protocol === 'https:' &&
      !url.port &&
      !url.username &&
      !url.password &&
      url.pathname.length > 1 &&
      /^[\w-]{87}$/.test(sub.keys.p256dh) &&
      /^[\w-]{22}$/.test(sub.keys.auth)
    )
  } catch {
    return false
  }
}
