import path from 'path';
import fs from 'fs/promises';
import axios from 'axios';
import { logger } from '../utils/logger';
import { Config } from '../utils/Config';

interface FirmwareInfo {
  version: string;
  url: string;
  md5: string;
  size: number;
  releaseNotes: string;
  supportedModels: string[];
  carrier?: string;
}

export class AutoflashService {
  private firmwareCache: Map<string, FirmwareInfo> = new Map();
  private downloadPath: string;
  private config: Config;

  constructor(tempPath: string) {
    this.downloadPath = path.join(tempPath, 'firmware');
    this.config = Config.getInstance();
  }

  async initialize(): Promise<void> {
    try {
      // Create firmware download directory
      await fs.mkdir(this.downloadPath, { recursive: true });
      
      // Load firmware catalog
      await this.updateFirmwareCatalog();
      
      logger.info('AutoflashService initialized');
    } catch (error) {
      logger.error('Failed to initialize AutoflashService:', error);
      throw error;
    }
  }

  async flashModem(config: {
    firmwareVersion?: string;
    carrier?: string;
    type?: string;
    apn?: string;
    forceGeneric?: boolean;
  }): Promise<void> {
    try {
      // Get firmware info
      const firmware = await this.getFirmware(config.firmwareVersion!, config.carrier);
      if (!firmware) {
        throw new Error('Firmware not found');
      }

      // Download firmware if not cached
      const firmwarePath = await this.downloadFirmware(firmware);

      // Verify firmware integrity
      await this.verifyFirmware(firmwarePath, firmware.md5);

      // Flash firmware
      await this.performFlash(firmwarePath, config);

      logger.info('Modem flashed successfully');
    } catch (error) {
      logger.error('Failed to flash modem:', error);
      throw error;
    }
  }

  private async updateFirmwareCatalog(): Promise<void> {
    try {
      const response = await axios.get(
        `${this.config.get('smshub').baseUrl}/firmware/catalog`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.get('smshub').apiKey}`
          }
        }
      );

      this.firmwareCache.clear();
      for (const firmware of response.data) {
        this.firmwareCache.set(
          this.getFirmwareKey(firmware.version, firmware.carrier),
          firmware
        );
      }

      logger.info('Firmware catalog updated');
    } catch (error) {
      logger.error('Failed to update firmware catalog:', error);
      throw error;
    }
  }

  private async getFirmware(version: string, carrier?: string): Promise<FirmwareInfo | undefined> {
    const key = this.getFirmwareKey(version, carrier);
    return this.firmwareCache.get(key);
  }

  private async downloadFirmware(firmware: FirmwareInfo): Promise<string> {
    const firmwarePath = path.join(this.downloadPath, `${firmware.version}.bin`);

    try {
      // Check if firmware already exists
      const exists = await fs.access(firmwarePath)
        .then(() => true)
        .catch(() => false);

      if (exists) {
        // Verify existing firmware
        if (await this.verifyFirmware(firmwarePath, firmware.md5)) {
          return firmwarePath;
        }
        // If verification fails, delete and re-download
        await fs.unlink(firmwarePath);
      }

      // Download firmware
      const response = await axios({
        method: 'get',
        url: firmware.url,
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(firmwarePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      logger.info(`Firmware downloaded: ${firmware.version}`);
      return firmwarePath;
    } catch (error) {
      logger.error('Failed to download firmware:', error);
      throw error;
    }
  }

  private async verifyFirmware(firmwarePath: string, expectedMd5: string): Promise<boolean> {
    try {
      const crypto = require('crypto');
      const fileBuffer = await fs.readFile(firmwarePath);
      const md5 = crypto.createHash('md5').update(fileBuffer).digest('hex');
      return md5 === expectedMd5;
    } catch (error) {
      logger.error('Failed to verify firmware:', error);
      throw error;
    }
  }

  private async performFlash(firmwarePath: string, config: {
    type?: string;
    apn?: string;
    forceGeneric?: boolean;
  }): Promise<void> {
    // Implementation depends on modem type and flashing method
    // This is a placeholder for the actual flashing logic
    logger.info('Performing firmware flash...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private getFirmwareKey(version: string, carrier?: string): string {
    return carrier ? `${version}-${carrier}` : version;
  }

  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.downloadPath, { recursive: true, force: true });
      logger.info('AutoflashService cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup AutoflashService:', error);
    }
  }
} 