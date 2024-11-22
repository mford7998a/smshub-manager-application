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

interface ModemData {
  id: string;
  pluginName: string;
  devicePath: string;
  imei: string;
  iccid?: string;
  operator?: string;
  config?: Record<string, any>;
}

interface MessageData {
  id?: number;
  modemId: string;
  sender: string;
  message: string;
  timestamp: Date;
  status: 'received' | 'sent' | 'pending' | 'failed';
  error?: string;
}

interface PluginData {
  name: string;
  version: string;
  enabled: boolean;
  config?: Record<string, any>;
  lastUpdated: Date;
}

interface DatabaseOptions {
  verbose?: (message: string) => void;
}

import { EventEmitter } from 'events';
import { ModemRecord, MessageRecord, PluginRecord, StatsRecord, MetricsRecord, LogRecord } from './database';

export interface StoreEvents {
  'modem:updated': (modemId: string) => void;
  'modem:deleted': (modemId: string) => void;
  'message:saved': (message: MessageRecord) => void;
  'message:updated': (messageId: number) => void;
  'message:deleted': (messageId: number) => void;
  'plugin:updated': (pluginName: string) => void;
  'plugin:removed': (pluginName: string) => void;
  'stats:updated': (modemId: string) => void;
  'metrics:saved': (type: string) => void;
  'error': (error: Error) => void;
}

export interface StoreOptions {
  dbPath?: string;
  encryptionKey?: string;
  maxConnections?: number;
  verbose?: boolean;
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

export interface Store extends EventEmitter {
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