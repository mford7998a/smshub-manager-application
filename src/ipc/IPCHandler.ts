import { ipcMain } from 'electron';
import { Store } from '../database/Store';
import { PluginManager } from '../core/plugin-manager/PluginManager';
import { SMSHubAPI } from '../api/smshub/SMSHubAPI';
import { AutoflashService } from '../services/AutoflashService';
import { logger } from '../utils/logger';

export class IPCHandler {
  constructor(
    private store: Store,
    private pluginManager: PluginManager,
    private smsHubAPI: SMSHubAPI,
    private autoflashService: AutoflashService
  ) {
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Modem Management
    ipcMain.handle('getModems', async () => {
      try {
        const modems = Array.from(this.pluginManager.getActiveModems().values())
          .map(modem => ({
            id: modem.info?.imei,
            imei: modem.info?.imei,
            model: modem.info?.model,
            operator: modem.info?.operator,
            status: modem.isConnected ? 'online' : 'offline',
            signal: modem.getSignalStrength()
          }));
        return modems;
      } catch (error) {
        logger.error('Failed to get modems:', error);
        throw error;
      }
    });

    ipcMain.handle('getModemStats', async (_, modemId: string) => {
      try {
        return await this.store.getModemStats(modemId);
      } catch (error) {
        logger.error('Failed to get modem stats:', error);
        throw error;
      }
    });

    ipcMain.handle('sendSMS', async (_, data: { modemId: string; number: string; message: string }) => {
      try {
        const modem = Array.from(this.pluginManager.getActiveModems().values())
          .find(m => m.info?.imei === data.modemId);
        
        if (!modem) {
          throw new Error('Modem not found');
        }

        return await modem.sendSMS(data.number, data.message);
      } catch (error) {
        logger.error('Failed to send SMS:', error);
        throw error;
      }
    });

    // Message Management
    ipcMain.handle('getMessages', async () => {
      try {
        return await this.store.getMessages();
      } catch (error) {
        logger.error('Failed to get messages:', error);
        throw error;
      }
    });

    ipcMain.handle('retryMessage', async (_, messageId: number) => {
      try {
        const message = await this.store.getMessage(messageId);
        if (!message) {
          throw new Error('Message not found');
        }

        await this.smsHubAPI.reportSMS({
          modemId: message.modemId,
          message: message.message,
          sender: message.sender,
          timestamp: message.timestamp
        });

        await this.store.updateMessageStatus(messageId, 'sent');
        return true;
      } catch (error) {
        logger.error('Failed to retry message:', error);
        throw error;
      }
    });

    ipcMain.handle('deleteMessage', async (_, messageId: number) => {
      try {
        await this.store.deleteMessage(messageId);
        return true;
      } catch (error) {
        logger.error('Failed to delete message:', error);
        throw error;
      }
    });

    // Statistics
    ipcMain.handle('getStatistics', async (_, timeRange: string) => {
      try {
        return {
          summary: await this.store.getStatsSummary(timeRange),
          messageVolume: await this.store.getMessageVolume(timeRange),
          statusDistribution: await this.store.getStatusDistribution(timeRange),
          modemStats: await this.store.getModemPerformance(timeRange)
        };
      } catch (error) {
        logger.error('Failed to get statistics:', error);
        throw error;
      }
    });

    // Plugin Management
    ipcMain.handle('getPlugins', async () => {
      try {
        return Array.from(this.pluginManager.getPlugins().entries())
          .map(([id, plugin]) => ({
            id,
            name: plugin.name,
            version: plugin.version,
            enabled: plugin.enabled,
            author: plugin.author,
            description: plugin.description,
            supportedModels: plugin.supportedModels,
            stats: plugin.stats
          }));
      } catch (error) {
        logger.error('Failed to get plugins:', error);
        throw error;
      }
    });

    ipcMain.handle('installPlugin', async (_, file: Electron.FilePathWithHeaders) => {
      try {
        return await this.pluginManager.installPlugin(file.filePath);
      } catch (error) {
        logger.error('Failed to install plugin:', error);
        throw error;
      }
    });

    ipcMain.handle('uninstallPlugin', async (_, pluginId: string) => {
      try {
        return await this.pluginManager.uninstallPlugin(pluginId);
      } catch (error) {
        logger.error('Failed to uninstall plugin:', error);
        throw error;
      }
    });

    // Autoflash
    ipcMain.handle('flashModem', async (_, config: {
      firmwareVersion?: string;
      carrier?: string;
      type?: string;
      apn?: string;
      forceGeneric?: boolean;
    }) => {
      try {
        await this.autoflashService.flashModem(config);
      } catch (error) {
        logger.error('Failed to flash modem:', error);
        throw error;
      }
    });
  }
} 