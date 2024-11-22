import { ATCommandProcessor } from '../../../src/services/ATCommandProcessor';
import { TestUtils } from '../../utils/TestUtils';

describe('ATCommandProcessor', () => {
  let processor: ATCommandProcessor;
  let mockDevice: any;

  beforeEach(() => {
    processor = new ATCommandProcessor();
    mockDevice = TestUtils.createMockUSBDevice();
    TestUtils.mockLogger();
  });

  describe('Basic Commands', () => {
    it('should send AT command and receive response', async () => {
      TestUtils.mockATResponse(mockDevice, 'OK\r\n');
      
      const response = await processor.sendCommand(mockDevice, 'AT');
      expect(response).toBe('OK');
      expect(mockDevice.transferOut).toHaveBeenCalled();
    });

    it('should handle error responses', async () => {
      TestUtils.mockATResponse(mockDevice, 'ERROR\r\n');
      
      await expect(processor.sendCommand(mockDevice, 'AT+INVALID'))
        .rejects.toThrow('AT command error');
    });

    it('should handle timeouts', async () => {
      mockDevice.transferIn.mockImplementation(() => TestUtils.delay(2000));
      
      await expect(processor.sendCommand(mockDevice, 'AT', { timeout: 1000 }))
        .rejects.toThrow('AT command timeout');
    });
  });

  describe('Modem Info', () => {
    it('should get modem information', async () => {
      TestUtils.mockATResponse(mockDevice, 'Sierra Wireless\r\nOK\r\n');
      TestUtils.mockATResponse(mockDevice, 'EM7455\r\nOK\r\n');
      TestUtils.mockATResponse(mockDevice, 'SWI9X30C_02.24.05.06\r\nOK\r\n');
      TestUtils.mockATResponse(mockDevice, '123456789012345\r\nOK\r\n');

      const info = await processor.getModemInfo(mockDevice);
      expect(info).toEqual({
        manufacturer: 'Sierra Wireless',
        model: 'EM7455',
        revision: 'SWI9X30C_02.24.05.06',
        imei: '123456789012345'
      });
    });
  });

  describe('Network Info', () => {
    it('should get signal strength', async () => {
      TestUtils.mockATResponse(mockDevice, '+CSQ: 25\r\nOK\r\n');
      
      const signal = await processor.getSignalStrength(mockDevice);
      expect(signal).toBe(25);
    });

    it('should get network information', async () => {
      TestUtils.mockATResponse(mockDevice, '+COPS: 0,0,"Vodafone"\r\nOK\r\n');
      TestUtils.mockATResponse(mockDevice, '+CREG: 2,1,"1234","5678",7\r\nOK\r\n');

      const info = await processor.getNetworkInfo(mockDevice);
      expect(info).toEqual({
        operator: 'Vodafone',
        technology: 'LTE'
      });
    });
  });

  describe('Command Queue', () => {
    it('should process commands in order', async () => {
      const responses = [
        'First Response\r\nOK\r\n',
        'Second Response\r\nOK\r\n',
        'Third Response\r\nOK\r\n'
      ];

      let responseIndex = 0;
      mockDevice.transferIn.mockImplementation(() => ({
        data: {
          buffer: Buffer.from(responses[responseIndex++])
        }
      }));

      const results = await Promise.all([
        processor.sendCommand(mockDevice, 'AT1'),
        processor.sendCommand(mockDevice, 'AT2'),
        processor.sendCommand(mockDevice, 'AT3')
      ]);

      expect(results).toEqual([
        'First Response',
        'Second Response',
        'Third Response'
      ]);
    });
  });
}); 