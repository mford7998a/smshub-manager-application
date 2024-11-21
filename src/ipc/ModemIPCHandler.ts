import { ipcMain } from 'electron';
import { PluginManager } from '../core/plugin-manager/PluginManager';
import { Store } from '../database/Store';
import { logger } from '../utils/logger';

export class ModemIPCHandler {
  constructor(
    private pluginManager: PluginManager,
    private store: Store
  ) {
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Modem Configuration
    ipcMain.handle('configureModem', async (_, data: {
      modemId: string;
      config: {
        networkMode?: '4g' | '5g' | 'auto';
        bands?: string[];
        carrierAggregation?: boolean;
        apn?: string;
      }
    }) => {
      try {
        const modem = this.getModemById(data.modemId);
        
        if (data.config.networkMode) {
          await modem.setNetworkMode(data.config.networkMode);
        }
        
        if (data.config.bands) {
          await modem.setBands(data.config.bands);
        }
        
        if (data.config.carrierAggregation !== undefined) {
          await modem.setCarrierAggregation(data.config.carrierAggregation);
        }
        
        if (data.config.apn) {
          await modem.setAPN(data.config.apn);
        }

        // Save configuration to store
        await this.store.saveModemConfig(data.modemId, data.config);
        return true;
      } catch (error) {
        logger.error('Failed to configure modem:', error);
        throw error;
      }
    });

    // Modem Control
    ipcMain.handle('resetModem', async (_, modemId: string) => {
      try {
        const modem = this.getModemById(modemId);
        return await modem.reset();
      } catch (error) {
        logger.error('Failed to reset modem:', error);
        throw error;
      }
    });

    // AT Commands
    ipcMain.handle('sendATCommand', async (_, data: {
      modemId: string;
      command: string;
    }) => {
      try {
        const modem = this.getModemById(data.modemId);
        if (!modem.capabilities.supportsCustomAT) {
          throw new Error('Modem does not support custom AT commands');
        }
        return await modem.sendAT(data.command);
      } catch (error) {
        logger.error('Failed to send AT command:', error);
        throw error;
      }
    });

    // Modem Information
    ipcMain.handle('getModemDetails', async (_, modemId: string) => {
      try {
        const modem = this.getModemById(modemId);
        const [signal, network, capabilities] = await Promise.all([
          modem.getSignalStrength(),
          modem.getNetworkInfo(),
          modem.capabilities
        ]);

        return {
          info: modem.info,
          signal,
          network,
          capabilities,
          config: await this.store.getModemConfig(modemId)
        };
      } catch (error) {
        logger.error('Failed to get modem details:', error);
        throw error;
      }
    });

    // Modem Diagnostics
    ipcMain.handle('getModemDiagnostics', async (_, modemId: string) => {
      try {
        const modem = this.getModemById(modemId);
        const [stats, messages] = await Promise.all([
          this.store.getModemStats(modemId, 24), // Last 24 hours
          this.store.getModemMessages(modemId, 100) // Last 100 messages
        ]);

        return {
          stats,
          messages,
          uptime: modem.getUptime(),
          errorCount: modem.getErrorCount(),
          lastError: modem.getLastError(),
          signalHistory: await this.store.getSignalHistory(modemId, 24) // Last 24 hours
        };
      } catch (error) {
        logger.error('Failed to get modem diagnostics:', error);
        throw error;
      }
    });

    // Band Management
    ipcMain.handle('getAvailableBands', async (_, modemId: string) => {
      try {
        const modem = this.getModemById(modemId);
        return modem.capabilities.supportedBands;
      } catch (error) {
        logger.error('Failed to get available bands:', error);
        throw error;
      }
    });

    // Network Selection
    ipcMain.handle('scanNetworks', async (_, modemId: string) => {
      try {
        const modem = this.getModemById(modemId);
        return await modem.scanNetworks();
      } catch (error) {
        logger.error('Failed to scan networks:', error);
        throw error;
      }
    });

    ipcMain.handle('selectNetwork', async (_, data: {
      modemId: string;
      operator: string;
    }) => {
      try {
        const modem = this.getModemById(data.modemId);
        return await modem.selectNetwork(data.operator);
      } catch (error) {
        logger.error('Failed to select network:', error);
        throw error;
      }
    });
  }

  private getModemById(modemId: string) {
    const modem = Array.from(this.pluginManager.getActiveModems().values())
      .find(m => m.info?.imei === modemId);
    
    if (!modem) {
      throw new Error('Modem not found');
    }

    return modem;
  }
} 