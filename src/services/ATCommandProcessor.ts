import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/ErrorHandler';
import { Device as USBDevice } from 'usb';

interface ATCommand {
  command: string;
  timeout: number;
  retries: number;
  resolve: (response: string) => void;
  reject: (error: Error) => void;
}

interface ATCommandOptions {
  timeout?: number;
  retries?: number;
  ignoreErrors?: boolean;
}

export class ATCommandProcessor extends EventEmitter {
  private readonly logger: Logger;
  private readonly commandQueue: Map<string, ATCommand[]> = new Map();
  private readonly executing: Map<string, boolean> = new Map();
  private readonly DEFAULT_TIMEOUT = 10000;
  private readonly DEFAULT_RETRIES = 2;

  constructor() {
    super();
    this.logger = new Logger('ATCommandProcessor');
  }

  async sendCommand(
    device: USBDevice,
    command: string,
    options: ATCommandOptions = {}
  ): Promise<string> {
    const deviceId = device.serialNumber || device.productId.toString();
    
    return new Promise((resolve, reject) => {
      const cmd: ATCommand = {
        command: this.formatCommand(command),
        timeout: options.timeout || this.DEFAULT_TIMEOUT,
        retries: options.retries || this.DEFAULT_RETRIES,
        resolve,
        reject
      };

      this.queueCommand(deviceId, cmd);
      this.processQueue(deviceId, device);
    });
  }

  private formatCommand(command: string): string {
    // Ensure command ends with carriage return
    command = command.trim();
    if (!command.endsWith('\r')) {
      command += '\r';
    }
    return command;
  }

  private queueCommand(deviceId: string, command: ATCommand): void {
    if (!this.commandQueue.has(deviceId)) {
      this.commandQueue.set(deviceId, []);
    }
    this.commandQueue.get(deviceId)!.push(command);
  }

  private async processQueue(deviceId: string, device: USBDevice): Promise<void> {
    if (this.executing.get(deviceId)) {
      return; // Already processing commands for this device
    }

    this.executing.set(deviceId, true);

    while (this.commandQueue.get(deviceId)?.length) {
      const command = this.commandQueue.get(deviceId)![0];
      
      try {
        const response = await this.executeCommand(device, command);
        command.resolve(response);
      } catch (error) {
        if (command.retries > 0) {
          command.retries--;
          this.logger.warn(`Retrying command: ${command.command}`);
          continue;
        }
        command.reject(error as Error);
      } finally {
        this.commandQueue.get(deviceId)!.shift();
      }
    }

    this.executing.set(deviceId, false);
  }

  private async executeCommand(
    device: USBDevice,
    command: ATCommand
  ): Promise<string> {
    const [response, error] = await ErrorHandler.handleAsync(
      this.writeAndRead(device, command),
      `AT Command: ${command.command}`
    );

    if (error) {
      this.logger.error('AT command failed:', {
        command: command.command,
        error: error.message
      });
      throw error;
    }

    return this.parseResponse(response!);
  }

  private async writeAndRead(
    device: USBDevice,
    command: ATCommand
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('AT command timeout'));
      }, command.timeout);

      let response = '';

      // Write command
      device.transferOut(1, this.encodeCommand(command.command))
        .then(() => {
          // Read response
          return this.readResponse(device);
        })
        .then((data) => {
          clearTimeout(timeout);
          resolve(data);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private encodeCommand(command: string): ArrayBuffer {
    return new TextEncoder().encode(command).buffer;
  }

  private async readResponse(device: USBDevice): Promise<string> {
    let response = '';
    let endOfResponse = false;

    while (!endOfResponse) {
      const result = await device.transferIn(2, 64);
      if (result.data) {
        const chunk = new TextDecoder().decode(result.data);
        response += chunk;
        
        // Check for common AT command terminations
        if (response.includes('OK\r\n') || 
            response.includes('ERROR\r\n') ||
            response.includes('NO CARRIER\r\n')) {
          endOfResponse = true;
        }
      }
    }

    return response;
  }

  private parseResponse(response: string): string {
    // Remove echo of command if present
    response = response.replace(/^AT.*\r\n/, '');
    
    // Remove trailing OK/ERROR
    response = response.replace(/OK\r\n$/, '');
    response = response.replace(/ERROR\r\n$/, '');
    
    // Check for errors
    if (response.includes('ERROR')) {
      throw new Error(`AT command error: ${response.trim()}`);
    }

    return response.trim();
  }

  // Utility methods for common AT commands
  async getModemInfo(device: USBDevice): Promise<{
    manufacturer: string;
    model: string;
    revision: string;
    imei: string;
  }> {
    const manufacturer = await this.sendCommand(device, 'AT+CGMI');
    const model = await this.sendCommand(device, 'AT+CGMM');
    const revision = await this.sendCommand(device, 'AT+CGMR');
    const imei = await this.sendCommand(device, 'AT+CGSN');

    return {
      manufacturer: manufacturer.trim(),
      model: model.trim(),
      revision: revision.trim(),
      imei: imei.trim()
    };
  }

  async getSignalStrength(device: USBDevice): Promise<number> {
    const response = await this.sendCommand(device, 'AT+CSQ');
    const match = response.match(/\+CSQ:\s*(\d+)/);
    if (!match) {
      throw new Error('Invalid signal strength response');
    }
    return parseInt(match[1], 10);
  }

  async getNetworkInfo(device: USBDevice): Promise<{
    operator: string;
    technology: string;
  }> {
    const operator = await this.sendCommand(device, 'AT+COPS?');
    const technology = await this.sendCommand(device, 'AT+CREG?');

    return {
      operator: this.parseOperator(operator),
      technology: this.parseTechnology(technology)
    };
  }

  private parseOperator(response: string): string {
    const match = response.match(/\+COPS:\s*\d,\d,"([^"]+)"/);
    return match ? match[1] : 'Unknown';
  }

  private parseTechnology(response: string): string {
    const technologies = ['GSM', 'GPRS', 'EDGE', 'UMTS', 'HSDPA', 'LTE'];
    const match = response.match(/\+CREG:\s*\d,\d,(?:"[^"]+",)?(\d+)/);
    const techIndex = match ? parseInt(match[1], 10) : 0;
    return technologies[techIndex] || 'Unknown';
  }
} 