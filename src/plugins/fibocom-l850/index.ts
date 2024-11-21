import { SerialPort } from 'serialport';
import { ModemPlugin, ModemCapabilities, ModemInfo, ATResponse } from '../../core/plugin-manager/ModemPlugin';
import { logger } from '../../utils/logger';

export default class FibocomL850Plugin extends ModemPlugin {
  get capabilities(): ModemCapabilities {
    return {
      supportsUSSD: true,
      supportsCustomAT: true,
      maxBaudRate: 921600,
      supportedBands: [
        'B1', 'B2', 'B3', 'B4', 'B5', 'B7', 'B8', 'B12', 'B13',
        'B14', 'B17', 'B18', 'B19', 'B20', 'B25', 'B26', 'B28',
        'B29', 'B30', 'B32', 'B38', 'B39', 'B40', 'B41', 'B42',
        'B43', 'B46', 'B48', 'B66', 'B71'
      ]
    };
  }

  async initialize(): Promise<boolean> {
    try {
      this.port = new SerialPort({
        path: this.devicePath,
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      });

      this.port.on('data', this.handleData.bind(this));
      this.port.on('error', this.handleError.bind(this));

      // Initialize modem
      await this.sendAT('ATZ');
      await this.sendAT('ATE0'); // Disable echo
      await this.sendAT('AT+CMEE=2'); // Enable verbose error messages
      await this.sendAT('AT+CFUN=1'); // Set full functionality
      await this.sendAT('AT+CREG=2'); // Enable network registration and location info
      await this.sendAT('AT+CGREG=2'); // Enable GPRS registration and location info
      await this.sendAT('AT+CEREG=2'); // Enable EPS registration and location info

      // Get modem info
      const [manufacturer, model, serial, firmware, imei, iccid] = await Promise.all([
        this.sendAT('AT+CGMI'),
        this.sendAT('AT+CGMM'),
        this.sendAT('AT+CGSN'),
        this.sendAT('AT+CGMR'),
        this.sendAT('AT+CGSN'),
        this.sendAT('AT+ICCID')
      ]);

      this.info = {
        manufacturer: manufacturer.data.trim(),
        model: model.data.trim(),
        serialNumber: serial.data.trim(),
        firmwareVersion: firmware.data.trim(),
        imei: imei.data.trim(),
        iccid: iccid.data.trim(),
        operator: (await this.sendAT('AT+COPS?')).data.split(',')[2].replace(/"/g, '')
      };

      // Configure SMS format
      await this.sendAT('AT+CMGF=1'); // Set text mode
      await this.sendAT('AT+CNMI=2,1,0,0,0'); // Configure new message indications

      return true;
    } catch (error) {
      this.handleError(error as Error);
      return false;
    }
  }

  async sendSMS(number: string, message: string): Promise<boolean> {
    try {
      await this.sendAT(`AT+CMGS="${number}"`);
      await this.sendAT(`${message}\x1A`);
      return true;
    } catch (error) {
      this.handleError(error as Error);
      return false;
    }
  }

  async sendAT(command: string): Promise<ATResponse> {
    return new Promise((resolve, reject) => {
      if (!this.port || !this.port.isOpen) {
        reject(new Error('Port not open'));
        return;
      }

      let response = '';
      const timeout = setTimeout(() => {
        reject(new Error('AT command timeout'));
      }, 10000);

      const dataHandler = (data: Buffer) => {
        response += data.toString();
        if (response.includes('OK\r\n') || response.includes('ERROR')) {
          cleanup();
          resolve({
            success: response.includes('OK'),
            data: response.replace(/^.*\r\n|\r\n.*$/g, '').trim(),
            error: response.includes('ERROR') ? response : undefined
          });
        }
      };

      const errorHandler = (error: Error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.port?.off('data', dataHandler);
        this.port?.off('error', errorHandler);
      };

      this.port.on('data', dataHandler);
      this.port.on('error', errorHandler);
      this.port.write(`${command}\r\n`);
    });
  }

  async setNetworkMode(mode: '4g' | '5g' | 'auto'): Promise<boolean> {
    try {
      const modeMap = {
        '4g': 'AT+CNMP=38', // LTE only
        '5g': 'AT+CNMP=109', // 5G NSA/SA
        'auto': 'AT+CNMP=2' // Automatic
      };
      await this.sendAT(modeMap[mode]);
      return true;
    } catch (error) {
      this.handleError(error as Error);
      return false;
    }
  }

  async setBands(bands: string[]): Promise<boolean> {
    try {
      const bandMask = this.calculateBandMask(bands);
      await this.sendAT(`AT+FBANDSEL=1,${bandMask}`);
      return true;
    } catch (error) {
      this.handleError(error as Error);
      return false;
    }
  }

  private calculateBandMask(bands: string[]): string {
    const bandMap: { [key: string]: number } = {
      'B1': 1, 'B2': 2, 'B3': 4, 'B4': 8, 'B5': 16,
      'B7': 64, 'B8': 128, 'B12': 2048, 'B13': 4096,
      'B14': 8192, 'B17': 65536, 'B18': 131072, 'B19': 262144,
      'B20': 524288, 'B25': 8388608, 'B26': 16777216, 'B28': 67108864,
      'B29': 134217728, 'B30': 268435456, 'B32': 1073741824,
      'B38': 1, 'B39': 2, 'B40': 4, 'B41': 8, 'B42': 16,
      'B43': 32, 'B46': 256, 'B48': 1024, 'B66': 16, 'B71': 268435456
    };

    const mask = bands.reduce((acc, band) => acc | (bandMap[band] || 0), 0);
    return `0x${mask.toString(16)}`;
  }

  async setCarrierAggregation(enabled: boolean): Promise<boolean> {
    try {
      await this.sendAT(`AT+FCA=${enabled ? 1 : 0}`);
      return true;
    } catch (error) {
      this.handleError(error as Error);
      return false;
    }
  }

  async setAPN(apn: string): Promise<boolean> {
    try {
      await this.sendAT(`AT+CGDCONT=1,"IP","${apn}"`);
      return true;
    } catch (error) {
      this.handleError(error as Error);
      return false;
    }
  }

  getSignalStrength(): number {
    try {
      const response = this.sendAT('AT+CSQ');
      const csq = parseInt(response.data.split(':')[1].trim());
      return Math.min(Math.round((csq / 31) * 100), 100);
    } catch {
      return 0;
    }
  }

  protected handleData(data: Buffer): void {
    const message = data.toString().trim();
    if (message.startsWith('+CMT:')) {
      // SMS received
      const [header, content] = message.split('\r\n');
      const [, sender] = header.split(',');
      this.emit('message', {
        sender: sender.replace(/"/g, ''),
        message: content.trim(),
        timestamp: new Date()
      });
    }
  }
} 