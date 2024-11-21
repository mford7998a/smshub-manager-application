import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { Config } from './utils/Config';
import { Store } from './database/Store';
import { PluginManager } from './core/plugin-manager/PluginManager';
import { USBDetector } from './core/hardware/USBDetector';
import { SMSHubAPI } from './api/smshub/SMSHubAPI';
import { logger, ErrorHandler } from './utils/logger';
import { IPCHandler } from './ipc/IPCHandler';
import { ModemIPCHandler } from './ipc/ModemIPCHandler';
import { AutoflashService } from './services/AutoflashService';

class Application {
  private mainWindow: BrowserWindow | null = null;
  private store: Store;
  private pluginManager: PluginManager;
  private usbDetector: USBDetector;
  private smsHubAPI: SMSHubAPI;
  private config: Config;
  private autoflashService: AutoflashService;
  private ipcHandler: IPCHandler;
  private modemIPCHandler: ModemIPCHandler;

  constructor() {
    this.initializeServices();
    this.setupEventHandlers();
  }

  private async initializeServices(): Promise<void> {
    try {
      // Initialize configuration
      this.config = Config.getInstance();
      await this.config.load();

      // Initialize core services
      this.store = new Store(this.config.get('database').path);
      await this.store.initialize();

      this.pluginManager = new PluginManager(this.store);
      this.usbDetector = new USBDetector();
      this.smsHubAPI = new SMSHubAPI(this.config.get('smshub'));
      this.autoflashService = new AutoflashService(app.getPath('temp'));
      await this.autoflashService.initialize();

      // Initialize IPC handlers
      this.ipcHandler = new IPCHandler(
        this.store,
        this.pluginManager,
        this.smsHubAPI,
        this.autoflashService
      );

      this.modemIPCHandler = new ModemIPCHandler(
        this.pluginManager,
        this.store
      );

      logger.info('All services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    // USB device events
    this.usbDetector.on('device:added', async (device) => {
      try {
        const plugin = await this.pluginManager.createModemInstance(device);
        await this.registerModem(plugin);
      } catch (error) {
        ErrorHandler.handle(error as Error, 'USB device addition');
      }
    });

    this.usbDetector.on('device:removed', (device) => {
      this.pluginManager.handleModemDisconnect(device.path);
    });

    // Plugin events
    this.pluginManager.on('plugin:installed', (plugin) => {
      this.mainWindow?.webContents.send('plugin:installed', plugin);
    });

    this.pluginManager.on('plugin:uninstalled', (pluginId) => {
      this.mainWindow?.webContents.send('plugin:uninstalled', pluginId);
    });

    // Modem events
    this.pluginManager.on('modem:connected', (modem) => {
      this.mainWindow?.webContents.send('modem:connected', modem);
    });

    this.pluginManager.on('modem:disconnected', (modemId) => {
      this.mainWindow?.webContents.send('modem:disconnected', modemId);
    });

    // Application events
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        this.cleanup();
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });
  }

  private async registerModem(modem: any): Promise<void> {
    const [response, error] = await ErrorHandler.handleAsync(
      this.smsHubAPI.registerModem({
        imei: modem.info.imei,
        model: modem.info.model,
        operator: modem.info.operator
      }),
      'Modem registration'
    );

    if (error || !response?.success) {
      throw new Error('Failed to register modem with SMSHub');
    }

    await this.store.saveModem({
      id: response.modemId,
      pluginName: modem.constructor.name,
      devicePath: modem.devicePath,
      imei: modem.info.imei,
      iccid: modem.info.iccid,
      operator: modem.info.operator
    });
  }

  createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:3000');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, 'index.html'));
    }

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  async cleanup(): Promise<void> {
    try {
      await this.pluginManager.shutdownAll();
      this.usbDetector.stop();
      await this.store.close();
      await this.autoflashService.cleanup();
      logger.info('Application cleanup completed');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }
}

// Initialize application
const application = new Application();

app.whenReady().then(() => {
  application.createWindow();
}).catch((error) => {
  logger.error('Failed to initialize application:', error);
  app.quit();
}); 