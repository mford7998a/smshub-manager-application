import { EventEmitter } from 'events';
import { usb, Device, Interface } from 'usb';
import { logger } from '../../utils/logger';

interface USBDevice {
  path: string;
  vendorId: number;
  productId: number;
  manufacturer?: string;
  product?: string;
  serialNumber?: string;
}

export class USBDetector extends EventEmitter {
  private knownDevices: Map<string, USBDevice> = new Map();
  private modemVendors: Set<number> = new Set([
    0x1199, // Sierra Wireless
    0x2c7c, // Quectel
    0x2cb7, // Fibocom
    0x1508, // Franklin
    0x19d2, // ZTE
    0x12d1, // Huawei
    0x0bdb, // Ericsson
    0x1e0e  // Qualcomm
  ]);

  constructor() {
    super();
    this.initialize();
  }

  private initialize(): void {
    try {
      // Get initially connected devices
      const devices = usb.getDeviceList();
      devices.forEach(device => {
        this.handleDeviceAdd(device);
      });

      // Listen for device events
      usb.on('attach', this.handleDeviceAdd.bind(this));
      usb.on('detach', this.handleDeviceRemove.bind(this));

      logger.info('USB detector initialized');
    } catch (error) {
      logger.error('Failed to initialize USB detector:', error);
      throw error;
    }
  }

  private async handleDeviceAdd(device: Device): Promise<void> {
    try {
      if (!this.isModem(device)) {
        return;
      }

      const deviceInfo = await this.getDeviceInfo(device);
      const devicePath = this.getDevicePath(device);

      if (!this.knownDevices.has(devicePath)) {
        this.knownDevices.set(devicePath, deviceInfo);
        this.emit('device:added', deviceInfo);
        logger.info('USB device added:', deviceInfo);
      }
    } catch (error) {
      logger.error('Failed to handle device addition:', error);
    }
  }

  private handleDeviceRemove(device: Device): void {
    try {
      const devicePath = this.getDevicePath(device);
      const deviceInfo = this.knownDevices.get(devicePath);

      if (deviceInfo) {
        this.knownDevices.delete(devicePath);
        this.emit('device:removed', deviceInfo);
        logger.info('USB device removed:', deviceInfo);
      }
    } catch (error) {
      logger.error('Failed to handle device removal:', error);
    }
  }

  private isModem(device: Device): boolean {
    return this.modemVendors.has(device.deviceDescriptor.idVendor);
  }

  private async getDeviceInfo(device: Device): Promise<USBDevice> {
    try {
      device.open();

      const deviceInfo: USBDevice = {
        path: this.getDevicePath(device),
        vendorId: device.deviceDescriptor.idVendor,
        productId: device.deviceDescriptor.idProduct
      };

      try {
        deviceInfo.manufacturer = await this.getStringDescriptor(
          device,
          device.deviceDescriptor.iManufacturer
        );
        deviceInfo.product = await this.getStringDescriptor(
          device,
          device.deviceDescriptor.iProduct
        );
        deviceInfo.serialNumber = await this.getStringDescriptor(
          device,
          device.deviceDescriptor.iSerialNumber
        );
      } catch (error) {
        logger.warn('Failed to get device descriptors:', error);
      }

      device.close();
      return deviceInfo;
    } catch (error) {
      logger.error('Failed to get device info:', error);
      if (device.isOpen) {
        device.close();
      }
      throw error;
    }
  }

  private getDevicePath(device: Device): string {
    return `${device.busNumber}.${device.deviceAddress}`;
  }

  private getStringDescriptor(device: Device, index: number): Promise<string> {
    return new Promise((resolve, reject) => {
      device.getStringDescriptor(index, (error, data) => {
        if (error) reject(error);
        else resolve(data || '');
      });
    });
  }

  getKnownDevices(): Map<string, USBDevice> {
    return this.knownDevices;
  }

  addModemVendor(vendorId: number): void {
    this.modemVendors.add(vendorId);
  }

  removeModemVendor(vendorId: number): void {
    this.modemVendors.delete(vendorId);
  }

  stop(): void {
    usb.removeAllListeners();
    this.removeAllListeners();
    this.knownDevices.clear();
    logger.info('USB detector stopped');
  }
} 