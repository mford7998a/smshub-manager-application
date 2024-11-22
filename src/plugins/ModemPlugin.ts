import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { ATCommandProcessor } from '../services/ATCommandProcessor';
import { ConfigService } from '../services/ConfigService';
import { Store } from '../database/Store';

export interface ModemCapabilities {
  ussd: boolean;
  customCommands: boolean;
  networkSelection: boolean;
  signalMonitoring: boolean;
  autoFlash: boolean;
}

export interface ModemStatus {
  connected: boolean;
  signalStrength: number;
  operator: string;
  technology: string;
  imei: string;
  iccid?: string;
  errorCount: number;
  lastError?: string;
  messageCount: number;
  successRate: number;
}

export abstract class ModemPlugin extends EventEmitter {
  protected logger: Logger;
  protected atProcessor: ATCommandProcessor;
  protected config: ConfigService;
  protected store: Store;
  protected status: ModemStatus;
  protected device: USBDevice;
  protected capabilities: ModemCapabilities;
  protected healthCheckInterval?: NodeJS.Timeout;

  constructor(
    device: USBDevice,
    config: ConfigService,
    store: Store,
    atProcessor: ATCommandProcessor
  ) {
    super();
    this.device = device;
    this.config = config;
    this.store = store;
    this.atProcessor = atProcessor;
    this.logger = new Logger(`ModemPlugin:${this.constructor.name}`);
    
    this.status = {
      connected: false,
      signalStrength: 0,
      operator: '',
      technology: '',
      imei: '',
      errorCount: 0,
      messageCount: 0,
      successRate: 100
    };

    this.capabilities = {
      ussd: false,
      customCommands: false,
      networkSelection: false,
      signalMonitoring: true,
      autoFlash: false
    };
  }

  abstract initialize(): Promise<void>;
  abstract sendSMS(recipient: string, message: string): Promise<void>;
  abstract readSMS(): Promise<Array<{
    sender: string;
    message: string;
    timestamp: Date;
  }>>;
  
  protected async startHealthCheck(): Promise<void> {
    const interval = this.config.get('modem.signalCheckInterval') || 30000;
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.checkHealth();
      } catch (error) {
        this.logger.error('Health check failed:', error);
      }
    }, interval);
  }

  protected async checkHealth(): Promise<void> {
    try {
      const signalStrength = await this.atProcessor.getSignalStrength(this.device);
      const networkInfo = await this.atProcessor.getNetworkInfo(this.device);
      
      this.status = {
        ...this.status,
        signalStrength,
        operator: networkInfo.operator,
        technology: networkInfo.technology
      };

      this.emit('status:updated', this.status);
    } catch (error) {
      this.status.errorCount++;
      this.status.lastError = error.message;
      this.emit('error', error);
    }
  }

  async getStatus(): Promise<ModemStatus> {
    return this.status;
  }

  getCapabilities(): ModemCapabilities {
    return this.capabilities;
  }

  async disable(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.status.connected = false;
    this.emit('status:updated', this.status);
  }

  protected updateStats(success: boolean): void {
    this.status.messageCount++;
    if (!success) {
      this.status.errorCount++;
    }
    this.status.successRate = ((this.status.messageCount - this.status.errorCount) / 
      this.status.messageCount) * 100;
    
    this.emit('stats:updated', {
      messageCount: this.status.messageCount,
      errorCount: this.status.errorCount,
      successRate: this.status.successRate
    });
  }
} 