import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/ErrorHandler';
import { Store } from '../database/Store';
import { ConfigService } from '../services/ConfigService';
import { PluginManager } from '../services/PluginManager';
import { USBManager } from '../services/USBManager';
import { ModemManager } from '../services/ModemManager';
import { SMSHubAPI } from '../api/SMSHubAPI';
import { WebSocketService } from '../services/WebSocketService';
import { HealthMonitor } from '../services/HealthMonitor';
import { UpdateManager } from '../services/UpdateManager';
import { AuthService } from '../services/AuthService';

class Application {
  private window: BrowserWindow | null = null;
  private logger: Logger;
  private store: Store;
  private config: ConfigService;
  private pluginManager: PluginManager;
  private usbManager: USBManager;
  private modemManager: ModemManager;
  private api: SMSHubAPI;
  private wsService: WebSocketService;
  private healthMonitor: HealthMonitor;
  private updateManager: UpdateManager;
  private authService: AuthService;

  constructor() {
    this.logger = new Logger('Application');

    // Handle uncaught errors
    process.on('uncaughtException', ErrorHandler.handleUncaughtException);
    process.on('unhandledRejection', ErrorHandler.handleUnhandledRejection);
  }

  async initialize(): Promise<void> {
    try {
      // Initialize core services
      this.store = new Store();
      this.config = new ConfigService(this.store);
      await this.config.initialize();

      // Initialize API and auth
      this.api = new SMSHubAPI(this.config);
      this.authService = new AuthService(this.store, this.api, this.config);
      await this.authService.initialize();

      // Initialize device management
      this.usbManager = new USBManager(this.config);
      this.pluginManager = new PluginManager(this.store, this.config);
      this.modemManager = new ModemManager(
        this.usbManager,
        this.pluginManager,
        this.store,
        this.api,
        this.config
      );

      // Initialize supporting services
      this.wsService = new WebSocketService(this.store, this.config);
      this.healthMonitor = new HealthMonitor(
        this.store,
        this.modemManager,
        this.config,
        this.api
      );
      this.updateManager = new UpdateManager(
        this.config,
        this.store,
        this.api
      );

      // Initialize all services
      await this.usbManager.initialize();
      await this.pluginManager.initialize();
      await this.modemManager.initialize();
      await this.wsService.initialize();
      await this.healthMonitor.initialize();
      await this.updateManager.initialize();

      // Setup IPC handlers
      this.setupIPC();

      this.logger.info('Application initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  private setupIPC(): void {
    // Auth handlers
    ipcMain.handle('auth:login', async (_, username: string, password: string) => {
      return this.authService.login(username, password);
    });

    ipcMain.handle('auth:logout', async () => {
      return this.authService.logout();
    });

    // Plugin handlers
    ipcMain.handle('plugins:list', () => {
      return this.pluginManager.getPlugins();
    });

    ipcMain.handle('plugins:install', async (_, pluginPath: string) => {
      return this.pluginManager.installPlugin(pluginPath);
    });

    ipcMain.handle('plugins:enable', async (_, pluginName: string) => {
      return this.pluginManager.enablePlugin(pluginName);
    });

    ipcMain.handle('plugins:disable', async (_, pluginName: string) => {
      return this.pluginManager.disablePlugin(pluginName);
    });

    // Modem handlers
    ipcMain.handle('modems:list', () => {
      return this.modemManager.getAllModems();
    });

    ipcMain.handle('modems:send-sms', async (_, modemId: string, number: string, message: string) => {
      return this.modemManager.sendSMS(modemId, number, message);
    });

    ipcMain.handle('modems:reset', async (_, modemId: string) => {
      return this.modemManager.resetModem(modemId);
    });

    // Config handlers
    ipcMain.handle('config:get', () => {
      return this.config.getAll();
    });

    ipcMain.handle('config:set', async (_, path: string, value: any) => {
      return this.config.set(path, value);
    });

    ipcMain.handle('config:reset', async () => {
      return this.config.reset();
    });

    // System handlers
    ipcMain.handle('system:stats', async () => {
      return this.healthMonitor.getMetrics();
    });

    ipcMain.handle('system:check-update', async () => {
      return this.updateManager.checkForUpdates();
    });
  }

  async createWindow(): Promise<void> {
    this.window = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    if (process.env.NODE_ENV === 'development') {
      await this.window.loadURL('http://localhost:3000');
      this.window.webContents.openDevTools();
    } else {
      await this.window.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    this.window.on('closed', () => {
      this.window = null;
    });
  }

  async shutdown(): Promise<void> {
    try {
      // Shutdown all services in reverse order
      this.updateManager.shutdown();
      this.healthMonitor.shutdown();
      this.wsService.shutdown();
      this.modemManager.shutdown();
      this.pluginManager.shutdown?.();
      this.usbManager.shutdown();
      
      // Close database connection
      this.store.close();

      // Flush logs
      await Logger.flush();

      this.logger.info('Application shutdown complete');
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
    }
  }
}

// Create and start application
const application = new Application();

app.on('ready', async () => {
  try {
    await application.initialize();
    await application.createWindow();
  } catch (error) {
    console.error('Failed to start application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (application.window === null) {
    application.createWindow();
  }
});

app.on('before-quit', async () => {
  await application.shutdown();
}); 