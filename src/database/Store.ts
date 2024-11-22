import Database from 'better-sqlite3';
import { Logger } from '../utils/logger';
import { EventEmitter } from 'events';
import * as path from 'path';
import { app } from 'electron';
import { encrypt, decrypt } from '../utils/encryption';
import { createHash } from 'crypto';
import type { 
  ModemRecord, 
  MessageRecord, 
  PluginRecord, 
  StatsRecord,
  DatabaseOptions
} from '../types/database';

export class Store extends EventEmitter {
  private readonly db: Database.Database;
  private readonly logger: Logger;
  private readonly encryptionKey: string;

  constructor(dbPath?: string, options?: DatabaseOptions) {
    super();
    this.logger = new Logger('Store');
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key';

    const defaultPath = path.join(app.getPath('userData'), 'smshub.db');
    const dbOptions: Database.Options = {
      verbose: options?.verbose,
      fileMustExist: false
    };

    this.db = new Database(dbPath || defaultPath, dbOptions);
    this.setupDatabase();
  }

  private setupDatabase(): void {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS modems (
        id TEXT PRIMARY KEY,
        pluginName TEXT NOT NULL,
        devicePath TEXT NOT NULL,
        imei TEXT NOT NULL,
        iccid TEXT,
        operator TEXT,
        config TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        modemId TEXT NOT NULL,
        sender TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        encrypted BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (modemId) REFERENCES modems(id)
      );

      CREATE TABLE IF NOT EXISTS plugins (
        name TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        enabled BOOLEAN DEFAULT FALSE,
        config TEXT,
        lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        modemId TEXT NOT NULL,
        messageCount INTEGER DEFAULT 0,
        errorCount INTEGER DEFAULT 0,
        signalStrength INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (modemId) REFERENCES modems(id)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_modemId ON messages(modemId);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
      CREATE INDEX IF NOT EXISTS idx_stats_modemId ON stats(modemId);
      CREATE INDEX IF NOT EXISTS idx_stats_timestamp ON stats(timestamp);
    `);
  }

  // Modem operations
  async saveModem(modem: ModemRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO modems (
        id, pluginName, devicePath, imei, iccid, operator, config, updatedAt
      ) VALUES (
        @id, @pluginName, @devicePath, @imei, @iccid, @operator, @config, CURRENT_TIMESTAMP
      )
    `);

    try {
      const config = modem.config ? JSON.stringify(modem.config) : null;
      stmt.run({ ...modem, config });
      this.emit('modem:updated', modem.id);
    } catch (error) {
      this.logger.error('Failed to save modem:', error);
      throw error;
    }
  }

