import { BaseModemPlugin } from '../../../src/core/plugin-manager/ModemPlugin';
import { Device as USBDevice } from 'usb';
import { setupTestEnvironment, teardownTestEnvironment } from '../../setup';

class TestModemPlugin extends BaseModemPlugin {
  public initialized = false;

  async initialize(device: USBDevice): Promise<void> {
    this.device = device;
    this.initialized = true;
  }

  async sendSMS(number: string, message: string): Promise<boolean> {
    this.isInitialized();
    return true;
  }

  async readSMS(): Promise<any[]> {
    this.isInitialized();
    return [];
  }

  async getSignalStrength(): Promise<number> {
    this.isInitialized();
    return 99;
  }

  async getNetworkInfo(): Promise<{
    operator: string;
    technology: string;
  }> {
    this.isInitialized();
    return {
      operator: 'Test Operator',
      technology: 'LTE'
    };
  }

  async reset(): Promise<void> {
    this.isInitialized();
    this.initialized = false;
    await this.initialize(this.device!);
  }

  async getStatus(): Promise<{
    connected: boolean;
    signalStrength: number;
    operator?: string;
    technology?: string;
    error?: string;
  }> {
    return {
      connected: this.initialized,
      signalStrength: await this.getSignalStrength(),
      operator: 'Test Operator',
      technology: 'LTE'
    };
  }
}

describe('BaseModemPlugin', () => {
  let plugin: TestModemPlugin;
  let mockDevice: Partial<USBDevice>;

  beforeEach(async () => {
    await setupTestEnvironment();
    
    mockDevice = {
      deviceDescriptor: {
        idVendor: 0x1234,
        idProduct: 0x5678
      },
      serialNumber: 'TEST123'
    };

    plugin = new TestModemPlugin();
  });

  afterEach(async () => {
    await teardownTestEnvironment();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await plugin.initialize(mockDevice as USBDevice);
      expect(plugin.initialized).toBe(true);
    });

    it('should throw error when using methods before initialization', async () => {
      await expect(plugin.sendSMS('123', 'test')).rejects.toThrow('Modem not initialized');
    });
  });

  describe('SMS Operations', () => {
    beforeEach(async () => {
      await plugin.initialize(mockDevice as USBDevice);
    });

    it('should send SMS successfully', async () => {
      const result = await plugin.sendSMS('123456789', 'Test message');
      expect(result).toBe(true);
    });

    it('should read SMS messages', async () => {
      const messages = await plugin.readSMS();
      expect(Array.isArray(messages)).toBe(true);
    });
  });

  describe('Network Operations', () => {
    beforeEach(async () => {
      await plugin.initialize(mockDevice as USBDevice);
    });

    it('should get signal strength', async () => {
      const signal = await plugin.getSignalStrength();
      expect(signal).toBe(99);
    });

    it('should get network info', async () => {
      const info = await plugin.getNetworkInfo();
      expect(info.operator).toBe('Test Operator');
      expect(info.technology).toBe('LTE');
    });
  });

  describe('Status and Reset', () => {
    beforeEach(async () => {
      await plugin.initialize(mockDevice as USBDevice);
    });

    it('should get modem status', async () => {
      const status = await plugin.getStatus();
      expect(status.connected).toBe(true);
      expect(status.signalStrength).toBe(99);
    });

    it('should reset modem', async () => {
      await plugin.reset();
      expect(plugin.initialized).toBe(true);
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await plugin.initialize(mockDevice as USBDevice);
    });

    it('should emit error events', (done) => {
      plugin.on('error', (error) => {
        expect(error).toBeTruthy();
        done();
      });

      plugin.emit('error', new Error('Test error'));
    });

    it('should emit status events', (done) => {
      plugin.on('status', (status) => {
        expect(status.connected).toBe(true);
        done();
      });

      plugin.emit('status', { connected: true });
    });
  });
}); 