import { BaseModemPlugin } from './ModemPlugin';
import { ATCommandProcessor } from '../../services/ATCommandProcessor';
import { Logger } from '../../utils/logger';

export class PluginSDK {
  static createPlugin(implementation: typeof BaseModemPlugin): any {
    return class extends implementation {
      private atProcessor: ATCommandProcessor;
      private logger: Logger;

      constructor() {
        super();
        this.atProcessor = new ATCommandProcessor();
        this.logger = new Logger(this.constructor.name);
      }

      // Inject dependencies
      injectDependencies(deps: {
        atProcessor?: ATCommandProcessor;
        logger?: Logger;
      }): void {
        if (deps.atProcessor) {
          this.atProcessor = deps.atProcessor;
        }
        if (deps.logger) {
          this.logger = deps.logger;
        }
      }

      // Plugin validation
      static validatePlugin(plugin: any): boolean {
        return PluginSDK.validateImplementation(plugin);
      }

      // Plugin metadata
      static getMetadata(): any {
        return {
          name: implementation.name,
          version: '1.0.0',
          type: 'modem'
        };
      }
    };
  }

  private static validateImplementation(plugin: any): boolean {
    const required = [
      'initialize',
      'sendSMS',
      'readSMS',
      'getSignalStrength',
      'getNetworkInfo',
      'reset',
      'getStatus'
    ];

    return required.every(method => typeof plugin.prototype[method] === 'function');
  }
} 