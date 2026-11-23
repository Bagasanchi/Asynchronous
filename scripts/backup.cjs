const { DatabaseSync } = require('node:sqlite')
const { join, resolve } = require('node:path')
const { existsSync } = require('node:fs')
const target = process.argv[2]
if (!target || existsSync(target))
  throw Error('Choose a new snapshot filename.')
const db = new DatabaseSync(
  join(process.env.DATA_DIR || 'data', 'tables.sqlite'),
  { readOnly: true },
)
try {
  db.prepare('VACUUM INTO ?').run(resolve(target))
} finally {
  db.close()
}
const copy = new DatabaseSync(resolve(target), { readOnly: true })
try {
  if (copy.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok')
    throw Error('Snapshot integrity check failed')
  console.log('Verified snapshot ' + target)
} finally {
  copy.close()
}
