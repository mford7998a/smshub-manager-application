import { EventEmitter } from 'events';
import { Logger } from '../../utils/logger';
import { Device as USBDevice } from 'usb';

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
  operator?: string;
  technology?: string;
  error?: string;
}

export interface NetworkInfo {
  operator: string;
  technology: string;
  band?: string;
  signal?: number;
}

export abstract class BaseModemPlugin extends EventEmitter {
  protected logger: Logger;
  protected device: USBDevice | null = null;
  protected config: Record<string, any> = {};
  protected initialized: boolean = false;

  constructor() {
    super();
    this.logger = new Logger(this.constructor.name);
  }

  // Required methods that must be implemented by plugins
  abstract initialize(device: USBDevice): Promise<void>;
  abstract sendSMS(number: string, message: string): Promise<boolean>;
  abstract readSMS(): Promise<any[]>;
  abstract getSignalStrength(): Promise<number>;
  abstract getNetworkInfo(): Promise<NetworkInfo>;
  abstract reset(): Promise<void>;
  abstract getStatus(): Promise<ModemStatus>;

  // Optional methods that plugins can override
  async enable(): Promise<void> {
    if (!this.initialized && this.device) {
      await this.initialize(this.device);
    }
  }

  async disable(): Promise<void> {
    this.initialized = false;
  }

  async configure(settings: Record<string, any>): Promise<void> {
    this.config = {
      ...this.config,
      ...settings
    };
  }

  getCapabilities(): ModemCapabilities {
    return {
      ussd: false,
      customCommands: false,
      networkSelection: false,
      signalMonitoring: true,
      autoFlash: false
    };
  }

  // Utility methods available to all plugins
  protected validatePhoneNumber(number: string): boolean {
    return /^\+?[\d-]+$/.test(number);
  }

  protected validateMessage(message: string): boolean {
    return message.length > 0 && message.length <= 160;
  }

  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Operation failed (attempt ${attempt}/${maxRetries}):`,
          error
        );
        if (attempt < maxRetries) {
          await this.delay(delayMs);
        }
      }
    }

    throw lastError;
  }

  protected parseSMSResponse(response: string): any[] {
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

  protected parseATResponse(response: string, pattern: string): string[] {
    const matches = response.match(new RegExp(pattern, 'gm'));
    return matches ? matches.map(m => m.trim()) : [];
  }

  protected formatATCommand(command: string): string {
    return command.trim() + '\r';
  }

  protected isInitialized(): void {
    if (!this.device || !this.initialized) {
      throw new Error('Modem not initialized');
    }
  }

  protected async waitForResponse(
    predicate: (data: string) => boolean,
    timeoutMs: number = 10000
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let response = '';
      const timeout = setTimeout(() => {
        reject(new Error('Response timeout'));
      }, timeoutMs);

      const handler = (data: string) => {
        response += data;
        if (predicate(response)) {
          clearTimeout(timeout);
          this.removeListener('data', handler);
          resolve(response);
        }
      };

      this.on('data', handler);
    });
  }

  // Event handling helpers
  protected emitError(error: Error): void {
    this.emit('error', error);
    this.logger.error('Modem error:', error);
  }

  protected emitStatus(status: ModemStatus): void {
    this.emit('status', status);
  }

  protected emitMessage(message: any): void {
    this.emit('message', message);
  }
} 