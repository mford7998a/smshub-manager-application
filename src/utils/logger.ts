import * as winston from 'winston';
import * as path from 'path';
import { app } from 'electron';
import { encrypt } from './encryption';
import { ConfigService } from '../services/ConfigService';

export class Logger {
  private logger: winston.Logger;
  private static config: ConfigService;
  private static instances: Map<string, Logger> = new Map();

  static initialize(config: ConfigService): void {
    this.config = config;
  }

  constructor(context: string) {
    if (!Logger.instances.has(context)) {
      this.logger = this.createLogger(context);
      Logger.instances.set(context, this);
    }
    return Logger.instances.get(context)!;
  }

  private createLogger(context: string): winston.Logger {
    const logDir = Logger.config?.get(
      'logging.directory',
      path.join(app.getPath('userData'), 'logs')
    );

    const logLevel = Logger.config?.get('logging.level', 'info');
    const maxFiles = Logger.config?.get('logging.maxFiles', 5);
    const maxSize = Logger.config?.get('logging.maxSize', 10485760); // 10MB
    const encryptLogs = Logger.config?.get('security.encryptLogs', true);
    const encryptionKey = Logger.config?.get('security.encryptionKey', '');

    const format = winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const formattedMessage = `[${timestamp}] [${context}] ${level}: ${message}`;
        const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
        return formattedMessage + metaStr;
      })
    );

    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.colorize({ all: true })
      }),
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        maxsize: maxSize,
        maxFiles,
        format: encryptLogs ? this.createEncryptedFormat(encryptionKey) : format
      }),
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        maxsize: maxSize,
        maxFiles,
        format: encryptLogs ? this.createEncryptedFormat(encryptionKey) : format
      })
    ];

    return winston.createLogger({
      level: logLevel,
      format,
      transports
    });
  }

  private createEncryptedFormat(encryptionKey: string): winston.Logform.Format {
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(info => {
        const message = `[${info.timestamp}] [${info.level}]: ${info.message}`;
        return encrypt(message, encryptionKey);
      })
    );
  }

  debug(message: string, ...meta: any[]): void {
    this.logger.debug(message, ...meta);
  }

  info(message: string, ...meta: any[]): void {
    this.logger.info(message, ...meta);
  }

  warn(message: string, ...meta: any[]): void {
    this.logger.warn(message, ...meta);
  }

  error(message: string, ...meta: any[]): void {
    this.logger.error(message, ...meta);
  }

  // Utility methods
  startTimer(): () => number {
    const start = process.hrtime();
    return () => {
      const [seconds, nanoseconds] = process.hrtime(start);
      return seconds * 1000 + nanoseconds / 1000000;
    };
  }

  profile(id: string): void {
    this.logger.profile(id);
  }

  static flush(): Promise<void> {
    const promises = Array.from(Logger.instances.values()).map(
      logger => new Promise<void>((resolve) => {
        logger.logger.on('finish', resolve);
        logger.logger.end();
      })
    );
    return Promise.all(promises).then(() => {});
  }
} 