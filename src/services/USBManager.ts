import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/ErrorHandler';
import { ConfigService } from './ConfigService';
import * as usb from 'usb';
import type { Device, Interface } from 'usb';

interface USBDeviceFilter {
  vendorId: number;
  productId?: number;
}

export class USBManager extends EventEmitter {
  private logger: Logger;
  private devices: Map<string, Device> = new Map();
  private deviceFilters: USBDeviceFilter[] = [];
  private config: ConfigService;
  private pollingInterval?: NodeJS.Timeout;

  constructor(config: ConfigService) {
    super();
    this.logger = new Logger('USBManager');
    this.config = config;
    this.setupDeviceFilters();
  }

  private setupDeviceFilters(): void {
    // Common USB modem vendor IDs
    this.deviceFilters = [
      { vendorId: 0x1199 }, // Sierra Wireless
      { vendorId: 0x2c7c }, // Quectel
      { vendorId: 0x2cb7 }, // Fibocom
      { vendorId: 0x1508 }, // Franklin Wireless
      { vendorId: 0x19d2 }, // ZTE
      { vendorId: 0x12d1 }, // Huawei
      { vendorId: 0x0bdb }, // Ericsson
      { vendorId: 0x1e0e }  // Qualcomm
    ];
  }

  async initialize(): Promise<void> {
    try {
      // Setup USB device detection
      this.setupDeviceDetection();
      
      // Initial device scan
      await this.scanDevices();
      
      this.logger.info('USB Manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize USB Manager:', error);
      throw error;
    }
  }

  private setupDeviceDetection(): void {
    // Handle device attachment
    usb.on('attach', (device: Device) => {
      this.handleDeviceAttached(device);
    });

    // Handle device detachment
    usb.on('detach', (device: Device) => {
      this.handleDeviceDetached(device);
    });

    // Start polling for devices (fallback for systems where events don't work)
    this.startDevicePolling();
  }

  private startDevicePolling(): void {
    const pollInterval = this.config.get('usb.pollInterval') || 5000;
    
    this.pollingInterval = setInterval(() => {
      this.scanDevices().catch(error => {
        this.logger.error('Device polling error:', error);
      });
    }, pollInterval);
  }

  private async scanDevices(): Promise<void> {
    const devices = usb.getDeviceList();
    
    // Track new and removed devices
    const currentDevices = new Set(this.devices.keys());
    const foundDevices = new Set<string>();

    for (const device of devices) {
      if (this.isModemDevice(device)) {
        const deviceId = this.getDeviceId(device);
        foundDevices.add(deviceId);

        if (!currentDevices.has(deviceId)) {
          await this.handleDeviceAttached(device);
        }
      }
    }

    // Handle removed devices
    for (const deviceId of currentDevices) {
      if (!foundDevices.has(deviceId)) {
        const device = this.devices.get(deviceId);
        if (device) {
          this.handleDeviceDetached(device);
        }
      }
    }
  }

  private isModemDevice(device: Device): boolean {
    return this.deviceFilters.some(filter => {
      if (device.deviceDescriptor.idVendor !== filter.vendorId) {
        return false;
      }
      if (filter.productId && device.deviceDescriptor.idProduct !== filter.productId) {
        return false;
      }
      return true;
    });
  }

  private async handleDeviceAttached(device: Device): Promise<void> {
    const deviceId = this.getDeviceId(device);

    try {
      // Open device
      device.open();

      // Find and claim modem interface
      const interface = this.findModemInterface(device);
      if (!interface) {
        throw new Error('No modem interface found');
      }

      if (interface.isKernelDriverActive()) {
        await interface.detachKernelDriver();
      }
      await interface.claim();

      // Store device
      this.devices.set(deviceId, device);

      // Emit event
      this.emit('device:connected', {
        id: deviceId,
        vendorId: device.deviceDescriptor.idVendor,
        productId: device.deviceDescriptor.idProduct,
        interface: interface.interfaceNumber
      });

      this.logger.info(`USB device connected: ${deviceId}`);
    } catch (error) {
      this.logger.error(`Failed to handle device attachment: ${deviceId}`, error);
      this.emit('device:error', { id: deviceId, error });
    }
  }

  private handleDeviceDetached(device: Device): void {
    const deviceId = this.getDeviceId(device);

    try {
      // Close device
      device.close();
      
      // Remove from tracking
      this.devices.delete(deviceId);

      // Emit event
      this.emit('device:disconnected', deviceId);

      this.logger.info(`USB device disconnected: ${deviceId}`);
    } catch (error) {
      this.logger.error(`Error handling device detachment: ${deviceId}`, error);
    }
  }

  private findModemInterface(device: Device): Interface | null {
    // Try to find CDC ACM interface
    for (const interface of device.interfaces) {
      if (interface.descriptor.bInterfaceClass === 0x0A) { // CDC Data
        return interface;
      }
    }

    // Fallback to first available interface
    return device.interfaces[0] || null;
  }

  public async findDevice(devicePath: string): Promise<Device | null> {
    const devices = usb.getDeviceList();
    return devices.find(device => this.getDeviceId(device) === devicePath) || null;
  }

  private getDeviceId(device: Device): string {
    return `${device.deviceDescriptor.idVendor.toString(16)}:${device.deviceDescriptor.idProduct.toString(16)}`;
  }

  shutdown(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Close all devices
    for (const [deviceId, device] of this.devices) {
      try {
        device.close();
      } catch (error) {
        this.logger.error(`Error closing device ${deviceId}:`, error);
      }
    }

    this.devices.clear();
  }

  // Public API methods
  getConnectedDevices(): any[] {
    return Array.from(this.devices.entries()).map(([id, device]) => ({
      id,
      vendorId: device.deviceDescriptor.idVendor,
      productId: device.deviceDescriptor.idProduct,
      manufacturer: device.deviceDescriptor.iManufacturer,
      product: device.deviceDescriptor.iProduct,
      serialNumber: device.deviceDescriptor.iSerialNumber
    }));
  }

  isDeviceConnected(deviceId: string): boolean {
    return this.devices.has(deviceId);
  }

  getDevice(deviceId: string): Device | undefined {
    return this.devices.get(deviceId);
  }
} 