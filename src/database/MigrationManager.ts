import { Database } from 'better-sqlite3';
import { Logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs-extra';

export class MigrationManager {
  private logger: Logger;
  private db: Database;
  private migrationsDir: string;

  constructor(db: Database) {
    this.logger = new Logger('MigrationManager');
    this.db = db;
    this.migrationsDir = path.join(__dirname, 'migrations');
  }

  async initialize(): Promise<void> {
    await this.createMigrationsTable();
    await this.runPendingMigrations();
  }

  private async createMigrationsTable(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private async runPendingMigrations(): Promise<void> {
    const files = await fs.readdir(this.migrationsDir);
    const migrations = files
      .filter(f => f.endsWith('.ts') || f.endsWith('.js'))
      .sort();

    for (const migration of migrations) {
      const name = path.basename(migration, path.extname(migration));
      if (await this.isMigrationApplied(name)) continue;

      try {
        const { up } = require(path.join(this.migrationsDir, migration));
        await up(this.db);
        await this.recordMigration(name);
        this.logger.info(`Applied migration: ${name}`);
      } catch (error) {
        this.logger.error(`Failed to apply migration ${name}:`, error);
        throw error;
      }
    }
  }

  private async isMigrationApplied(name: string): Promise<boolean> {
    const result = this.db.prepare(
      'SELECT COUNT(*) as count FROM migrations WHERE name = ?'
    ).get(name) as { count: number };
    
    return result.count > 0;
  }

  private async recordMigration(name: string): Promise<void> {
    this.db.prepare(
      'INSERT INTO migrations (name) VALUES (?)'
    ).run(name);
  }
} 