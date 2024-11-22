import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { ATCommandProcessor } from '../services/ATCommandProcessor';
import { ErrorHandler } from '../utils/ErrorHandler';

export interface ModemCapabilities {
  ussd: boolean;
  customCommands: boolean;
  networkSelection: boolean;
  signalMonitoring: boolean;
  autoFlash: boolean;
}

export interface ModemConfig {
  devicePath: string;
  baudRate?: number;
  autoReconnect?: boolean;
  commandTimeout?: number;
  retryAttempts?: number;
  signalCheckInterval?: number;
}

export abstract class BaseModem extends EventEmitter {
  protected logger: Logger;
  protected atProcessor: ATCommandProcessor;
  protected device: USBDevice;
  protected config: ModemConfig;
  protected capabilities: ModemCapabilities;
  protected connected: boolean = false;
  protected signalMonitorInterval?: NodeJS.Timeout;

  constructor(device: USBDevice, config: ModemConfig) {
    super();
    this.device = device;
    this.config = {
      baudRate: 115200,
      autoReconnect: true,
      commandTimeout: 10000,
      retryAttempts: 3,
      signalCheckInterval: 30000,
      ...config
    };
    
    this.logger = new Logger(`Modem-${this.getDeviceId()}`);
    this.atProcessor = new ATCommandProcessor();
    this.capabilities = this.getDefaultCapabilities();
  }

  protected getDefaultCapabilities(): ModemCapabilities {
    return {
      ussd: false,
      customCommands: false,
      networkSelection: false,
      signalMonitoring: true,
      autoFlash: false
    };
  }

  async initialize(): Promise<void> {
    try {
      await this.connect();
      await this.configureModem();
      this.startSignalMonitoring();
      this.emit('ready');
    } catch (error) {
      this.handleError('Initialization failed', error as Error);
      throw error;
    }
  }

  protected abstract configureModem(): Promise<void>;
  
  protected abstract handleSMS(message: string): Promise<void>;
  
  protected abstract parseMessageFormat(response: string): Array<{
    sender: string;
    message: string;
    timestamp: Date;
  }>;

  async sendSMS(recipient: string, message: string): Promise<void> {
    try {
      // Set text mode
      await this.atProcessor.sendCommand(this.device, 'AT+CMGF=1');
      
      // Send message
      await this.atProcessor.sendCommand(this.device, `AT+CMGS="${recipient}"`);
      await this.atProcessor.sendCommand(this.device, `${message}\x1A`);
      
      this.emit('messageSent', { recipient, message });
    } catch (error) {
      this.handleError('Failed to send SMS', error as Error);
      throw error;
    }
  }

  async getSignalStrength(): Promise<number> {
    try {
      return await this.atProcessor.getSignalStrength(this.device);
    } catch (error) {
      this.handleError('Failed to get signal strength', error as Error);
      throw error;
    }
  }

  protected startSignalMonitoring(): void {
    if (this.capabilities.signalMonitoring && this.config.signalCheckInterval) {
      this.signalMonitorInterval = setInterval(async () => {
        try {
          const signal = await this.getSignalStrength();
          this.emit('signalStrength', signal);
        } catch (error) {
          this.logger.error('Signal monitoring error:', error);
        }
      }, this.config.signalCheckInterval);
    }
  }

  protected handleError(message: string, error: Error): void {
    this.logger.error(message, error);
    this.emit('error', { message, error });
  }

  protected getDeviceId(): string {
    return `${this.device.deviceDescriptor.idVendor.toString(16)}:${this.device.deviceDescriptor.idProduct.toString(16)}`;
  }

  async cleanup(): Promise<void> {
    if (this.signalMonitorInterval) {
      clearInterval(this.signalMonitorInterval);
    }
    
    try {
      await this.disconnect();
    } catch (error) {
      this.logger.error('Cleanup error:', error);
    }
  }
} 