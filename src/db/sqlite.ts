import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('db');

export interface GroceryItem {
  id: number;
  name: string;
  addedAt: string;
  synced: boolean;
}

export interface MessageLog {
  id: number;
  from: string;
  body: string;
  timestamp: string;
  response: string | null;
}

export class DB {
  private db: Database.Database;

  constructor(dbPath: string) {
    logger.info('Initializing database', { path: dbPath });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS grocery_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        added_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS message_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_number TEXT NOT NULL,
        body TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        response TEXT
      );

      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_grocery_name ON grocery_items(name);
      CREATE INDEX IF NOT EXISTS idx_messages_from ON message_logs(from_number);
    `);
    logger.debug('Database tables initialized');
  }

  // Grocery items
  addGroceryItem(name: string): GroceryItem {
    const stmt = this.db.prepare(
      'INSERT INTO grocery_items (name) VALUES (?) RETURNING id, name, added_at as addedAt, synced'
    );
    const result = stmt.get(name) as GroceryItem;
    logger.debug('Added grocery item', { name, id: result.id });
    return result;
  }

  removeGroceryItem(name: string): boolean {
    const stmt = this.db.prepare(
      'DELETE FROM grocery_items WHERE LOWER(name) = LOWER(?)'
    );
    const result = stmt.run(name);
    logger.debug('Removed grocery item', { name, changes: result.changes });
    return result.changes > 0;
  }

  getGroceryItems(): GroceryItem[] {
    const stmt = this.db.prepare(
      'SELECT id, name, added_at as addedAt, synced FROM grocery_items ORDER BY added_at DESC'
    );
    return stmt.all() as GroceryItem[];
  }

  clearGroceryItems(): number {
    const stmt = this.db.prepare('DELETE FROM grocery_items');
    const result = stmt.run();
    logger.debug('Cleared grocery items', { count: result.changes });
    return result.changes;
  }

  markItemSynced(id: number): void {
    const stmt = this.db.prepare('UPDATE grocery_items SET synced = 1 WHERE id = ?');
    stmt.run(id);
  }

  // Message logging
  logMessage(from: string, body: string, response: string | null = null): void {
    const stmt = this.db.prepare(
      'INSERT INTO message_logs (from_number, body, response) VALUES (?, ?, ?)'
    );
    stmt.run(from, body, response);
  }

  // Key-value store for arbitrary state
  setValue(key: string, value: string): void {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
    );
    stmt.run(key, value);
  }

  getValue(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM kv_store WHERE key = ?');
    const result = stmt.get(key) as { value: string } | undefined;
    return result?.value ?? null;
  }

  close(): void {
    this.db.close();
    logger.info('Database connection closed');
  }
}
