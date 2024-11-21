import { EventEmitter } from 'events';
import { SerialPort } from 'serialport';
import { logger } from '../../utils/logger';

export interface ModemCapabilities {
  supportsUSSD: boolean;
  supportsCustomAT: boolean;
  maxBaudRate: number;
  supportedBands: string[];
}

export interface ModemInfo {
  manufacturer: string;
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  imei: string;
  iccid: string;
  operator?: string;
}

export interface ATResponse {
  success: boolean;
  data: string;
  error?: string;
}

export abstract class ModemPlugin extends EventEmitter {
  protected port: SerialPort | null = null;
  protected info: ModemInfo | null = null;
  protected isConnected: boolean = false;
  protected errorCount: number = 0;
  protected lastError: Error | null = null;
  protected startTime: number = Date.now();

  constructor(protected devicePath: string) {
    super();
  }

  abstract get capabilities(): ModemCapabilities;

  abstract initialize(): Promise<boolean>;
  abstract sendSMS(number: string, message: string): Promise<boolean>;
  abstract sendAT(command: string): Promise<ATResponse>;

  async connect(): Promise<boolean> {
    try {
      const success = await this.initialize();
      if (success) {
        this.isConnected = true;
        this.emit('connected', this.info);
      }
      return success;
    } catch (error) {
      this.handleError(error as Error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.port && this.port.isOpen) {
        await new Promise<void>((resolve) => this.port!.close(() => resolve()));
      }
      this.port = null;
      this.isConnected = false;
      this.emit('disconnected');
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  async reset(): Promise<boolean> {
    try {
      await this.disconnect();
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.connect();
    } catch (error) {
      this.handleError(error as Error);
      return false;
    }
  }

  getSignalStrength(): number {
    return 0; // Override in specific plugins
  }

  getNetworkInfo(): any {
    return {}; // Override in specific plugins
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }

  getErrorCount(): number {
    return this.errorCount;
  }

  getLastError(): Error | null {
    return this.lastError;
  }

  protected handleError(error: Error): void {
    this.errorCount++;
    this.lastError = error;
    logger.error(`Modem error (${this.info?.model || 'Unknown'})`, error);
    this.emit('error', error);
  }

  protected handleData(data: Buffer): void {
    // Override in specific plugins to handle incoming data
  }

  // Optional methods that can be implemented by specific plugins
  async setNetworkMode?(mode: '4g' | '5g' | 'auto'): Promise<boolean> {
    return false;
  }

  async setBands?(bands: string[]): Promise<boolean> {
    return false;
  }

  async setCarrierAggregation?(enabled: boolean): Promise<boolean> {
    return false;
  }

  async setAPN?(apn: string): Promise<boolean> {
    return false;
  }

  async scanNetworks?(): Promise<any[]> {
    return [];
  }

  async selectNetwork?(operator: string): Promise<boolean> {
    return false;
  }
} 