  async getModem(modemId: string): Promise<ModemRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM modems WHERE id = ?');
    try {
      const modem = stmt.get(modemId) as any;
      if (!modem) return null;

      return {
        ...modem,
        config: modem.config ? JSON.parse(modem.config) : undefined
      };
    } catch (error) {
      this.logger.error('Failed to get modem:', error);
      throw error;
    }
  }

  async getModems(): Promise<ModemRecord[]> {
    const stmt = this.db.prepare('SELECT * FROM modems');
    try {
      const modems = stmt.all() as any[];
      return modems.map(modem => ({
        ...modem,
        config: modem.config ? JSON.parse(modem.config) : undefined
      }));
    } catch (error) {
      this.logger.error('Failed to get modems:', error);
      throw error;
    }
  }

  // Message operations
  async saveMessage(message: MessageRecord): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO messages (
        modemId, sender, message, timestamp, status, error
      ) VALUES (
        @modemId, @sender, @message, @timestamp, @status, @error
      )
    `);

    try {
      const encryptedMessage = encrypt(message.message, this.encryptionKey);
      const result = stmt.run({
        ...message,
        message: encryptedMessage,
        timestamp: message.timestamp.toISOString()
      });
      
      this.emit('message:saved', result.lastInsertRowid);
      return result.lastInsertRowid as number;
    } catch (error) {
      this.logger.error('Failed to save message:', error);
      throw error;
    }
  }

  async getMessage(messageId: number): Promise<MessageRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE id = ?');
    try {
      const message = stmt.get(messageId) as any;
      if (!message) return null;

      return {
        ...message,
        message: decrypt(message.message, this.encryptionKey),
        timestamp: new Date(message.timestamp)
      };
    } catch (error) {
      this.logger.error('Failed to get message:', error);
      throw error;
    }
  }

  async getMessages(options: {
    modemId?: string;
    status?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<MessageRecord[]> {
    let query = 'SELECT * FROM messages WHERE 1=1';
    const params: any = {};

    if (options.modemId) {
      query += ' AND modemId = @modemId';
      params.modemId = options.modemId;
    }

    if (options.status) {
      query += ' AND status = @status';
      params.status = options.status;
    }

    if (options.startDate) {
      query += ' AND timestamp >= @startDate';
      params.startDate = options.startDate.toISOString();
    }

    if (options.endDate) {
      query += ' AND timestamp <= @endDate';
      params.endDate = options.endDate.toISOString();
    }

    query += ' ORDER BY timestamp DESC';

    if (options.limit) {
      query += ' LIMIT @limit';
      params.limit = options.limit;
    }

    if (options.offset) {
      query += ' OFFSET @offset';
      params.offset = options.offset;
    }

    const stmt = this.db.prepare(query);
    try {
      const messages = stmt.all(params) as any[];
      return messages.map(msg => ({
        ...msg,
        message: decrypt(msg.message, this.encryptionKey),
        timestamp: new Date(msg.timestamp)
      }));
    } catch (error) {
      this.logger.error('Failed to get messages:', error);
      throw error;
    }
  }

  // Plugin operations
  async savePlugin(plugin: PluginRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO plugins (
        name, version, enabled, config, lastUpdated
      ) VALUES (
        @name, @version, @enabled, @config, CURRENT_TIMESTAMP
      )
    `);

    try {
      const config = plugin.config ? JSON.stringify(plugin.config) : null;
      stmt.run({ ...plugin, config });
      this.emit('plugin:updated', plugin.name);
    } catch (error) {
      this.logger.error('Failed to save plugin:', error);
      throw error;
    }
  }

  async getPlugin(name: string): Promise<PluginRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM plugins WHERE name = ?');
    try {
      const plugin = stmt.get(name) as any;
      if (!plugin) return null;

      return {
        ...plugin,
        config: plugin.config ? JSON.parse(plugin.config) : undefined,
        lastUpdated: new Date(plugin.lastUpdated)
      };
    } catch (error) {
      this.logger.error('Failed to get plugin:', error);
      throw error;
    }
  }

  async isPluginEnabled(name: string): Promise<boolean> {
    const stmt = this.db.prepare('SELECT enabled FROM plugins WHERE name = ?');
    try {
      const result = stmt.get(name) as any;
      return result ? result.enabled : false;
    } catch (error) {
      this.logger.error('Failed to check plugin status:', error);
      throw error;
    }
  }

  async enablePlugin(pluginName: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE plugins 
      SET enabled = TRUE, lastUpdated = CURRENT_TIMESTAMP 
      WHERE name = ?
    `);
    
    try {
      stmt.run(pluginName);
      this.emit('plugin:updated', pluginName);
    } catch (error) {
      this.logger.error('Failed to enable plugin:', error);
      throw error;
    }
  }

  async disablePlugin(pluginName: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE plugins 
      SET enabled = FALSE, lastUpdated = CURRENT_TIMESTAMP 
      WHERE name = ?
    `);
    
    try {
      stmt.run(pluginName);
      this.emit('plugin:updated', pluginName);
    } catch (error) {
      this.logger.error('Failed to disable plugin:', error);
      throw error;
    }
  }

  async removePlugin(pluginName: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM plugins WHERE name = ?');
    
    try {
      stmt.run(pluginName);
      this.emit('plugin:removed', pluginName);
    } catch (error) {
      this.logger.error('Failed to remove plugin:', error);
      throw error;
    }
  }

  // Message operations
  async updateMessageStatus(messageId: number, status: string, error?: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE messages 
      SET status = ?, error = ?, timestamp = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    try {
      stmt.run(status, error, messageId);
      this.emit('message:updated', messageId);
    } catch (error) {
      this.logger.error('Failed to update message status:', error);
      throw error;
    }
  }

  async deleteMessage(messageId: number): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM messages WHERE id = ?');
    
    try {
      stmt.run(messageId);
      this.emit('message:deleted', messageId);
    } catch (error) {
      this.logger.error('Failed to delete message:', error);
      throw error;
    }
  }

  // Statistics operations
  async saveStats(stats: {
    modemId: string;
    messageCount: number;
    errorCount: number;
    signalStrength: number;
  }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO stats (
        modemId, messageCount, errorCount, signalStrength
      ) VALUES (
        @modemId, @messageCount, @errorCount, @signalStrength
      )
    `);

    try {
      stmt.run(stats);
    } catch (error) {
      this.logger.error('Failed to save stats:', error);
      throw error;
    }
  }

  async getStats(options: {
    modemId?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<any[]> {
    let query = 'SELECT * FROM stats WHERE 1=1';
    const params: any = {};

    if (options.modemId) {
      query += ' AND modemId = @modemId';
      params.modemId = options.modemId;
    }

    if (options.startDate) {
      query += ' AND timestamp >= @startDate';
      params.startDate = options.startDate.toISOString();
    }

    if (options.endDate) {
      query += ' AND timestamp <= @endDate';
      params.endDate = options.endDate.toISOString();
    }

    query += ' ORDER BY timestamp DESC';

    const stmt = this.db.prepare(query);
    try {
      return stmt.all(params);
    } catch (error) {
      this.logger.error('Failed to get stats:', error);
      throw error;
    }
  }

  async getMessageStats(timeRange: string = '24h'): Promise<{
    messageRate: number;
    errorRate: number;
    totalMessages: number;
    successRate: number;
  }> {
    const timeRanges: Record<string, number> = {
      '1h': 3600,
      '24h': 86400,
      '7d': 604800,
      '30d': 2592000
    };

    const seconds = timeRanges[timeRange] || timeRanges['24h'];
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        COUNT(*) / ? as rate
      FROM messages 
      WHERE timestamp >= datetime('now', '-${seconds} seconds')
    `);

    try {
      const stats = stmt.get(seconds) as any;
      return {
        messageRate: stats.rate || 0,
        errorRate: stats.total ? (stats.failed / stats.total) * 100 : 0,
        totalMessages: stats.total || 0,
        successRate: stats.total ? (stats.sent / stats.total) * 100 : 0
      };
    } catch (error) {
      this.logger.error('Failed to get message stats:', error);
      throw error;
    }
  }

  async saveMetrics(metrics: {
    modemId: string;
    signalStrength: number;
    messageCount: number;
    errorCount: number;
  }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO stats (
        modemId, signalStrength, messageCount, errorCount
      ) VALUES (
        @modemId, @signalStrength, @messageCount, @errorCount
      )
    `);

    try {
      stmt.run(metrics);
    } catch (error) {
      this.logger.error('Failed to save metrics:', error);
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
} 