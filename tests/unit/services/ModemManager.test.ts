import { ModemManager } from '../../../src/services/ModemManager';
import { PluginManager } from '../../../src/services/PluginManager';
import { USBManager } from '../../../src/services/USBManager';
import { ConfigService } from '../../../src/services/ConfigService';
import { Store } from '../../../src/database/Store';
import { TestUtils } from '../../utils/TestUtils';

describe('ModemManager', () => {
  let modemManager: ModemManager;
  let store: Store;
  let pluginManager: PluginManager;
  let usbManager: USBManager;
  let config: ConfigService;

  beforeEach(async () => {
    store = await TestUtils.createTestStore();
    config = await TestUtils.createTestConfig();
    
    pluginManager = new PluginManager(store, config);
    usbManager = new USBManager(config);
    modemManager = new ModemManager(store, pluginManager, usbManager, config);

    TestUtils.mockLogger();
  });

  describe('Device Management', () => {
    it('should handle device attachment', async () => {
      const mockDevice = TestUtils.createMockUSBDevice();
      const deviceAttached = jest.fn();
      modemManager.on('modem:connected', deviceAttached);

      await usbManager.emit('device:attached', mockDevice);

      expect(deviceAttached).toHaveBeenCalled();
    });

    it('should handle device detachment', async () => {
      const mockDevice = TestUtils.createMockUSBDevice();
      const deviceDetached = jest.fn();
      modemManager.on('modem:disconnected', deviceDetached);

      await usbManager.emit('device:detached', mockDevice);

      expect(deviceDetached).toHaveBeenCalled();
    });

    it('should track active modems', async () => {
      const mockDevice1 = TestUtils.createMockUSBDevice({ serialNumber: 'MODEM1' });
      const mockDevice2 = TestUtils.createMockUSBDevice({ serialNumber: 'MODEM2' });

      await usbManager.emit('device:attached', mockDevice1);
      await usbManager.emit('device:attached', mockDevice2);

      const activeModems = modemManager.getActiveModems();
      expect(activeModems.length).toBe(2);
    });
  });

  describe('Message Handling', () => {
    it('should send SMS through modem', async () => {
      const mockDevice = TestUtils.createMockUSBDevice();
      await usbManager.emit('device:attached', mockDevice);

      const result = await modemManager.sendSMS(
        mockDevice.serialNumber!,
        '+1234567890',
        'Test message'
      );

      expect(result).toBe(true);
    });

    it('should handle send failures', async () => {
      const mockDevice = TestUtils.createMockUSBDevice();
      TestUtils.mockATResponse(mockDevice, 'ERROR');

      await usbManager.emit('device:attached', mockDevice);

      const result = await modemManager.sendSMS(
        mockDevice.serialNumber!,
        '+1234567890',
        'Test message'
      );

      expect(result).toBe(false);
    });

    it('should queue messages when modem is busy', async () => {
      const mockDevice = TestUtils.createMockUSBDevice();
      await usbManager.emit('device:attached', mockDevice);

      // Send multiple messages simultaneously
      const promises = [
        modemManager.sendSMS(mockDevice.serialNumber!, '+1234567890', 'Message 1'),
        modemManager.sendSMS(mockDevice.serialNumber!, '+1234567890', 'Message 2'),
        modemManager.sendSMS(mockDevice.serialNumber!, '+1234567890', 'Message 3')
      ];

      const results = await Promise.all(promises);
      expect(results.every(r => r === true)).toBe(true);
    });
  });

  describe('Health Monitoring', () => {
    it('should monitor modem signal strength', async () => {
      const mockDevice = TestUtils.createMockUSBDevice();
      TestUtils.mockATResponse(mockDevice, '+CSQ: 25\r\nOK\r\n');

      await usbManager.emit('device:attached', mockDevice);
      const status = await modemManager.getModemStatus(mockDevice.serialNumber!);

      expect(status.signalStrength).toBe(25);
    });

    it('should detect modem errors', async () => {
      const mockDevice = TestUtils.createMockUSBDevice();
      const errorDetected = jest.fn();
      modemManager.on('modem:error', errorDetected);

      TestUtils.mockATResponse(mockDevice, 'ERROR');
      await usbManager.emit('device:attached', mockDevice);

      expect(errorDetected).toHaveBeenCalled();
    });

    it('should track message statistics', async () => {
      const mockDevice = TestUtils.createMockUSBDevice();
      await usbManager.emit('device:attached', mockDevice);

      // Send some test messages
      await modemManager.sendSMS(mockDevice.serialNumber!, '+1234567890', 'Message 1');
      await modemManager.sendSMS(mockDevice.serialNumber!, '+1234567890', 'Message 2');

      const stats = await modemManager.getModemStats(mockDevice.serialNumber!);
      expect(stats.messageCount).toBe(2);
    });
  });

  describe('Error Recovery', () => {
    it('should retry failed operations', async () => {
      const mockDevice = TestUtils.createMockUSBDevice();
      let attempts = 0;
      
      TestUtils.mockATResponse(mockDevice, () => {
        attempts++;
        return attempts < 3 ? 'ERROR' : 'OK';
      });

      await usbManager.emit('device:attached', mockDevice);
      const result = await modemManager.sendSMS(
        mockDevice.serialNumber!,
        '+1234567890',
        'Test message'
      );

      expect(attempts).toBe(3);
      expect(result).toBe(true);
    });

    it('should reset modem on persistent errors', async () => {
      const mockDevice = TestUtils.createMockUSBDevice();
      const resetCalled = jest.fn();
      modemManager.on('modem:reset', resetCalled);

      // Simulate persistent errors
      for (let i = 0; i < 5; i++) {
        await usbManager.emit('device:error', {
          deviceId: mockDevice.serialNumber,
          error: new Error('Test error')
        });
      }

      expect(resetCalled).toHaveBeenCalled();
    });
  });
}); 