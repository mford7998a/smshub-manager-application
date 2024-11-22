import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { Device as USBDevice } from 'usb';
import CustomModemPlugin from './index';

describe('CustomModemPlugin', () => {
  let plugin: any;
  let mockDevice: Partial<USBDevice>;
  let mockATProcessor: any;

  beforeEach(() => {
    mockDevice = {
      deviceDescriptor: {
        idVendor: 0x1234,
        idProduct: 0x5678
      },
      serialNumber: 'TEST123'
    };

    mockATProcessor = {
      sendCommand: sinon.stub(),
      getSignalStrength: sinon.stub(),
      getNetworkInfo: sinon.stub()
    };

    plugin = new CustomModemPlugin();
    plugin.atProcessor = mockATProcessor;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('initialize()', () => {
    it('should initialize the modem correctly', async () => {
      mockATProcessor.sendCommand.resolves('OK');

      await plugin.initialize(mockDevice as USBDevice);

      expect(mockATProcessor.sendCommand.callCount).to.equal(3);
      expect(plugin.initialized).to.be.true;
    });

    it('should handle initialization errors', async () => {
      mockATProcessor.sendCommand.rejects(new Error('Init failed'));

      try {
        await plugin.initialize(mockDevice as USBDevice);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).to.include('Init failed');
        expect(plugin.initialized).to.be.false;
      }
    });
  });

  describe('sendSMS()', () => {
    beforeEach(async () => {
      mockATProcessor.sendCommand.resolves('OK');
      await plugin.initialize(mockDevice as USBDevice);
    });

    it('should send SMS successfully', async () => {
      const result = await plugin.sendSMS('+1234567890', 'Test message');
      expect(result).to.be.true;
      expect(mockATProcessor.sendCommand.callCount).to.equal(5);
    });

    it('should handle send errors', async () => {
      mockATProcessor.sendCommand.rejects(new Error('Send failed'));
      const result = await plugin.sendSMS('+1234567890', 'Test message');
      expect(result).to.be.false;
    });
  });

  describe('readSMS()', () => {
    beforeEach(async () => {
      mockATProcessor.sendCommand.resolves('OK');
      await plugin.initialize(mockDevice as USBDevice);
    });

    it('should read SMS messages correctly', async () => {
      const mockResponse = 
        '+CMGL: 1,"REC UNREAD","+1234567890",,"2024-03-20 10:00:00"\r\n' +
        'Test message 1\r\n' +
        '+CMGL: 2,"REC READ","+0987654321",,"2024-03-20 11:00:00"\r\n' +
        'Test message 2\r\n' +
        'OK\r\n';

      mockATProcessor.sendCommand.resolves(mockResponse);

      const messages = await plugin.readSMS();
      expect(messages).to.have.length(2);
      expect(messages[0].sender).to.equal('+1234567890');
      expect(messages[1].message).to.equal('Test message 2');
    });
  });

  describe('getStatus()', () => {
    beforeEach(async () => {
      mockATProcessor.sendCommand.resolves('OK');
      mockATProcessor.getSignalStrength.resolves(25);
      mockATProcessor.getNetworkInfo.resolves({
        operator: 'Test Operator',
        technology: '4G'
      });
      await plugin.initialize(mockDevice as USBDevice);
    });

    it('should return correct status when connected', async () => {
      const status = await plugin.getStatus();
      expect(status).to.deep.equal({
        connected: true,
        signalStrength: 25,
        operator: 'Test Operator',
        technology: '4G'
      });
    });

    it('should handle status errors', async () => {
      mockATProcessor.getSignalStrength.rejects(new Error('Status error'));
      const status = await plugin.getStatus();
      expect(status.connected).to.be.false;
      expect(status.error).to.equal('Status error');
    });
  });
}); 