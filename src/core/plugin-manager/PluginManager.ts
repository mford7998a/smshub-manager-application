import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import { Store } from '../../database/Store';
import { ModemPlugin } from './ModemPlugin';
import { logger } from '../../utils/logger';

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  author: string;
  description: string;
  supportedModels: string[];
  stats: {
    activeModems: number;
    messagesProcessed: number;
    successRate: number;
  };
}

export class PluginManager extends EventEmitter {
  private plugins: Map<string, any> = new Map();
  private activeModems: Map<string, ModemPlugin> = new Map();
  private pluginsDir: string = path.join(__dirname, '../../../plugins');

  constructor(private store: Store) {
    super();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.loadPlugins();
      await this.enableStoredPlugins();
    } catch (error) {
      logger.error('Failed to initialize plugin manager:', error);
      throw error;
    }
  }

  private async loadPlugins(): Promise<void> {
    try {
      const entries = await fs.readdir(this.pluginsDir, { withFileTypes: true });
      const pluginDirs = entries.filter(entry => entry.isDirectory());

      for (const dir of pluginDirs) {
        try {
          const pluginPath = path.join(this.pluginsDir, dir.name);
          const plugin = require(pluginPath);
          this.plugins.set(dir.name, plugin);
          logger.info(`Loaded plugin: ${dir.name}`);
        } catch (error) {
          logger.error(`Failed to load plugin ${dir.name}:`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to load plugins:', error);
      throw error;
    }
  }

  private async enableStoredPlugins(): Promise<void> {
    try {
      const enabledPlugins = await this.store.getEnabledPlugins();
      for (const pluginId of enabledPlugins) {
        if (this.plugins.has(pluginId)) {
          await this.enablePlugin(pluginId);
        }
      }
    } catch (error) {
      logger.error('Failed to enable stored plugins:', error);
      throw error;
    }
  }

  async installPlugin(filePath: string): Promise<boolean> {
    try {
      // Extract plugin to plugins directory
      const pluginId = path.basename(filePath, '.zip');
      const extractPath = path.join(this.pluginsDir, pluginId);
      
      // Create plugin directory
      await fs.mkdir(extractPath, { recursive: true });
      
      // Copy plugin files
      await fs.copyFile(filePath, path.join(extractPath, 'index.js'));
      
      // Load plugin
      const plugin = require(extractPath);
      this.plugins.set(pluginId, plugin);
      
      // Enable plugin
      await this.enablePlugin(pluginId);
      
      this.emit('plugin:installed', { id: pluginId, ...plugin });
      return true;
    } catch (error) {
      logger.error('Failed to install plugin:', error);
      throw error;
    }
  }

  async uninstallPlugin(pluginId: string): Promise<boolean> {
    try {
      // Disable plugin first
      await this.disablePlugin(pluginId);
      
      // Remove plugin files
      const pluginPath = path.join(this.pluginsDir, pluginId);
      await fs.rm(pluginPath, { recursive: true, force: true });
      
      // Remove from plugins map
      this.plugins.delete(pluginId);
      
      this.emit('plugin:uninstalled', pluginId);
      return true;
    } catch (error) {
      logger.error('Failed to uninstall plugin:', error);
      throw error;
    }
  }

  async enablePlugin(pluginId: string): Promise<boolean> {
    try {
      const plugin = this.plugins.get(pluginId);
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`);
      }
      
      await this.store.enablePlugin(pluginId);
      plugin.enabled = true;
      
      this.emit('plugin:enabled', pluginId);
      return true;
    } catch (error) {
      logger.error('Failed to enable plugin:', error);
      throw error;
    }
  }

  async disablePlugin(pluginId: string): Promise<boolean> {
    try {
      const plugin = this.plugins.get(pluginId);
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`);
      }
      
      await this.store.disablePlugin(pluginId);
      plugin.enabled = false;
      
      // Disconnect all modems using this plugin
      for (const [devicePath, modem] of this.activeModems.entries()) {
        if (modem.constructor.name === pluginId) {
          await this.handleModemDisconnect(devicePath);
        }
      }
      
      this.emit('plugin:disabled', pluginId);
      return true;
    } catch (error) {
      logger.error('Failed to disable plugin:', error);
      throw error;
    }
  }

  async createModemInstance(pluginName: string, devicePath: string): Promise<ModemPlugin> {
    try {
      const plugin = this.plugins.get(pluginName);
      if (!plugin || !plugin.enabled) {
        throw new Error(`Plugin ${pluginName} not found or disabled`);
      }
      
      const modem = new plugin.default(devicePath);
      await modem.connect();
      
      this.activeModems.set(devicePath, modem);
      this.emit('modem:connected', modem.info);
      
      return modem;
    } catch (error) {
      logger.error('Failed to create modem instance:', error);
      throw error;
    }
  }

  async handleModemDisconnect(devicePath: string): Promise<void> {
    try {
      const modem = this.activeModems.get(devicePath);
      if (modem) {
        await modem.disconnect();
        this.activeModems.delete(devicePath);
        this.emit('modem:disconnected', modem.info?.imei);
      }
    } catch (error) {
      logger.error('Failed to handle modem disconnect:', error);
      throw error;
    }
  }

  async shutdownAll(): Promise<void> {
    try {
      const disconnectPromises = Array.from(this.activeModems.values())
        .map(modem => modem.disconnect());
      await Promise.all(disconnectPromises);
      this.activeModems.clear();
    } catch (error) {
      logger.error('Failed to shutdown all modems:', error);
      throw error;
    }
  }

  getPlugins(): Map<string, any> {
    return this.plugins;
  }

  getActiveModems(): Map<string, ModemPlugin> {
    return this.activeModems;
  }
} 