/**
 * Database connection and initialization using sql.js (pure JS SQLite)
 * No native bindings required - works on all platforms including Windows
 */

import { open } from 'sql.js';
import path from 'path';
import { existsSync, writeFileSync, mkdirSync } from 'fs';

// Resolve database path relative to the server package
const DB_PATH = path.resolve('D:\\Claude Code\\Asynchronous\\async-card-game\\packages\\server\\data\\game.db');

// Initialize database connection asynchronously
let dbPromise: Promise<any> | null = null;

/**
 * Initialize the database - create if not exists with schema
 */
export async function initializeDatabase(): Promise<void> {
  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // sql.js needs the database file to exist
  if (!existsSync(DB_PATH)) {
    // Create empty database and initialize with schema
    const SQL = await import('sql.js');
    const sqlite = new SQL.Database();

    // Enable WAL mode for better concurrency
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('synchronous = NORMAL');
    sqlite.pragma('cache_size = -10000'); // 10MB cache
    sqlite.pragma('temp_store = memory');

    // Create all tables for the card game
    sqlite.exec(`
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

    // Write the initialized database file
    const buffer = sqlite.export();
    writeFileSync(DB_PATH, buffer);
  }

  dbPromise = open({
    filename: DB_PATH,
    driver: SQL.Database,
  });
}

/**
 * Generic query - execute SQL with optional parameters
 */
export async function query(sql: string, params: any[] = []): Promise<any> {
  const sqlite = await dbPromise;
  return sqlite.exec(sql, { params });
}

/**
 * Execute SQL that may modify data (INSERT, UPDATE, DELETE)
 * Returns the last insert rowid or affected rows
 */
export async function execute(sql: string, params: any[] = []): Promise<any> {
  const sqlite = await dbPromise;
  return sqlite.exec(sql, { params });
}

/**
 * Get a single row value
 */
export async function get<T>(sql: string, params: any[] = []): Promise<T | null> {
  const sqlite = await dbPromise;
  const result = sqlite.exec(sql, { params });
  if (result && result.length > 0 && result[0]?.values && result[0].values.length > 0) {
    return result[0].values[0] as T;
  }
  return null;
}

/**
 * Get all rows
 */
export async function all<T>(sql: string, params: any[] = []): Promise<T[]> {
  const sqlite = await dbPromise;
  const result = sqlite.exec(sql, { params });
  if (result && result.length > 0 && result[0]?.values) {
    return result[0].values as T[];
  }
  return [];
}

/**
 * Get a single scalar value (e.g., count, sum)
 */
export async function scalar<T>(sql: string, params: any[] = []): Promise<T | null> {
  const sqlite = await dbPromise;
  const result = sqlite.exec(sql, { params });
  if (result && result.length > 0 && result[0]?.values && result[0].values[0]) {
    return result[0].values[0][0] as T;
  }
  return null;
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbPromise) {
    dbPromise = null;
  }
}