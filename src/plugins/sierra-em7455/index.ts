import { SerialPort } from 'serialport';
import { ModemPlugin, ModemCapabilities, ModemInfo, ATResponse } from '../../core/plugin-manager/ModemPlugin';
import { logger } from '../../utils/logger';

export default class SierraEM7455Plugin extends ModemPlugin {
  get capabilities(): ModemCapabilities {
    return {
      supportsUSSD: true,
      supportsCustomAT: true,
      maxBaudRate: 921600,
      supportedBands: [
        'B1', 'B2', 'B3', 'B4', 'B5', 'B7', 'B8', 'B12', 'B13',
        'B20', 'B25', 'B26', 'B29', 'B30', 'B41'
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

      return true;
    } catch (error) {
      this.handleError(error as Error);
      return false;
    }
  }

  async sendSMS(number: string, message: string): Promise<boolean> {
    try {
      await this.sendAT('AT+CMGF=1'); // Set text mode
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
        '4g': 'AT+COPS=0,,,7',
        '5g': 'AT+COPS=0,,,13',
        'auto': 'AT+COPS=0'
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
      await this.sendAT(`AT!BAND=${bandMask}`);
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
      'B20': 524288, 'B25': 8388608, 'B26': 16777216,
      'B29': 268435456, 'B30': 536870912, 'B41': 2199023255552
    };

    const mask = bands.reduce((acc, band) => acc | (bandMap[band] || 0), 0);
    return `0x${mask.toString(16)}`;
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