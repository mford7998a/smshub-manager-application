import winston from 'winston';
import path from 'path';
import { app } from 'electron';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level.toUpperCase()}: ${message}${stack ? '\n' + stack : ''}`;
  })
);

// Create logs directory if it doesn't exist
const logsDir = path.join(app.getPath('userData'), 'logs');

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: logFormat,
  transports: [
    // Write all logs to files
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Add console output in development
if (process.env.NODE_ENV === 'development') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    )
  }));
}

// Error handler utility
export class ErrorHandler {
  static handle(error: Error, context: string): void {
    logger.error(`Error in ${context}: ${error.message}`, {
      error,
      context,
      stack: error.stack
    });
  }

  static async handleAsync<T>(
    promise: Promise<T>,
    context: string
  ): Promise<[T | null, Error | null]> {
    try {
      const result = await promise;
      return [result, null];
    } catch (error) {
      this.handle(error as Error, context);
      return [null, error as Error];
    }
  }

  static wrapHandler<T extends (...args: any[]) => Promise<any>>(
    handler: T,
    context: string
  ): T {
    return (async (...args: Parameters<T>) => {
      try {
        return await handler(...args);
      } catch (error) {
        this.handle(error as Error, context);
        throw error;
      }
    }) as T;
  }
}

// Export default logger instance
export default logger; 