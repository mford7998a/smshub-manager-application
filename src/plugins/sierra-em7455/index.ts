import { BaseModemPlugin } from '../../core/plugin-manager/ModemPlugin';
import { PluginSDK } from '../../core/plugin-manager/PluginSDK';
import { Device as USBDevice } from 'usb';

class SierraEM7455Plugin extends BaseModemPlugin {
  private initialized: boolean = false;
  protected atProcessor: any;

  async initialize(device: USBDevice): Promise<void> {
    this.device = device;
    
    try {
      // Basic initialization
      await this.atProcessor.sendCommand(device, 'ATZ');
      await this.atProcessor.sendCommand(device, 'ATE0');
      await this.atProcessor.sendCommand(device, 'AT+CMGF=1');

      // Sierra-specific initialization
      await this.atProcessor.sendCommand(device, 'AT!RESET'); // Reset modem
      await this.atProcessor.sendCommand(device, 'AT!ENTERCND="A710"'); // Enter command mode
      await this.atProcessor.sendCommand(device, 'AT!BAND=00'); // Auto band selection
      await this.atProcessor.sendCommand(device, 'AT!SELRAT=06'); // LTE only mode
      await this.atProcessor.sendCommand(device, 'AT!USBCOMP=1'); // Set USB composition
      await this.atProcessor.sendCommand(device, 'AT+CEREG=2'); // Enable network registration URC
      
      // Configure SMS settings
      await this.atProcessor.sendCommand(device, 'AT+CNMI=2,1,0,0,0'); // SMS notifications
      await this.atProcessor.sendCommand(device, 'AT+CPMS="ME","ME","ME"'); // SMS storage
      
      this.initialized = true;
      this.logger.info('Sierra EM7455 modem initialized');
    } catch (error: any) {
      this.logger.error('Failed to initialize modem:', error);
      throw error;
    }
  }

  async sendSMS(number: string, message: string): Promise<boolean> {
    if (!this.initialized) throw new Error('Modem not initialized');

    try {
      // Validate inputs
      if (!this.validatePhoneNumber(number)) {
        throw new Error('Invalid phone number format');
      }
      if (!this.validateMessage(message)) {
        throw new Error('Invalid message length');
      }

      // Send message
      await this.atProcessor.sendCommand(this.device, `AT+CMGS="${number}"`);
      await this.atProcessor.sendCommand(this.device, `${message}\x1A`);
      
      return true;
    } catch (error: any) {
      this.logger.error('Failed to send SMS:', error);
      return false;
    }
  }

  async readSMS(): Promise<any[]> {
    if (!this.initialized) throw new Error('Modem not initialized');

    try {
      const response = await this.atProcessor.sendCommand(this.device, 'AT+CMGL="ALL"');
      return this.parseSMSResponse(response);
    } catch (error: any) {
      this.logger.error('Failed to read SMS:', error);
      return [];
    }
  }

  async getSignalStrength(): Promise<number> {
    if (!this.initialized) throw new Error('Modem not initialized');

    try {
      const response = await this.atProcessor.sendCommand(this.device, 'AT+CSQ');
      const match = response.match(/\+CSQ:\s*(\d+)/);
      if (!match) throw new Error('Invalid signal strength response');
      
      const [, signal] = match;
      return parseInt(signal, 10);
    } catch (error: any) {
      this.logger.error('Failed to get signal strength:', error);
      throw error;
    }
  }

  async getNetworkInfo(): Promise<{
    operator: string;
    technology: string;
    band?: string;
    signal?: number;
  }> {
    if (!this.initialized) throw new Error('Modem not initialized');

    try {
      // Get operator info
      const operatorResponse = await this.atProcessor.sendCommand(this.device, 'AT+COPS?');
      const operator = this.parseOperator(operatorResponse);

      // Get network technology and band
      const techResponse = await this.atProcessor.sendCommand(this.device, 'AT!GBAND?');
      const { technology, band } = this.parseNetworkInfo(techResponse);

      // Get signal strength
      const signal = await this.getSignalStrength();

      return {
        operator,
        technology,
        band,
        signal
      };
    } catch (error: any) {
      this.logger.error('Failed to get network info:', error);
      throw error;
    }
  }

  private parseOperator(response: string): string {
    const match = response.match(/\+COPS:\s*\d,\d,"([^"]+)"/);
    return match ? match[1] : 'Unknown';
  }

  private parseNetworkInfo(response: string): {
    technology: string;
    band?: string;
  } {
    // Example response: !GBAND: LTE B4B13
    const match = response.match(/!GBAND:\s*(\w+)\s*(B[\d]+(?:B[\d]+)*)?/);
    if (!match) {
      return { technology: 'Unknown' };
    }

    return {
      technology: match[1],
      band: match[2]
    };
  }

  async reset(): Promise<void> {
    try {
      await this.atProcessor.sendCommand(this.device, 'AT!RESET');
      this.initialized = false;
      await new Promise(resolve => setTimeout(resolve, 10000)); // Longer wait for Sierra
      await this.initialize(this.device!);
    } catch (error: any) {
      this.logger.error('Failed to reset modem:', error);
      throw error;
    }
  }

  async getStatus(): Promise<{
    connected: boolean;
    signalStrength: number;
    operator?: string;
    technology?: string;
    error?: string;
  }> {
    try {
      const signal = await this.getSignalStrength();
      const network = await this.getNetworkInfo();

      return {
        connected: this.initialized,
        signalStrength: signal,
        operator: network.operator,
        technology: network.technology
      };
    } catch (error: any) {
      return {
        connected: false,
        signalStrength: 0,
        error: error.message
      };
    }
  }

  // Optional methods
  async enable(): Promise<void> {
    if (!this.initialized && this.device) {
      await this.initialize(this.device);
    }
  }

  async disable(): Promise<void> {
    if (this.initialized) {
      try {
        await this.atProcessor.sendCommand(this.device!, 'AT!ENTERCND="A710"');
        await this.atProcessor.sendCommand(this.device!, 'AT!POWEROFF');
        this.initialized = false;
      } catch (error: any) {
        this.logger.error('Failed to disable modem:', error);
      }
    }
  }
}

export default PluginSDK.createPlugin(SierraEM7455Plugin); 