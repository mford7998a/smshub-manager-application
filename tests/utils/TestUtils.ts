import { Store } from '../../src/database/Store';
import { ConfigService } from '../../src/services/ConfigService';
import { Logger } from '../../src/utils/logger';
import * as path from 'path';
import * as fs from 'fs-extra';
import { Device as USBDevice } from 'usb';

export class TestUtils {
  static async createTestStore(): Promise<Store> {
    const testDbPath = path.join(__dirname, '../temp/test.db');
    await fs.ensureDir(path.dirname(testDbPath));
    await fs.remove(testDbPath);
    
    const store = new Store(testDbPath);
    await store.initialize();
    return store;
  }

  static async createTestConfig(): Promise<ConfigService> {
    const store = await this.createTestStore();
    const config = new ConfigService(store);
    await config.initialize();
    return config;
  }

  static createMockUSBDevice(options: {
    vendorId?: number;
    productId?: number;
    serialNumber?: string;
  } = {}): Partial<USBDevice> {
    return {
      deviceDescriptor: {
        idVendor: options.vendorId || 0x1234,
        idProduct: options.productId || 0x5678,
        iManufacturer: 1,
        iProduct: 2,
        iSerialNumber: 3
      },
      serialNumber: options.serialNumber || 'TEST123',
      open: jest.fn(),
      close: jest.fn(),
      interfaces: [{
        interfaceNumber: 0,
        descriptor: {
          bInterfaceClass: 0x0A
        },
        claim: jest.fn(),
        release: jest.fn(),
        isKernelDriverActive: jest.fn().mockReturnValue(false),
        detachKernelDriver: jest.fn()
      }],
      transferIn: jest.fn(),
      transferOut: jest.fn()
    };
  }

  static async cleanupTests(): Promise<void> {
    await fs.remove(path.join(__dirname, '../temp'));
  }

  static mockLogger(): void {
    jest.spyOn(Logger.prototype, 'info').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  }

  static mockATResponse(device: Partial<USBDevice>, response: string): void {
    (device.transferIn as jest.Mock).mockResolvedValue({
      data: {
        buffer: Buffer.from(response)
      }
    });
  }

  static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 