import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { Store } from '../database/Store';
import { PluginManager } from './PluginManager';
import { USBManager } from './USBManager';
import { ATCommandProcessor } from './ATCommandProcessor';
import { ConfigService } from './ConfigService';

interface ModemStatus {
  id: string;
  status: 'initializing' | 'ready' | 'error' | 'disconnected';
  signalStrength?: number;
  operator?: string;
  error?: string;
  lastSeen: Date;
  messageCount: number;
  errorCount: number;
}

export class ModemManager extends EventEmitter {
  private logger: Logger;
  private store: Store;
  private pluginManager: PluginManager;
  private usbManager: USBManager;
  private atProcessor: ATCommandProcessor;
  private config: ConfigService;
  private modems: Map<string, any> = new Map();
  private modemStatuses: Map<string, ModemStatus> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    store: Store,
    pluginManager: PluginManager,
    usbManager: USBManager,
    config: ConfigService
  ) {
    super();
    this.logger = new Logger('ModemManager');
    this.store = store;
    this.pluginManager = pluginManager;
    this.usbManager = usbManager;
    this.atProcessor = new ATCommandProcessor();
    this.config = config;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.usbManager.on('device:attached', this.handleDeviceAttached.bind(this));
    this.usbManager.on('device:detached', this.handleDeviceDetached.bind(this));
  }

  async initialize(): Promise<void> {
    try {
      // Load saved modem configurations
      const savedModems = await this.store.getModems();
      for (const modem of savedModems) {
        this.modemStatuses.set(modem.id, {
          id: modem.id,
          status: 'disconnected',
          lastSeen: new Date(),
          messageCount: 0,
          errorCount: 0
        });
      }

      // Start health monitoring
      this.startHealthMonitoring();
      
      this.logger.info('Modem Manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Modem Manager:', error);
      throw error;
    }
  }

  private async handleDeviceAttached(device: USBDevice): Promise<void> {
    try {
      // Get modem information
      const modemInfo = await this.atProcessor.getModemInfo(device);
      
      // Find appropriate plugin
      const plugin = this.pluginManager.findPluginForModem({
        manufacturer: modemInfo.manufacturer,
        model: modemInfo.model
      });

      if (!plugin) {
        throw new Error(`No plugin found for modem: ${modemInfo.manufacturer} ${modemInfo.model}`);
      }

      // Create modem instance
      const modem = await this.pluginManager.createModemInstance(plugin.manifest.name, device);
      const modemId = modemInfo.imei;

      // Initialize modem
      await modem.initialize();
      
      // Save modem configuration
      await this.store.saveModem({
        id: modemId,
        pluginName: plugin.manifest.name,
        devicePath: device.serialNumber || device.productId.toString(),
        imei: modemInfo.imei,
        operator: await this.atProcessor.getNetworkInfo(device).then(info => info.operator)
      });

      // Update status
      this.modems.set(modemId, modem);
      this.modemStatuses.set(modemId, {
        id: modemId,
        status: 'ready',
        signalStrength: await this.atProcessor.getSignalStrength(device),
        operator: await this.atProcessor.getNetworkInfo(device).then(info => info.operator),
        lastSeen: new Date(),
        messageCount: 0,
        errorCount: 0
      });

      this.emit('modem:connected', modemId);
      this.logger.info(`Modem connected: ${modemId}`);
    } catch (error) {
      this.logger.error('Failed to handle device attachment:', error);
      this.emit('modem:error', { deviceId: device.serialNumber, error });
    }
  }

  private async handleDeviceDetached(device: USBDevice): Promise<void> {
    const modemId = Array.from(this.modems.entries())
      .find(([_, modem]) => modem.device === device)?.[0];

    if (modemId) {
      this.modems.delete(modemId);
      if (this.modemStatuses.has(modemId)) {
        this.modemStatuses.get(modemId)!.status = 'disconnected';
      }
      this.emit('modem:disconnected', modemId);
      this.logger.info(`Modem disconnected: ${modemId}`);
    }
  }

  private startHealthMonitoring(): void {
    const interval = this.config.get('modem.healthCheckInterval', 30000);
    this.healthCheckInterval = setInterval(() => this.checkModemHealth(), interval);
  }

  private async checkModemHealth(): Promise<void> {
    for (const [modemId, modem] of this.modems.entries()) {
      try {
        const device = modem.device;
        const signalStrength = await this.atProcessor.getSignalStrength(device);
        const networkInfo = await this.atProcessor.getNetworkInfo(device);

        const status = this.modemStatuses.get(modemId)!;
        status.signalStrength = signalStrength;
        status.operator = networkInfo.operator;
        status.lastSeen = new Date();

        this.emit('modem:status', {
          modemId,
          status: 'ready',
          signalStrength,
          operator: networkInfo.operator
        });
      } catch (error) {
        this.logger.error(`Health check failed for modem ${modemId}:`, error);
        this.handleModemError(modemId, error as Error);
      }
    }
  }

  private handleModemError(modemId: string, error: Error): void {
    const status = this.modemStatuses.get(modemId);
    if (status) {
      status.status = 'error';
      status.error = error.message;
      status.errorCount++;
      this.emit('modem:error', { modemId, error });
    }
  }

  // Public API methods
  async sendSMS(modemId: string, recipient: string, message: string): Promise<boolean> {
    const modem = this.modems.get(modemId);
    if (!modem) {
      throw new Error(`Modem ${modemId} not found`);
    }

    try {
      await modem.sendSMS(recipient, message);
      
      const status = this.modemStatuses.get(modemId)!;
      status.messageCount++;
      
      return true;
    } catch (error) {
      this.handleModemError(modemId, error as Error);
      return false;
    }
  }

  getModemStatus(modemId: string): ModemStatus | undefined {
    return this.modemStatuses.get(modemId);
  }

  getAllModemStatuses(): ModemStatus[] {
    return Array.from(this.modemStatuses.values());
  }

  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Cleanup all modems
    for (const [modemId, modem] of this.modems.entries()) {
      try {
        modem.cleanup();
      } catch (error) {
        this.logger.error(`Error cleaning up modem ${modemId}:`, error);
      }
    }

    this.modems.clear();
    this.modemStatuses.clear();
  }
} 