import { EventEmitter } from 'events';
import { Store } from '../database/Store';
import { PluginManager } from '../core/plugin-manager/PluginManager';
import { WebSocketService } from './WebSocketService';
import { StatusUpdateService } from './StatusUpdateService';
import { logger } from '../utils/logger';

export class RealTimeManager extends EventEmitter {
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(
    private store: Store,
    private pluginManager: PluginManager,
    private wsService: WebSocketService,
    private statusService: StatusUpdateService,
    private updateFrequency: number = 1000
  ) {
    super();
    this.initialize();
  }

  private initialize(): void {
    // Listen for modem events
    this.pluginManager.on('modem:connected', (modem) => {
      this.wsService.broadcastModemUpdate(modem.imei, {
        status: 'connected',
        info: modem
      });
    });

    this.pluginManager.on('modem:disconnected', (modemId) => {
      this.wsService.broadcastModemUpdate(modemId, {
        status: 'disconnected'
      });
    });

    // Listen for status updates
    this.statusService.on('status:updated', (status) => {
      this.wsService.broadcastSystemStatus(status);
    });

    // Listen for errors
    this.statusService.on('error', (error) => {
      this.wsService.broadcastError(error);
    });

    // Start periodic updates
    this.startUpdates();
  }

  private startUpdates(): void {
    this.updateInterval = setInterval(async () => {
      try {
        await this.broadcastModemStats();
      } catch (error) {
        logger.error('Failed to broadcast modem stats:', error);
      }
    }, this.updateFrequency);
  }

  private async broadcastModemStats(): Promise<void> {
    const modems = Array.from(this.pluginManager.getActiveModems().values());
    
    for (const modem of modems) {
      const stats = {
        signal: modem.getSignalStrength(),
        network: modem.getNetworkInfo(),
        uptime: modem.getUptime(),
        errorCount: modem.getErrorCount()
      };

      this.wsService.broadcastModemUpdate(modem.info!.imei, {
        status: 'updated',
        stats
      });
    }
  }

  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
} 