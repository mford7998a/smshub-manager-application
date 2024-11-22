import { PluginManager } from '../../../src/services/PluginManager';
import { ConfigService } from '../../../src/services/ConfigService';
import { Store } from '../../../src/database/Store';
import { TestUtils } from '../../utils/TestUtils';
import * as path from 'path';
import * as fs from 'fs-extra';

describe('PluginManager', () => {
  let pluginManager: PluginManager;
  let store: Store;
  let config: ConfigService;
  let testPluginDir: string;

  beforeEach(async () => {
    store = await TestUtils.createTestStore();
    config = await TestUtils.createTestConfig();
    pluginManager = new PluginManager(store, config);
    
    // Create test plugin directory
    testPluginDir = path.join(__dirname, '../../temp/plugins');
    await fs.ensureDir(testPluginDir);
    
    TestUtils.mockLogger();
  });

  afterEach(async () => {
    await fs.remove(testPluginDir);
  });

  describe('Plugin Loading', () => {
    it('should load valid plugins', async () => {
      // Create test plugin
      await createTestPlugin('test-plugin', {
        name: 'test-plugin',
        version: '1.0.0',
        main: 'index.js',
        supportedModems: [{
          vendor: 'Test',
          models: ['Test1', 'Test2']
        }]
      });

      await pluginManager.initialize();
      const plugins = pluginManager.getPlugins();
      
      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe('test-plugin');
    });

    it('should validate plugin manifest', async () => {
      // Create invalid plugin
      await createTestPlugin('invalid-plugin', {
        name: 'invalid-plugin',
        version: '1.0.0'
        // Missing required fields
      });

      await expect(pluginManager.initialize()).rejects.toThrow();
    });

    it('should handle plugin dependencies', async () => {
      // Create dependent plugins
      await createTestPlugin('base-plugin', {
        name: 'base-plugin',
        version: '1.0.0',
        main: 'index.js',
        supportedModems: []
      });

      await createTestPlugin('dependent-plugin', {
        name: 'dependent-plugin',
        version: '1.0.0',
        main: 'index.js',
        supportedModems: [],
        dependencies: ['base-plugin']
      });

      await pluginManager.initialize();
      const plugins = pluginManager.getPlugins();
      
      expect(plugins).toHaveLength(2);
    });
  });

  describe('Plugin Management', () => {
    it('should enable/disable plugins', async () => {
      await createTestPlugin('test-plugin', {
        name: 'test-plugin',
        version: '1.0.0',
        main: 'index.js',
        supportedModems: []
      });

      await pluginManager.initialize();
      await pluginManager.enablePlugin('test-plugin');
      
      const plugin = await store.getPlugin('test-plugin');
      expect(plugin?.enabled).toBe(true);

      await pluginManager.disablePlugin('test-plugin');
      const updatedPlugin = await store.getPlugin('test-plugin');
      expect(updatedPlugin?.enabled).toBe(false);
    });

    it('should uninstall plugins', async () => {
      await createTestPlugin('test-plugin', {
        name: 'test-plugin',
        version: '1.0.0',
        main: 'index.js',
        supportedModems: []
      });

      await pluginManager.initialize();
      await pluginManager.uninstallPlugin('test-plugin');

      const plugins = pluginManager.getPlugins();
      expect(plugins).toHaveLength(0);
    });
  });

  describe('Modem Support', () => {
    it('should find plugin for modem', async () => {
      await createTestPlugin('modem-plugin', {
        name: 'modem-plugin',
        version: '1.0.0',
        main: 'index.js',
        supportedModems: [{
          vendor: 'TestVendor',
          models: ['TestModel']
        }]
      });

      await pluginManager.initialize();
      await pluginManager.enablePlugin('modem-plugin');

      const plugin = pluginManager.findPluginForModem({
        manufacturer: 'TestVendor',
        model: 'TestModel'
      });

      expect(plugin).toBeTruthy();
    });
  });

  // Helper function to create test plugins
  async function createTestPlugin(name: string, manifest: any): Promise<void> {
    const pluginDir = path.join(testPluginDir, name);
    await fs.ensureDir(pluginDir);
    await fs.writeJson(path.join(pluginDir, 'manifest.json'), manifest);
    
    // Create dummy plugin file
    await fs.writeFile(
      path.join(pluginDir, 'index.js'),
      'module.exports = class TestPlugin {}'
    );
  }
}); 