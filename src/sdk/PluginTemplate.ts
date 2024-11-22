import { BaseModemPlugin } from '../core/plugin-manager/ModemPlugin';
import { PluginSDK } from '../core/plugin-manager/PluginSDK';
import { Device as USBDevice } from 'usb';

class CustomModemPlugin extends BaseModemPlugin {
  private initialized: boolean = false;
  protected atProcessor: any;

  async initialize(device: USBDevice): Promise<void> {
    this.device = device;
    
    try {
      // Initialize modem with required AT commands
      await this.atProcessor.sendCommand(device, 'ATZ');
      await this.atProcessor.sendCommand(device, 'ATE0');
      await this.atProcessor.sendCommand(device, 'AT+CMGF=1');
      
      // Add custom initialization commands here
      
      this.initialized = true;
      this.logger.info('Modem initialized successfully');
    } catch (error: any) {
      this.logger.error('Failed to initialize modem:', error);
      throw error;
    }
  }

  async sendSMS(number: string, message: string): Promise<boolean> {
    if (!this.initialized) throw new Error('Modem not initialized');

    try {
      await this.atProcessor.sendCommand(this.device, `AT+CMGS="${number}"`);
      await this.atProcessor.sendCommand(this.device, `${message}\x1A`);
      return true;
    } catch (error: any) {
      this.logger.error('Failed to send SMS:', error);
      return false;
    }
  }

  async readSMS(): Promise<any[]> {
    if (!this.initialized) throw new Error('Modem not initialized');

    try {
      const response = await this.atProcessor.sendCommand(this.device, 'AT+CMGL="ALL"');
      return this.parseSMSResponse(response);
    } catch (error: any) {
      this.logger.error('Failed to read SMS:', error);
      return [];
    }
  }

  async getSignalStrength(): Promise<number> {
    if (!this.initialized) throw new Error('Modem not initialized');
    return this.atProcessor.getSignalStrength(this.device);
  }

  async getNetworkInfo(): Promise<{
    operator: string;
    technology: string;
    band?: string;
    signal?: number;
  }> {
    if (!this.initialized) throw new Error('Modem not initialized');
    return this.atProcessor.getNetworkInfo(this.device);
  }

  async reset(): Promise<void> {
    try {
      await this.atProcessor.sendCommand(this.device, 'AT+CFUN=1,1');
      this.initialized = false;
      await new Promise(resolve => setTimeout(resolve, 5000));
      await this.initialize(this.device);
    } catch (error: any) {
      this.logger.error('Failed to reset modem:', error);
      throw error;
    }
  }

  async getStatus(): Promise<{
    connected: boolean;
    signalStrength: number;
    operator?: string;
    technology?: string;
    error?: string;
  }> {
    try {
      const signal = await this.getSignalStrength();
      const network = await this.getNetworkInfo();

      return {
        connected: this.initialized,
        signalStrength: signal,
        operator: network.operator,
        technology: network.technology
      };
    } catch (error: any) {
      return {
        connected: false,
        signalStrength: 0,
        error: error.message
      };
    }
  }

  private parseSMSResponse(response: string): any[] {
    const messages = [];
    const lines = response.split('\r\n');
    let currentMessage: any = null;

    for (const line of lines) {
      if (line.startsWith('+CMGL:')) {
        if (currentMessage) {
          messages.push(currentMessage);
        }
        const [index, status, sender, , timestamp] = line
          .substring(7)
          .split(',')
          .map(s => s.trim().replace(/"/g, ''));

        currentMessage = {
          index: parseInt(index),
          status,
          sender,
          timestamp: new Date(timestamp),
          message: ''
        };
      } else if (currentMessage && line.trim()) {
        currentMessage.message = line.trim();
      }
    }

    if (currentMessage) {
      messages.push(currentMessage);
    }

    return messages;
  }
}

export default PluginSDK.createPlugin(CustomModemPlugin); 