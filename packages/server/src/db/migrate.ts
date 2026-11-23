/**
 * Migration runner script
 */

import Database from 'better-sqlite3';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { readdirSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DATABASE_PATH || resolve(__dirname, '../../../data/game.db');
const MIGRATIONS_DIR = resolve(__dirname, '../migrations');

const sqlite = new Database(DB_PATH);

function runMigrations(): void {
  console.log('Running migrations...');

  // Get all migration files
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    console.log(`Applying migration: ${file}`);
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8');
    try {
      sqlite.exec(sql);
      console.log(`  ✓ ${file} applied successfully`);
    } catch (error) {
      console.error(`  ✗ ${file} failed:`, error);
      throw error;
    }
  }

  console.log('All migrations completed!');
}

function rollbackMigrations(): void {
  console.log('Rollback not implemented for this migration system');
  process.exit(1);
}

// CLI handling
const command = process.argv[2];

switch (command) {
  case 'up':
  case 'migrate':
    runMigrations();
    break;
  case 'down':
  case 'rollback':
    rollbackMigrations();
    break;
  default:
    console.log('Usage: tsx migrate.ts [up|down]');
    console.log('  up    - Run pending migrations');
    console.log('  down  - Rollback last migration (not implemented)');
    process.exit(1);
}

sqlite.close();