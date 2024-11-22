import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { ConfigService } from './ConfigService';
import { Store } from '../database/Store';
import { SMSHubAPI } from '../api/SMSHubAPI';
import * as path from 'path';
import * as fs from 'fs-extra';
import { app } from 'electron';
import { createHash } from 'crypto';
import axios from 'axios';

interface UpdateInfo {
  version: string;
  url: string;
  hash: string;
  releaseNotes: string;
  minVersion: string;
  publishedAt: string;
}

interface PluginUpdate {
  name: string;
  version: string;
  url: string;
  hash: string;
  changes: string[];
}

export class UpdateManager extends EventEmitter {
  private logger: Logger;
  private config: ConfigService;
  private store: Store;
  private api: SMSHubAPI;
  private updateCheckInterval?: NodeJS.Timeout;
  private updating: boolean = false;

  constructor(
    config: ConfigService,
    store: Store,
    api: SMSHubAPI
  ) {
    super();
    this.logger = new Logger('UpdateManager');
    this.config = config;
    this.store = store;
    this.api = api;
  }

  async initialize(): Promise<void> {
    try {
      await this.startUpdateChecks();
      this.logger.info('Update Manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Update Manager:', error);
      throw error;
    }
  }

  private async startUpdateChecks(): Promise<void> {
    const interval = this.config.get('updates.checkInterval', 3600000); // 1 hour
    
    this.updateCheckInterval = setInterval(
      () => this.checkForUpdates(),
      interval
    );

    // Initial check
    await this.checkForUpdates();
  }

  private async checkForUpdates(): Promise<void> {
    if (this.updating) return;

    try {
      // Check for app updates
      const appUpdate = await this.checkAppUpdate();
      if (appUpdate) {
        this.emit('update:available', appUpdate);
      }

      // Check for plugin updates
      const pluginUpdates = await this.checkPluginUpdates();
      if (pluginUpdates.length > 0) {
        this.emit('plugin:updates', pluginUpdates);
      }
    } catch (error) {
      this.logger.error('Failed to check for updates:', error);
    }
  }

  private async checkAppUpdate(): Promise<UpdateInfo | null> {
    try {
      const response = await axios.get(
        this.config.get('updates.checkUrl')
      );

      const update = response.data as UpdateInfo;
      const currentVersion = app.getVersion();

      if (this.isNewerVersion(update.version, currentVersion)) {
        return update;
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to check app update:', error);
      return null;
    }
  }

  private async checkPluginUpdates(): Promise<PluginUpdate[]> {
    try {
      const plugins = await this.store.getPlugins();
      const updates: PluginUpdate[] = [];

      for (const plugin of plugins) {
        const update = await this.checkPluginUpdate(plugin);
        if (update) {
          updates.push(update);
        }
      }

      return updates;
    } catch (error) {
      this.logger.error('Failed to check plugin updates:', error);
      return [];
    }
  }

  private async checkPluginUpdate(plugin: any): Promise<PluginUpdate | null> {
    try {
      const response = await axios.get(
        `${this.config.get('updates.pluginCheckUrl')}/${plugin.name}`
      );

      const update = response.data;
      if (this.isNewerVersion(update.version, plugin.version)) {
        return update;
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to check update for plugin ${plugin.name}:`, error);
      return null;
    }
  }

  async installUpdate(update: UpdateInfo): Promise<boolean> {
    if (this.updating) {
      throw new Error('Update already in progress');
    }

    this.updating = true;
    try {
      // Download update
      const updatePath = await this.downloadUpdate(update);
      
      // Verify hash
      if (!await this.verifyUpdate(updatePath, update.hash)) {
        throw new Error('Update verification failed');
      }

      // Install update
      await this.performUpdate(updatePath);

      this.emit('update:installed', update.version);
      return true;
    } catch (error) {
      this.logger.error('Failed to install update:', error);
      this.emit('update:error', error);
      return false;
    } finally {
      this.updating = false;
    }
  }

  async installPluginUpdate(update: PluginUpdate): Promise<boolean> {
    if (this.updating) {
      throw new Error('Update already in progress');
    }

    this.updating = true;
    try {
      // Download plugin update
      const updatePath = await this.downloadPluginUpdate(update);
      
      // Verify hash
      if (!await this.verifyUpdate(updatePath, update.hash)) {
        throw new Error('Plugin update verification failed');
      }

      // Install plugin update
      await this.performPluginUpdate(update.name, updatePath);

      this.emit('plugin:updated', update);
      return true;
    } catch (error) {
      this.logger.error('Failed to install plugin update:', error);
      this.emit('plugin:update:error', error);
      return false;
    } finally {
      this.updating = false;
    }
  }

  private async downloadUpdate(update: UpdateInfo): Promise<string> {
    const updatePath = path.join(app.getPath('temp'), 'update.zip');
    
    const response = await axios({
      url: update.url,
      method: 'GET',
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(updatePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(updatePath));
      writer.on('error', reject);
    });
  }

  private async downloadPluginUpdate(update: PluginUpdate): Promise<string> {
    const updatePath = path.join(
      app.getPath('temp'),
      `${update.name}-${update.version}.zip`
    );
    
    const response = await axios({
      url: update.url,
      method: 'GET',
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(updatePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(updatePath));
      writer.on('error', reject);
    });
  }

  private async verifyUpdate(filePath: string, expectedHash: string): Promise<boolean> {
    const fileBuffer = await fs.readFile(filePath);
    const hash = createHash('sha256').update(fileBuffer).digest('hex');
    return hash === expectedHash;
  }

  private async performUpdate(updatePath: string): Promise<void> {
    // Implementation depends on platform and update mechanism
    throw new Error('Not implemented');
  }

  private async performPluginUpdate(
    pluginName: string,
    updatePath: string
  ): Promise<void> {
    const pluginDir = path.join(
      app.getPath('userData'),
      'plugins',
      pluginName
    );

    // Backup existing plugin
    const backupDir = `${pluginDir}.backup`;
    await fs.move(pluginDir, backupDir);

    try {
      // Extract update
      await this.extractPlugin(updatePath, pluginDir);
      
      // Clean up backup
      await fs.remove(backupDir);
    } catch (error) {
      // Restore backup on failure
      await fs.remove(pluginDir);
      await fs.move(backupDir, pluginDir);
      throw error;
    }
  }

  private async extractPlugin(
    updatePath: string,
    targetDir: string
  ): Promise<void> {
    // Implementation depends on archive format
    throw new Error('Not implemented');
  }

  private isNewerVersion(newVersion: string, currentVersion: string): boolean {
    const [newMajor, newMinor, newPatch] = newVersion.split('.').map(Number);
    const [curMajor, curMinor, curPatch] = currentVersion.split('.').map(Number);

    if (newMajor > curMajor) return true;
    if (newMajor < curMajor) return false;

    if (newMinor > curMinor) return true;
    if (newMinor < curMinor) return false;

    return newPatch > curPatch;
  }

  shutdown(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
    }
  }
} 
} 