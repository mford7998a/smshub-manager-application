import { Logger } from './logger';

export class ErrorHandler {
  private static logger = new Logger('ErrorHandler');

  static async handleAsync<T>(
    promise: Promise<T>,
    context: string
  ): Promise<[T | null, Error | null]> {
    try {
      const result = await promise;
      return [result, null];
    } catch (error) {
      this.logger.error(`Error in ${context}:`, error);
      return [null, error as Error];
    }
  }

  static handle<T>(
    fn: () => T,
    context: string
  ): [T | null, Error | null] {
    try {
      const result = fn();
      return [result, null];
    } catch (error) {
      this.logger.error(`Error in ${context}:`, error);
      return [null, error as Error];
    }
  }

  static async withRetry<T>(
    fn: () => Promise<T>,
    options: {
      retries: number;
      delay: number;
      context: string;
      onRetry?: (attempt: number, error: Error) => void;
    }
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= options.retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Attempt ${attempt}/${options.retries} failed in ${options.context}:`,
          error
        );

        if (options.onRetry) {
          options.onRetry(attempt, error as Error);
        }

        if (attempt < options.retries) {
          await new Promise(resolve => setTimeout(resolve, options.delay));
        }
      }
    }

    throw new Error(
      `Failed after ${options.retries} attempts in ${options.context}: ${lastError?.message}`
    );
  }

  static formatError(error: Error): string {
    return `${error.name}: ${error.message}\n${error.stack || ''}`;
  }

  static isOperationalError(error: Error): boolean {
    // Determine if error is operational (expected) or programmer error
    const operationalErrors = [
      'TimeoutError',
      'NetworkError',
      'ValidationError',
      'AuthenticationError',
      'USBError',
      'ModemError',
      'PluginError'
    ];

    return operationalErrors.includes(error.name);
  }

  static handleUncaughtException(error: Error): void {
    this.logger.error('Uncaught Exception:', error);
    
    if (!this.isOperationalError(error)) {
      // Exit for programmer errors
      process.exit(1);
    }
  }

  static handleUnhandledRejection(reason: any): void {
    this.logger.error('Unhandled Rejection:', reason);
    
    if (reason instanceof Error && !this.isOperationalError(reason)) {
      // Exit for programmer errors
      process.exit(1);
    }
  }
}

// Custom error classes
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class USBError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'USBError';
  }
}

export class ModemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModemError';
  }
}

export class PluginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PluginError';
  }
} 