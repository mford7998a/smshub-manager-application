import { PluginManager } from '../../core/plugin-manager/PluginManager';
import { Store } from '../../database/Store';
import { join } from 'path';
import { tmpdir } from 'os';
import { ModemPlugin } from '../../core/plugin-manager/ModemPlugin';

// Mock Store
jest.mock('../../database/Store');

describe('PluginManager', () => {
  let pluginManager: PluginManager;
  let store: jest.Mocked<Store>;

  beforeEach(() => {
    store = new Store(join(tmpdir(), 'test.db')) as jest.Mocked<Store>;
    pluginManager = new PluginManager(store);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Plugin Management', () => {
    const testPluginId = 'test-plugin';
    const testPluginPath = join(__dirname, '../../plugins', testPluginId);

    test('should load plugins on initialization', async () => {
      store.getEnabledPlugins.mockResolvedValue([testPluginId]);
      await pluginManager['loadPlugins']();
      expect(pluginManager.getPlugins().size).toBeGreaterThan(0);
    });

    test('should install plugin', async () => {
      const installSpy = jest.spyOn(pluginManager, 'installPlugin');
      await pluginManager.installPlugin(testPluginPath);
      expect(installSpy).toHaveBeenCalledWith(testPluginPath);
      expect(store.enablePlugin).toHaveBeenCalledWith(testPluginId);
    });

    test('should uninstall plugin', async () => {
      const uninstallSpy = jest.spyOn(pluginManager, 'uninstallPlugin');
      await pluginManager.uninstallPlugin(testPluginId);
      expect(uninstallSpy).toHaveBeenCalledWith(testPluginId);
      expect(store.disablePlugin).toHaveBeenCalledWith(testPluginId);
    });

    test('should enable and disable plugin', async () => {
      await pluginManager.enablePlugin(testPluginId);
      expect(store.enablePlugin).toHaveBeenCalledWith(testPluginId);

      await pluginManager.disablePlugin(testPluginId);
      expect(store.disablePlugin).toHaveBeenCalledWith(testPluginId);
    });
  });

  describe('Modem Management', () => {
    const testDevicePath = '/dev/ttyUSB0';
    const testPluginName = 'test-plugin';

    test('should create modem instance', async () => {
      const modem = await pluginManager.createModemInstance(testPluginName, testDevicePath);
      expect(modem).toBeInstanceOf(ModemPlugin);
      expect(pluginManager.getActiveModems().size).toBe(1);
    });

    test('should handle modem disconnect', async () => {
      const modem = await pluginManager.createModemInstance(testPluginName, testDevicePath);
      await pluginManager.handleModemDisconnect(testDevicePath);
      expect(pluginManager.getActiveModems().size).toBe(0);
    });

    test('should shutdown all modems', async () => {
      await pluginManager.createModemInstance(testPluginName, testDevicePath);
      await pluginManager.createModemInstance(testPluginName, '/dev/ttyUSB1');
      await pluginManager.shutdownAll();
      expect(pluginManager.getActiveModems().size).toBe(0);
    });
  });

  describe('Event Handling', () => {
    test('should emit plugin events', async () => {
      const eventSpy = jest.fn();
      pluginManager.on('plugin:installed', eventSpy);
      await pluginManager.installPlugin('test-plugin');
      expect(eventSpy).toHaveBeenCalled();
    });

    test('should emit modem events', async () => {
      const eventSpy = jest.fn();
      pluginManager.on('modem:connected', eventSpy);
      await pluginManager.createModemInstance('test-plugin', '/dev/ttyUSB0');
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle plugin load errors', async () => {
      const errorSpy = jest.fn();
      pluginManager.on('error', errorSpy);
      await pluginManager.installPlugin('invalid-plugin');
      expect(errorSpy).toHaveBeenCalled();
    });

    test('should handle modem creation errors', async () => {
      const errorSpy = jest.fn();
      pluginManager.on('error', errorSpy);
      await expect(
        pluginManager.createModemInstance('invalid-plugin', '/dev/ttyUSB0')
      ).rejects.toThrow();
      expect(errorSpy).toHaveBeenCalled();
    });
  });
}); 