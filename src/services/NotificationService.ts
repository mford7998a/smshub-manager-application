import { Store } from 'vuex';
import { logger } from '../utils/logger';

export class NotificationService {
  private static instance: NotificationService;
  private store: Store<any>;

  private constructor(store: Store<any>) {
    this.store = store;
  }

  static getInstance(store: Store<any>): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService(store);
    }
    return NotificationService.instance;
  }

  success(message: string, options: Partial<NotificationOptions> = {}): string {
    return this.notify({
      type: 'success',
      message,
      timeout: 3000,
      ...options
    });
  }

  error(message: string, options: Partial<NotificationOptions> = {}): string {
    return this.notify({
      type: 'error',
      message,
      timeout: 0, // No auto-dismiss for errors
      ...options
    });
  }

  warning(message: string, options: Partial<NotificationOptions> = {}): string {
    return this.notify({
      type: 'warning',
      message,
      timeout: 5000,
      ...options
    });
  }

  info(message: string, options: Partial<NotificationOptions> = {}): string {
    return this.notify({
      type: 'info',
      message,
      timeout: 4000,
      ...options
    });
  }

  private notify(options: NotificationOptions): string {
    try {
      return this.store.dispatch('notifications/notify', options);
    } catch (error) {
      logger.error('Failed to show notification:', error);
      return '';
    }
  }

  remove(id: string): void {
    this.store.dispatch('notifications/remove', id);
  }

  clear(): void {
    this.store.dispatch('notifications/clear');
  }
}

interface NotificationOptions {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
  timeout?: number;
  action?: {
    text: string;
    handler: () => void;
  };
}

export default NotificationService; 