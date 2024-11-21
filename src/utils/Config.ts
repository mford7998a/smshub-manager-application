import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { logger } from './logger';

interface ConfigData {
  database: {
    path: string;
  };
  smshub: {
    baseUrl: string;
    apiKey: string;
    timeout: number;
  };
  plugins: {
    directory: string;
    autoload: boolean;
  };
  logging: {
    level: string;
    maxFiles: number;
    maxSize: number;
  };
  modem: {
    defaultBaudRate: number;
    commandTimeout: number;
    reconnectDelay: number;
  };
}

export class Config {
  private static instance: Config;
  private configPath: string;
  private data: ConfigData;

  private constructor() {
    this.configPath = path.join(app.getPath('userData'), 'config.json');
    this.data = {
      database: {
        path: path.join(app.getPath('userData'), 'smshub.db')
      },
      smshub: {
        baseUrl: 'https://api.smshub.com',
        apiKey: '',
        timeout: 30000
      },
      plugins: {
        directory: path.join(app.getPath('userData'), 'plugins'),
        autoload: true
      },
      logging: {
        level: 'info',
        maxFiles: 5,
        maxSize: 5242880 // 5MB
      },
      modem: {
        defaultBaudRate: 115200,
        commandTimeout: 10000,
        reconnectDelay: 5000
      }
    };
  }

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  async load(): Promise<void> {
    try {
      const exists = await fs.access(this.configPath)
        .then(() => true)
        .catch(() => false);

      if (exists) {
        const content = await fs.readFile(this.configPath, 'utf-8');
        const savedData = JSON.parse(content);
        this.data = this.mergeConfig(this.data, savedData);
        logger.info('Configuration loaded successfully');
      } else {
        await this.save();
        logger.info('Default configuration created');
      }
    } catch (error) {
      logger.error('Failed to load configuration:', error);
      throw error;
    }
  }

  async save(): Promise<void> {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(this.data, null, 2));
      logger.info('Configuration saved successfully');
    } catch (error) {
      logger.error('Failed to save configuration:', error);
      throw error;
    }
  }

  get<T>(key: string): T {
    const parts = key.split('.');
    let value: any = this.data;

    for (const part of parts) {
      if (value === undefined) break;
      value = value[part];
    }

    if (value === undefined) {
      throw new Error(`Configuration key not found: ${key}`);
    }

    return value as T;
  }

  set(key: string, value: any): void {
    const parts = key.split('.');
    let current: any = this.data;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
  }

  private mergeConfig(target: any, source: any): any {
    for (const key in source) {
      if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!(key in target)) {
          target[key] = {};
        }
        this.mergeConfig(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }
}

export default Config.getInstance(); 