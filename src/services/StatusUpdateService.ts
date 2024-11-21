import { EventEmitter } from 'events';
import { Store } from '../database/Store';
import { PluginManager } from '../core/plugin-manager/PluginManager';
import { SMSHubAPI } from '../api/smshub/SMSHubAPI';
import { logger } from '../utils/logger';

interface SystemStatus {
  connected: boolean;
  activeModems: number;
  messagesProcessed: number;
  successRate: number;
  error: string | null;
}

export class StatusUpdateService extends EventEmitter {
  private updateInterval: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private systemStatus: SystemStatus = {
    connected: false,
    activeModems: 0,
    messagesProcessed: 0,
    successRate: 0,
    error: null
  };

  constructor(
    private store: Store,
    private pluginManager: PluginManager,
    private smsHubAPI: SMSHubAPI,
    private updateFrequency: number = 5000,
    private pingFrequency: number = 30000
  ) {
    super();
  }

  start(): void {
    // Start periodic status updates
    this.updateInterval = setInterval(
      this.updateStatus.bind(this),
      this.updateFrequency
    );

    // Start API connectivity check
    this.pingInterval = setInterval(
      this.checkConnectivity.bind(this),
      this.pingFrequency
    );

    // Set up event listeners
    this.setupEventListeners();

    logger.info('Status update service started');
  }

  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    logger.info('Status update service stopped');
  }

  private async updateStatus(): Promise<void> {
    try {
      // Get active modems count
      const activeModems = Array.from(this.pluginManager.getActiveModems().values());

      // Get message statistics for the last 24 hours
      const stats = await this.store.getStatsSummary('24h');

      // Update system status
      this.systemStatus = {
        connected: this.systemStatus.connected,
        activeModems: activeModems.length,
        messagesProcessed: stats.totalMessages,
        successRate: stats.successRate,
        error: null
      };

      // Update modem signal strengths and stats
      for (const modem of activeModems) {
        const signalStrength = modem.getSignalStrength();
        const networkInfo = modem.getNetworkInfo();

        await this.store.saveModemStats(modem.info!.imei, {
          signalStrength,
          technology: networkInfo.technology,
          band: networkInfo.band
        });

        this.emit('modem:status', {
          id: modem.info!.imei,
          signal: signalStrength,
          network: networkInfo
        });
      }

      // Emit updated status
      this.emit('status:updated', this.systemStatus);
    } catch (error) {
      logger.error('Failed to update status:', error);
      this.handleError(error as Error);
    }
  }

  private async checkConnectivity(): Promise<void> {
    try {
      const connected = await this.smsHubAPI.ping();
      
      if (connected !== this.systemStatus.connected) {
        this.systemStatus.connected = connected;
        this.systemStatus.error = connected ? null : 'API connection lost';
        this.emit('connectivity:changed', connected);
      }
    } catch (error) {
      logger.error('Failed to check connectivity:', error);
      this.handleError(error as Error);
    }
  }

  private setupEventListeners(): void {
    // Listen for modem events
    this.pluginManager.on('modem:connected', (modem) => {
      this.emit('modem:connected', modem);
      this.updateStatus();
    });

    this.pluginManager.on('modem:disconnected', (modemId) => {
      this.emit('modem:disconnected', modemId);
      this.updateStatus();
    });

    this.pluginManager.on('modem:error', (error) => {
      this.handleError(error);
    });

    // Listen for plugin events
    this.pluginManager.on('plugin:installed', (plugin) => {
      this.emit('plugin:installed', plugin);
    });

    this.pluginManager.on('plugin:uninstalled', (pluginId) => {
      this.emit('plugin:uninstalled', pluginId);
    });

    this.pluginManager.on('plugin:error', (error) => {
      this.handleError(error);
    });
  }

  private handleError(error: Error): void {
    this.systemStatus.error = error.message;
    this.emit('error', error);
  }

  getSystemStatus(): SystemStatus {
    return { ...this.systemStatus };
  }

  async getDetailedStatus(): Promise<any> {
    try {
      const [stats, systemStats] = await Promise.all([
        this.store.getStatsSummary('24h'),
        this.smsHubAPI.getSystemStats()
      ]);

      return {
        system: this.systemStatus,
        stats: {
          ...stats,
          errorRate: systemStats.errorRate,
          messagesByStatus: systemStats.messagesByStatus
        },
        modems: Array.from(this.pluginManager.getActiveModems().values()).map(modem => ({
          id: modem.info!.imei,
          model: modem.info!.model,
          operator: modem.info!.operator,
          signal: modem.getSignalStrength(),
          network: modem.getNetworkInfo(),
          uptime: modem.getUptime(),
          errorCount: modem.getErrorCount()
        }))
      };
    } catch (error) {
      logger.error('Failed to get detailed status:', error);
      throw error;
    }
  }
} 