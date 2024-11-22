import { Database } from 'better-sqlite3';

export async function up(db: Database): Promise<void> {
  // Create modems table
  db.exec(`
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

    CREATE INDEX idx_modems_pluginName ON modems(pluginName);
    CREATE INDEX idx_modems_devicePath ON modems(devicePath);
  `);

  // Create messages table
  db.exec(`
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

    CREATE INDEX idx_messages_modemId ON messages(modemId);
    CREATE INDEX idx_messages_timestamp ON messages(timestamp);
    CREATE INDEX idx_messages_status ON messages(status);
  `);

  // Create plugins table
  db.exec(`
    CREATE TABLE IF NOT EXISTS plugins (
      name TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      enabled BOOLEAN DEFAULT FALSE,
      config TEXT,
      lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_plugins_enabled ON plugins(enabled);
  `);

  // Create stats table
  db.exec(`
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      modemId TEXT NOT NULL,
      messageCount INTEGER DEFAULT 0,
      errorCount INTEGER DEFAULT 0,
      signalStrength INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (modemId) REFERENCES modems(id)
    );

    CREATE INDEX idx_stats_modemId ON stats(modemId);
    CREATE INDEX idx_stats_timestamp ON stats(timestamp);
  `);

  // Create metrics table
  db.exec(`
    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      metadata TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_metrics_type ON metrics(type);
    CREATE INDEX idx_metrics_timestamp ON metrics(timestamp);
  `);

  // Create logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      context TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_logs_level ON logs(level);
    CREATE INDEX idx_logs_context ON logs(context);
    CREATE INDEX idx_logs_timestamp ON logs(timestamp);
  `);

  // Create triggers for updated_at
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS modems_updated_at
    AFTER UPDATE ON modems
    BEGIN
      UPDATE modems 
      SET updatedAt = CURRENT_TIMESTAMP
      WHERE id = NEW.id;
    END;
  `);
}

export async function down(db: Database): Promise<void> {
  // Drop tables in reverse order
  const tables = [
    'logs',
    'metrics',
    'stats',
    'plugins',
    'messages',
    'modems'
  ];

  for (const table of tables) {
    db.exec(`DROP TABLE IF EXISTS ${table}`);
  }
} 