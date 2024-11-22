import { Database as SQLiteDatabase, Statement } from 'better-sqlite3';

declare global {
  namespace Database {
    interface Database extends SQLiteDatabase {}
    interface Statement extends Statement {}
  }
}

declare module 'better-sqlite3' {
  interface Database {
    prepare<T = any>(sql: string): Statement<T>;
    exec(sql: string): void;
    pragma(pragma: string, value?: any): any;
    close(): void;
    transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T;
  }

  interface Statement<T = any> {
    run(...params: any[]): RunResult;
    get(...params: any[]): T;
    all(...params: any[]): T[];
    iterate(...params: any[]): IterableIterator<T>;
    finalize(): void;
  }

  interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  interface Options {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: (message?: any) => void;
  }

  export default function(filename: string, options?: Options): Database;
}

export interface DatabaseSchema {
  modems: {
    id: string;
    pluginName: string;
    devicePath: string;
    imei: string;
    iccid?: string;
    operator?: string;
    config: string;
    createdAt: string;
    updatedAt: string;
  };

  messages: {
    id: number;
    modemId: string;
    sender: string;
    message: string;
    timestamp: string;
    status: 'received' | 'sent' | 'pending' | 'failed';
    error?: string;
    encrypted: boolean;
  };

  plugins: {
    name: string;
    version: string;
    enabled: boolean;
    config?: string;
    lastUpdated: string;
  };

  stats: {
    id: number;
    modemId: string;
    messageCount: number;
    errorCount: number;
    signalStrength: number;
    timestamp: string;
  };

  metrics: {
    id: number;
    type: 'system' | 'modem' | 'message';
    value: number;
    metadata?: string;
    timestamp: string;
  };

  logs: {
    id: number;
    level: 'debug' | 'info' | 'warn' | 'error';
    context: string;
    message: string;
    metadata?: string;
    timestamp: string;
  };
}

export interface Store {
  // Core operations
  initialize(): Promise<void>;
  close(): void;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  backup(path: string): Promise<void>;
  vacuum(): Promise<void>;

  // Modem operations
  saveModem(modem: Omit<ModemRecord, 'createdAt' | 'updatedAt'>): Promise<void>;
  getModem(id: string): Promise<ModemRecord | null>;
  getModems(options?: QueryOptions): Promise<ModemRecord[]>;
  updateModem(id: string, updates: Partial<ModemRecord>): Promise<void>;
  deleteModem(id: string): Promise<void>;

  // Message operations
  saveMessage(message: Omit<MessageRecord, 'id'>): Promise<MessageRecord>;
  getMessage(id: number): Promise<MessageRecord | null>;
  getMessages(options?: MessageQueryOptions): Promise<MessageRecord[]>;
  updateMessage(id: number, updates: Partial<MessageRecord>): Promise<void>;
  deleteMessage(id: number): Promise<void>;
  getMessageCount(options?: MessageQueryOptions): Promise<number>;

  // Plugin operations
  savePlugin(plugin: PluginRecord): Promise<void>;
  getPlugin(name: string): Promise<PluginRecord | null>;
  getPlugins(options?: QueryOptions): Promise<PluginRecord[]>;
  updatePlugin(name: string, updates: Partial<PluginRecord>): Promise<void>;
  deletePlugin(name: string): Promise<void>;
  isPluginEnabled(name: string): Promise<boolean>;

  // Stats operations
  saveStats(stats: Omit<StatsRecord, 'id' | 'timestamp'>): Promise<void>;
  getStats(options?: StatsQueryOptions): Promise<StatsRecord[]>;
  getModemStats(modemId: string, period: string): Promise<any>;
  getSystemStats(period: string): Promise<any>;

  // Metrics operations
  saveMetrics(metrics: Omit<MetricsRecord, 'id' | 'timestamp'>): Promise<void>;
  getMetrics(options?: MetricsQueryOptions): Promise<MetricsRecord[]>;
  getMetricsSummary(type: string, period: string): Promise<any>;

  // Log operations
  saveLogs(log: Omit<LogRecord, 'id' | 'timestamp'>): Promise<void>;
  getLogs(options?: LogQueryOptions): Promise<LogRecord[]>;
  clearLogs(before: Date): Promise<void>;

  // Utility operations
  getMessageStats(timeRange?: string): Promise<{
    messageRate: number;
    errorRate: number;
    totalMessages: number;
    successRate: number;
  }>;
  
  getModemStats(modemId: string, timeRange?: string): Promise<{
    messageCount: number;
    errorCount: number;
    signalStrength: number[];
  }>;

  getResponseTimes(timeRange?: string): Promise<number[]>;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

export interface MessageQueryOptions extends QueryOptions {
  modemId?: string;
  status?: MessageRecord['status'];
  startDate?: Date;
  endDate?: Date;
  includeContent?: boolean;
}

export interface StatsQueryOptions extends QueryOptions {
  modemId?: string;
  startDate?: Date;
  endDate?: Date;
  groupBy?: 'hour' | 'day' | 'week' | 'month';
}

export interface MetricsQueryOptions extends QueryOptions {
  type?: MetricsRecord['type'];
  startDate?: Date;
  endDate?: Date;
  resolution?: 'minute' | 'hour' | 'day';
}

export interface LogQueryOptions extends QueryOptions {
  level?: LogRecord['level'];
  context?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

export interface ModemRecord {
  id: string;
  pluginName: string;
  devicePath: string;
  imei: string;
  iccid?: string;
  operator?: string;
  config?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageRecord {
  id?: number;
  modemId: string;
  sender: string;
  message: string;
  timestamp: Date;
  status: 'received' | 'sent' | 'pending' | 'failed';
  error?: string;
  encrypted: boolean;
}

export interface PluginRecord {
  name: string;
  version: string;
  enabled: boolean;
  config?: string;
  lastUpdated: Date;
}

export interface StatsRecord {
  id?: number;
  modemId: string;
  messageCount: number;
  errorCount: number;
  signalStrength?: number;
  timestamp: Date;
}

export interface MetricsRecord {
  id?: number;
  type: 'system' | 'modem' | 'message';
  value: number;
  metadata?: string;
  timestamp: Date;
}

export interface LogRecord {
  id?: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  context: string;
  message: string;
  metadata?: string;
  timestamp: Date;
} 