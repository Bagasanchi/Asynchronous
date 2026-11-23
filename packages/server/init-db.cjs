// Initialize database using sql.js (CommonJS)
const sql = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve('data/game.db');

// Ensure data directory exists
if (!fs.existsSync('data')) {
  fs.mkdirSync('data', { recursive: true });
}

// Check if DB already exists
if (fs.existsSync(dbPath)) {
  console.log('Database already exists at:', dbPath);
  process.exit(0);
}

// Create new database - sql.js exports a function, instantiate it
const db = new sql();

// Enable WAL mode for better concurrency
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA synchronous = NORMAL');
db.exec('PRAGMA cache_size = -10000'); // 10MB cache
db.exec('PRAGMA temp_store = memory');

// Create all tables for the card game
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    elo INTEGER DEFAULT 1000,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
    updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER))
  );

  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    status TEXT DEFAULT 'lobby',
    metadata JSON,
    player_count INTEGER DEFAULT 0,
    max_players INTEGER DEFAULT 4,
    created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
    updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER))
  );

  CREATE TABLE IF NOT EXISTS game_players (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    player_index INTEGER,
    health INTEGER DEFAULT 20,
    max_health INTEGER DEFAULT 20,
    energy INTEGER DEFAULT 3,
    max_energy INTEGER DEFAULT 3,
    gold INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    seat_index INTEGER,
    created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
    updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    game_id TEXT,
    player_index INTEGER,
    card_data JSON NOT NULL,
    position INTEGER DEFAULT 0,
    target_type TEXT DEFAULT 'self',
    is_exhausted INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
    FOREIGN KEY (game_id) REFERENCES games(id)
  );

  CREATE TABLE IF NOT EXISTS enemies (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    hp INTEGER DEFAULT 10,
    max_hp INTEGER DEFAULT 10,
    intent TEXT DEFAULT 'attack',
    is_defeated INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
    updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
    FOREIGN KEY (game_id) REFERENCES games(id)
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT,
    entry TEXT NOT NULL,
    player_index INTEGER,
    turn_number INTEGER,
    created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
    FOREIGN KEY (game_id) REFERENCES games(id)
  );
`);

// Export to buffer and write file
const buffer = db.export();
fs.writeFileSync(dbPath, buffer);

console.log('Database initialized at:', dbPath);