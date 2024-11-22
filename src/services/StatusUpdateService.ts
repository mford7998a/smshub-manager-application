import { EventEmitter } from 'events';
import { Store } from '../database/Store';
import { PluginManager } from './PluginManager';
import { ModemManager } from './ModemManager';
import { SMSHubAPI } from '../api/SMSHubAPI';
import { Logger } from '../utils/logger';
import { ConfigService } from './ConfigService';

interface SystemStatus {
  connected: boolean;
  activeModems: number;
  messagesProcessed: number;
  successRate: number;
  error: string | null;
  lastUpdate: Date;
  apiStatus: {
    connected: boolean;
    lastSync: Date | null;
    error: string | null;
  };
  resources: {
    cpu: number;
    memory: number;
    uptime: number;
  };
}

export class StatusUpdateService extends EventEmitter {
  private logger: Logger;
  private store: Store;
  private pluginManager: PluginManager;
  private modemManager: ModemManager;
  private api: SMSHubAPI;
  private config: ConfigService;
  private updateInterval?: NodeJS.Timeout;
  private status: SystemStatus;

  constructor(
    store: Store,
    pluginManager: PluginManager,
    modemManager: ModemManager,
    api: SMSHubAPI,
    config: ConfigService
  ) {
    super();
    this.logger = new Logger('StatusUpdateService');
    this.store = store;
    this.pluginManager = pluginManager;
    this.modemManager = modemManager;
    this.api = api;
    this.config = config;

    this.status = this.getInitialStatus();
    this.setupEventListeners();
  }

  private getInitialStatus(): SystemStatus {
    return {
      connected: false,
      activeModems: 0,
      messagesProcessed: 0,
      successRate: 0,
      error: null,
      lastUpdate: new Date(),
      apiStatus: {
        connected: false,
        lastSync: null,
        error: null
      },
      resources: {
        cpu: 0,
        memory: 0,
        uptime: 0
      }
    };
  }

  async initialize(): Promise<void> {
    try {
      await this.updateStatus();
      this.startUpdateInterval();
      this.logger.info('Status Update Service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Status Update Service:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    // Modem events
    this.modemManager.on('modem:connected', this.handleModemConnected.bind(this));
    this.modemManager.on('modem:disconnected', this.handleModemDisconnected.bind(this));
    this.modemManager.on('modem:error', this.handleModemError.bind(this));

    // API events
    this.api.on('connected', this.handleApiConnected.bind(this));
    this.api.on('disconnected', this.handleApiDisconnected.bind(this));
    this.api.on('error', this.handleApiError.bind(this));

    // Plugin events
    this.pluginManager.on('plugin:error', this.handlePluginError.bind(this));
  }

  private startUpdateInterval(): void {
    const interval = this.config.get('status.updateInterval', 5000);
    this.updateInterval = setInterval(async () => {
      await this.updateStatus();
    }, interval);
  }

  private async updateStatus(): Promise<void> {
    try {
      const modems = this.modemManager.getAllModems();
      const messages = await this.store.getMessages({ 
        limit: 1000,
        timeframe: '24h'
      });

      // Update status
      this.status.activeModems = modems.length;
      this.status.messagesProcessed = messages.length;
      this.status.successRate = this.calculateSuccessRate(messages);
      this.status.lastUpdate = new Date();
      this.status.resources = await this.getSystemResources();

      // Emit update event
      this.emit('status:updated', this.getStatus());

      // Update API if connected
      if (this.status.apiStatus.connected) {
        await this.api.updateStatus(this.getStatus());
      }
    } catch (error) {
      this.logger.error('Failed to update status:', error);
      this.status.error = error.message;
      this.emit('status:error', error);
    }
  }

  // Event handlers
  private handleModemConnected(modemId: string): void {
    this.updateStatus();
  }

  private handleModemDisconnected(modemId: string): void {
    this.updateStatus();
  }

  private handleModemError(error: Error): void {
    this.status.error = error.message;
    this.emit('status:error', error);
  }

  private handleApiConnected(): void {
    this.status.apiStatus.connected = true;
    this.status.apiStatus.error = null;
    this.status.apiStatus.lastSync = new Date();
    this.emit('status:updated', this.getStatus());
  }

  private handleApiDisconnected(): void {
    this.status.apiStatus.connected = false;
    this.emit('status:updated', this.getStatus());
  }

  private handleApiError(error: Error): void {
    this.status.apiStatus.error = error.message;
    this.emit('status:error', error);
  }

  private handlePluginError(error: Error): void {
    this.status.error = error.message;
    this.emit('status:error', error);
  }

  // Utility methods
  private calculateSuccessRate(messages: any[]): number {
    if (!messages.length) return 0;
    const successful = messages.filter(m => m.status === 'sent').length;
    return (successful / messages.length) * 100;
  }

  private async getSystemResources(): Promise<SystemStatus['resources']> {
    const os = require('os');
    return {
      cpu: os.loadavg()[0],
      memory: (os.totalmem() - os.freemem()) / os.totalmem() * 100,
      uptime: os.uptime()
    };
  }

  // Public API
  getStatus(): SystemStatus {
    return { ...this.status };
  }

  shutdown(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
} 