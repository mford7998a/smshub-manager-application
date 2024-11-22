import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { Store } from '../database/Store';
import { encrypt, decrypt } from '../utils/encryption';
import * as path from 'path';
import * as fs from 'fs-extra';
import { app } from 'electron';

interface ConfigSchema {
  system: SystemConfig;
  api: APIConfig;
  modem: ModemConfig;
  plugins: PluginConfig;
}

interface SystemConfig {
  autoStart: boolean;
  minimizeToTray: boolean;
  theme: 'light' | 'dark' | 'system';
  language: string;
}

interface APIConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

interface ModemConfig {
  commandTimeout: number;
  maxRetries: number;
  signalCheckInterval: number;
  maxErrors: number;
  autoReconnect: boolean;
  reconnectDelay: number;
}

interface PluginConfig {
  directory: string;
  autoload: boolean;
  verifySignatures: boolean;
  updateCheck: boolean;
  updateInterval: number;
}

export class ConfigService extends EventEmitter {
  private readonly logger: Logger;
  private readonly store: Store;
  private config: ConfigSchema;
  private configPath: string;
  private encryptionKey: string;

  constructor(store: Store) {
    super();
    this.logger = new Logger('ConfigService');
    this.store = store;
    this.config = {};
    this.configPath = path.join(app.getPath('userData'), 'config.json');
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key';
  }

  async initialize(): Promise<void> {
    try {
      await this.loadConfig();
      await this.validateConfig();
      this.setupWatcher();
      this.logger.info('Configuration service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize configuration:', error);
      throw error;
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      // Load from file
      if (await fs.pathExists(this.configPath)) {
        const encrypted = await fs.readFile(this.configPath, 'utf8');
        const decrypted = await decrypt(encrypted, this.encryptionKey);
        this.config = JSON.parse(decrypted);
      } else {
        // Create default config
        this.config = this.getDefaultConfig();
        await this.saveConfig();
      }
    } catch (error) {
      this.logger.error('Failed to load configuration:', error);
      this.config = this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): ConfigSchema {
    return {
      system: {
        autoStart: false,
        minimizeToTray: true,
        theme: 'system',
        language: 'en'
      },
      api: {
        baseUrl: 'https://api.smshub.org',
        apiKey: '',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000
      },
      modem: {
        commandTimeout: 10000,
        maxRetries: 3,
        signalCheckInterval: 30000,
        maxErrors: 10,
        autoReconnect: true,
        reconnectDelay: 5000
      },
      plugins: {
        directory: path.join(app.getPath('userData'), 'plugins'),
        autoload: true,
        verifySignatures: true,
        updateCheck: true,
        updateInterval: 86400000 // 24 hours
      }
    };
  }

  private async validateConfig(): Promise<void> {
    const defaultConfig = this.getDefaultConfig();
    let needsSave = false;

    // Recursively ensure all required fields exist
    const validateObject = (current: any, template: any, path: string[] = []) => {
      for (const key in template) {
        const currentPath = [...path, key];
        if (!(key in current)) {
          current[key] = template[key];
          needsSave = true;
          this.logger.warn(`Missing config value: ${currentPath.join('.')}`);
        } else if (
          typeof template[key] === 'object' &&
          template[key] !== null &&
          !Array.isArray(template[key])
        ) {
          validateObject(current[key], template[key], currentPath);
        }
      }
    };

    validateObject(this.config, defaultConfig);

    if (needsSave) {
      await this.saveConfig();
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      const encrypted = await encrypt(
        JSON.stringify(this.config, null, 2),
        this.encryptionKey
      );
      await fs.writeFile(this.configPath, encrypted);
      this.emit('config:updated', this.config);
    } catch (error) {
      this.logger.error('Failed to save configuration:', error);
      throw error;
    }
  }

  private setupWatcher(): void {
    fs.watch(this.configPath, async (eventType) => {
      if (eventType === 'change') {
        try {
          await this.loadConfig();
          this.emit('config:updated', this.config);
        } catch (error) {
          this.logger.error('Failed to reload configuration:', error);
        }
      }
    });
  }

  // Public API methods
  get<T = any>(path: string, defaultValue?: T): T {
    const parts = path.split('.');
    let current: any = this.config;

    for (const part of parts) {
      if (current === undefined) return defaultValue as T;
      current = current[part];
    }

    return (current === undefined ? defaultValue : current) as T;
  }

  async set(path: string, value: any): Promise<void> {
    const parts = path.split('.');
    let current: any = this.config;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
    await this.saveConfig();
  }

  async update(updates: Partial<ConfigSchema>): Promise<void> {
    this.config = {
      ...this.config,
      ...updates
    };
    await this.saveConfig();
  }

  async reset(): Promise<void> {
    this.config = this.getDefaultConfig();
    await this.saveConfig();
  }

  getAll(): Partial<ConfigSchema> {
    return { ...this.config };
  }
} 