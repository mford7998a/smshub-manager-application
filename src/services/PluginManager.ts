import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/ErrorHandler';
import { Store } from '../database/Store';
import { ConfigService } from './ConfigService';
import * as path from 'path';
import * as fs from 'fs-extra';
import { createHash } from 'crypto';
import { Device as USBDevice } from 'usb';
import type { PluginManifest } from '../types/plugin';

interface LoadedPlugin {
  manifest: PluginManifest;
  instance: any;
  enabled: boolean;
  path: string;
  hash: string;
}

export class PluginManager extends EventEmitter {
  private readonly logger: Logger;
  private readonly plugins: Map<string, LoadedPlugin> = new Map();
  private readonly store: Store;
  private readonly config: ConfigService;
  private readonly pluginsDir: string;

  constructor(store: Store, config: ConfigService) {
    super();
    this.logger = new Logger('PluginManager');
    this.store = store;
    this.config = config;
    this.pluginsDir = path.join(process.cwd(), 'plugins');
  }

  public async initialize(): Promise<void> {
    try {
      await this.ensurePluginDirectory();
      await this.loadPlugins();
      this.logger.info('Plugin Manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Plugin Manager:', error);
      throw error;
    }
  }

  private async ensurePluginDirectory(): Promise<void> {
    await fs.ensureDir(this.pluginsDir);
  }

  private async loadPlugins(): Promise<void> {
    const pluginDirs = await fs.readdir(this.pluginsDir);
    
    for (const dir of pluginDirs) {
      try {
        await this.loadPlugin(dir);
      } catch (error) {
        this.logger.error(`Failed to load plugin ${dir}:`, error);
      }
    }
  }

  private async loadPlugin(pluginDir: string): Promise<void> {
    const pluginPath = path.join(this.pluginsDir, pluginDir);
    const manifestPath = path.join(pluginPath, 'manifest.json');

    try {
      // Verify plugin structure
      if (!await fs.pathExists(manifestPath)) {
        throw new Error('Missing manifest.json');
      }

      // Load and validate manifest
      const manifest = await fs.readJson(manifestPath) as PluginManifest;
      this.validateManifest(manifest);

      // Check dependencies
      await this.checkDependencies(manifest);

      // Calculate plugin hash
      const hash = await this.calculatePluginHash(pluginPath);

      // Load plugin module
      const pluginModule = require(path.join(pluginPath, manifest.main));
      
      // Create plugin instance
      const instance = new pluginModule.default();

      // Get enabled status from store
      const enabled = await this.store.isPluginEnabled(manifest.name);

      // Store plugin info
      this.plugins.set(manifest.name, {
        manifest,
        instance,
        enabled,
        path: pluginPath,
        hash
      });

      this.emit('plugin:loaded', {
        name: manifest.name,
        version: manifest.version,
        enabled
      });

      this.logger.info(`Plugin loaded: ${manifest.name} v${manifest.version}`);
    } catch (error) {
      this.logger.error(`Failed to load plugin from ${pluginDir}:`, error);
      throw error;
    }
  }

  private validateManifest(manifest: PluginManifest): void {
    const required = ['name', 'version', 'main', 'supportedModems'];
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (manifest.minAppVersion) {
      // TODO: Implement version compatibility check
    }
  }

  private async checkDependencies(manifest: PluginManifest): Promise<void> {
    if (!manifest.dependencies) return;

    for (const dep of manifest.dependencies) {
      if (!this.plugins.has(dep)) {
        throw new Error(`Missing dependency: ${dep}`);
      }
    }
  }

  private async calculatePluginHash(pluginPath: string): Promise<string> {
    const hash = createHash('sha256');
    const files = await fs.readdir(pluginPath);

    for (const file of files) {
      const content = await fs.readFile(path.join(pluginPath, file));
      hash.update(content);
    }

    return hash.digest('hex');
  }

  public async installPlugin(pluginPath: string): Promise<void> {
    try {
      // Extract plugin if needed
      const extractedPath = await this.extractPlugin(pluginPath);
      
      // Verify plugin structure
      await this.verifyPlugin(extractedPath);
      
      // Load plugin
      await this.loadPlugin(path.basename(extractedPath));
      
      this.logger.info(`Plugin installed: ${extractedPath}`);
    } catch (error) {
      this.logger.error('Failed to install plugin:', error);
      throw error;
    }
  }

  private async extractPlugin(pluginPath: string): Promise<string> {
    // TODO: Implement plugin extraction from zip/tar if needed
    return pluginPath;
  }

  private async verifyPlugin(pluginPath: string): Promise<void> {
    // TODO: Implement security checks
    // - Verify signatures
    // - Scan for malicious code
    // - Check permissions
  }

  public async enablePlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    try {
      await plugin.instance.enable?.();
      plugin.enabled = true;
      await this.store.enablePlugin(pluginName);
      
      this.emit('plugin:enabled', pluginName);
    } catch (error) {
      this.logger.error(`Failed to enable plugin ${pluginName}:`, error);
      throw error;
    }
  }

  public async disablePlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    try {
      await plugin.instance.disable?.();
      plugin.enabled = false;
      await this.store.disablePlugin(pluginName);
      
      this.emit('plugin:disabled', pluginName);
    } catch (error) {
      this.logger.error(`Failed to disable plugin ${pluginName}:`, error);
      throw error;
    }
  }

  public async uninstallPlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    try {
      // Disable plugin first
      if (plugin.enabled) {
        await this.disablePlugin(pluginName);
      }

      // Remove plugin files
      await fs.remove(plugin.path);
      
      // Remove from tracking
      this.plugins.delete(pluginName);
      
      // Remove from store
      await this.store.removePlugin(pluginName);
      
      this.emit('plugin:uninstalled', pluginName);
    } catch (error) {
      this.logger.error(`Failed to uninstall plugin ${pluginName}:`, error);
      throw error;
    }
  }

  public findPluginForModem(modemInfo: {
    manufacturer: string;
    model: string;
  }): LoadedPlugin | null {
    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled) continue;

      const supported = plugin.manifest.supportedModems.some(
        support => 
          support.vendor.toLowerCase() === modemInfo.manufacturer.toLowerCase() &&
          support.models.some(m => 
            modemInfo.model.toLowerCase().includes(m.toLowerCase())
          )
      );

      if (supported) {
        return plugin;
      }
    }

    return null;
  }

  public async createModemInstance(pluginName: string, device: USBDevice): Promise<any> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin || !plugin.enabled) {
      throw new Error(`Plugin ${pluginName} not found or disabled`);
    }

    return plugin.instance.createModem(device);
  }

  public getPlugins(): Array<{
    name: string;
    version: string;
    enabled: boolean;
    description: string;
    capabilities: PluginManifest['capabilities'];
  }> {
    return Array.from(this.plugins.values()).map(plugin => ({
      name: plugin.manifest.name,
      version: plugin.manifest.version,
      enabled: plugin.enabled,
      description: plugin.manifest.description,
      capabilities: plugin.manifest.capabilities
    }));
  }
} 