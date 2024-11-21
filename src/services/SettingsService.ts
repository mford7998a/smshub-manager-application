import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger';

export class SettingsService {
  private static instance: SettingsService;
  private configPath: string;
  private settings: any;

  private constructor() {
    this.configPath = path.join(app.getPath('userData'), 'settings.json');
    this.settings = {};
  }

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  async load(): Promise<void> {
    try {
      const exists = await fs.access(this.configPath)
        .then(() => true)
        .catch(() => false);

      if (exists) {
        const content = await fs.readFile(this.configPath, 'utf-8');
        this.settings = JSON.parse(content);
        logger.info('Settings loaded successfully');
      } else {
        await this.save();
        logger.info('Default settings created');
      }
    } catch (error) {
      logger.error('Failed to load settings:', error);
      throw error;
    }
  }

  async save(): Promise<void> {
    try {
      await fs.writeFile(
        this.configPath,
        JSON.stringify(this.settings, null, 2)
      );
      logger.info('Settings saved successfully');
    } catch (error) {
      logger.error('Failed to save settings:', error);
      throw error;
    }
  }

  get<T>(key: string): T {
    const parts = key.split('.');
    let value: any = this.settings;

    for (const part of parts) {
      if (value === undefined) break;
      value = value[part];
    }

    if (value === undefined) {
      throw new Error(`Setting not found: ${key}`);
    }

    return value as T;
  }

  set(key: string, value: any): void {
    const parts = key.split('.');
    let current: any = this.settings;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
  }

  getAll(): any {
    return { ...this.settings };
  }

  setAll(settings: any): void {
    this.settings = { ...settings };
  }

  async reset(): Promise<void> {
    this.settings = {};
    await this.save();
  }
}

export default SettingsService.getInstance(); 