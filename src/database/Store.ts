import Database from 'better-sqlite3';
import { logger } from '../utils/logger';

interface ModemData {
  id: string;
  pluginName: string;
  devicePath: string;
  imei: string;
  iccid: string;
  operator: string;
}

interface MessageData {
  id?: number;
  modemId: string;
  sender: string;
  message: string;
  timestamp: Date;
  status: 'received' | 'sent' | 'pending' | 'failed';
}

export class Store {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
  }

  async initialize(): Promise<void> {
    try {
      // Create tables
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS modems (
          id TEXT PRIMARY KEY,
          plugin_name TEXT NOT NULL,
          device_path TEXT NOT NULL,
          imei TEXT NOT NULL,
          iccid TEXT NOT NULL,
          operator TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          modem_id TEXT NOT NULL,
          sender TEXT NOT NULL,
          message TEXT NOT NULL,
          timestamp DATETIME NOT NULL,
          status TEXT NOT NULL,
          error TEXT,
          FOREIGN KEY (modem_id) REFERENCES modems(id)
        );

        CREATE TABLE IF NOT EXISTS plugins (
          id TEXT PRIMARY KEY,
          enabled BOOLEAN DEFAULT 0,
          config TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS modem_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          modem_id TEXT NOT NULL,
          signal_strength INTEGER,
          technology TEXT,
          band TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (modem_id) REFERENCES modems(id)
        );

        CREATE INDEX IF NOT EXISTS idx_messages_modem_id ON messages(modem_id);
        CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
        CREATE INDEX IF NOT EXISTS idx_modem_stats_modem_id ON modem_stats(modem_id);
        CREATE INDEX IF NOT EXISTS idx_modem_stats_timestamp ON modem_stats(timestamp);
      `);
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      this.db.close();
    } catch (error) {
      logger.error('Failed to close database:', error);
      throw error;
    }
  }

  // Modem operations
  async saveModem(modem: ModemData): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO modems (id, plugin_name, device_path, imei, iccid, operator)
        VALUES (@id, @pluginName, @devicePath, @imei, @iccid, @operator)
      `);
      stmt.run(modem);
    } catch (error) {
      logger.error('Failed to save modem:', error);
      throw error;
    }
  }

  async getModem(modemId: string): Promise<ModemData | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM modems WHERE id = ?');
      return stmt.get(modemId) as ModemData | null;
    } catch (error) {
      logger.error('Failed to get modem:', error);
      throw error;
    }
  }

  // Message operations
  async saveMessage(message: MessageData): Promise<number> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO messages (modem_id, sender, message, timestamp, status)
        VALUES (@modemId, @sender, @message, @timestamp, @status)
      `);
      const result = stmt.run(message);
      return result.lastInsertRowid as number;
    } catch (error) {
      logger.error('Failed to save message:', error);
      throw error;
    }
  }

  async getMessage(messageId: number): Promise<MessageData | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM messages WHERE id = ?');
      return stmt.get(messageId) as MessageData | null;
    } catch (error) {
      logger.error('Failed to get message:', error);
      throw error;
    }
  }

  async updateMessageStatus(messageId: number, status: string, error?: string): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        UPDATE messages 
        SET status = @status, error = @error 
        WHERE id = @messageId
      `);
      stmt.run({ messageId, status, error });
    } catch (error) {
      logger.error('Failed to update message status:', error);
      throw error;
    }
  }

  async deleteMessage(messageId: number): Promise<void> {
    try {
      const stmt = this.db.prepare('DELETE FROM messages WHERE id = ?');
      stmt.run(messageId);
    } catch (error) {
      logger.error('Failed to delete message:', error);
      throw error;
    }
  }

  // Plugin operations
  async enablePlugin(pluginId: string): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO plugins (id, enabled)
        VALUES (@id, 1)
      `);
      stmt.run({ id: pluginId });
    } catch (error) {
      logger.error('Failed to enable plugin:', error);
      throw error;
    }
  }

  async disablePlugin(pluginId: string): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        UPDATE plugins 
        SET enabled = 0 
        WHERE id = ?
      `);
      stmt.run(pluginId);
    } catch (error) {
      logger.error('Failed to disable plugin:', error);
      throw error;
    }
  }

  async getEnabledPlugins(): Promise<string[]> {
    try {
      const stmt = this.db.prepare('SELECT id FROM plugins WHERE enabled = 1');
      const rows = stmt.all();
      return rows.map((row: any) => row.id);
    } catch (error) {
      logger.error('Failed to get enabled plugins:', error);
      throw error;
    }
  }

  // Statistics operations
  async saveModemStats(modemId: string, stats: {
    signalStrength: number;
    technology: string;
    band: string;
  }): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO modem_stats (modem_id, signal_strength, technology, band)
        VALUES (@modemId, @signalStrength, @technology, @band)
      `);
      stmt.run({ modemId, ...stats });
    } catch (error) {
      logger.error('Failed to save modem stats:', error);
      throw error;
    }
  }

  async getModemStats(modemId: string, hours: number = 24): Promise<any[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM modem_stats 
        WHERE modem_id = ? 
        AND timestamp >= datetime('now', '-' || ? || ' hours')
        ORDER BY timestamp DESC
      `);
      return stmt.all(modemId, hours);
    } catch (error) {
      logger.error('Failed to get modem stats:', error);
      throw error;
    }
  }

  async getStatsSummary(timeRange: string): Promise<any> {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          COUNT(*) as totalMessages,
          AVG(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) * 100 as successRate,
          COUNT(DISTINCT modem_id) as activeModems
        FROM messages 
        WHERE timestamp >= datetime('now', '-' || ? || ' hours')
      `);
      return stmt.get(this.parseTimeRange(timeRange));
    } catch (error) {
      logger.error('Failed to get stats summary:', error);
      throw error;
    }
  }

  private parseTimeRange(timeRange: string): number {
    const ranges: { [key: string]: number } = {
      '24h': 24,
      '7d': 168,
      '30d': 720,
      '90d': 2160
    };
    return ranges[timeRange] || 24;
  }
} 