import { ModemPlugin } from '../../core/plugin-manager/ModemPlugin';
import { SerialPort } from 'serialport';

class TestModemPlugin extends ModemPlugin {
  get capabilities() {
    return {
      supportsUSSD: true,
      supportsCustomAT: true,
      maxBaudRate: 115200,
      supportedBands: ['B1', 'B2', 'B3']
    };
  }

  async initialize(): Promise<boolean> {
    return true;
  }

  async sendSMS(number: string, message: string): Promise<boolean> {
    return true;
  }

  async sendAT(command: string): Promise<any> {
    return { success: true, data: 'OK' };
  }
}

describe('ModemPlugin', () => {
  let modem: TestModemPlugin;

  beforeEach(() => {
    modem = new TestModemPlugin('/dev/ttyUSB0');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize successfully', async () => {
    const result = await modem.connect();
    expect(result).toBe(true);
  });

  test('should handle errors during initialization', async () => {
    jest.spyOn(modem, 'initialize').mockRejectedValueOnce(new Error('Init failed'));
    const result = await modem.connect();
    expect(result).toBe(false);
  });

  test('should track error count', () => {
    modem['handleError'](new Error('Test error'));
    expect(modem.getErrorCount()).toBe(1);
  });

  test('should calculate uptime', () => {
    const startTime = Date.now() - 1000;
    modem['startTime'] = startTime;
    const uptime = modem.getUptime();
    expect(uptime).toBeGreaterThanOrEqual(1000);
  });

  test('should emit events', (done) => {
    modem.on('error', (error) => {
      expect(error.message).toBe('Test error');
      done();
    });
    modem['handleError'](new Error('Test error'));
  });
}); 