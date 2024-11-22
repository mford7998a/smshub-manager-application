import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { Store } from '../database/Store';
import { ModemManager } from './ModemManager';
import { SMSHubAPI } from '../api/SMSHubAPI';
import { ConfigService } from './ConfigService';

interface QueuedMessage {
  id: string;
  modemId: string;
  recipient: string;
  message: string;
  priority: 'high' | 'normal' | 'low';
  retries: number;
  createdAt: Date;
  nextAttempt?: Date;
  error?: string;
}

export class MessageQueue extends EventEmitter {
  private logger: Logger;
  private store: Store;
  private modemManager: ModemManager;
  private api: SMSHubAPI;
  private config: ConfigService;
  private queue: Map<string, QueuedMessage> = new Map();
  private processing: boolean = false;
  private processInterval?: NodeJS.Timeout;

  constructor(
    store: Store,
    modemManager: ModemManager,
    api: SMSHubAPI,
    config: ConfigService
  ) {
    super();
    this.logger = new Logger('MessageQueue');
    this.store = store;
    this.modemManager = modemManager;
    this.api = api;
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      // Load pending messages from database
      await this.loadPendingMessages();
      
      // Start processing queue
      this.startProcessing();
      
      this.logger.info('Message Queue initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Message Queue:', error);
      throw error;
    }
  }

  private async loadPendingMessages(): Promise<void> {
    const messages = await this.store.getMessages({ status: 'pending' });
    for (const msg of messages) {
      this.queue.set(msg.id!, {
        id: msg.id!.toString(),
        modemId: msg.modemId,
        recipient: msg.sender,
        message: msg.message,
        priority: 'normal',
        retries: 0,
        createdAt: msg.timestamp,
        error: msg.error
      });
    }
  }

  private startProcessing(): void {
    const interval = this.config.get('queue.processInterval', 1000);
    this.processInterval = setInterval(() => {
      if (!this.processing) {
        this.processQueue();
      }
    }, interval);
  }

  private async processQueue(): Promise<void> {
    if (this.queue.size === 0) return;

    this.processing = true;
    const messages = Array.from(this.queue.values())
      .sort((a, b) => {
        // Sort by priority and creation time
        if (a.priority !== b.priority) {
          return a.priority === 'high' ? -1 : 1;
        }
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

    for (const message of messages) {
      if (message.nextAttempt && message.nextAttempt > new Date()) {
        continue; // Skip messages that are waiting for retry
      }

      try {
        await this.sendMessage(message);
        this.queue.delete(message.id);
        this.emit('message:sent', message);
      } catch (error) {
        this.handleSendError(message, error as Error);
      }
    }

    this.processing = false;
  }

  private async sendMessage(message: QueuedMessage): Promise<void> {
    const modem = this.modemManager.getModemStatus(message.modemId);
    if (!modem || modem.status !== 'ready') {
      throw new Error(`Modem ${message.modemId} not ready`);
    }

    const success = await this.modemManager.sendSMS(
      message.modemId,
      message.recipient,
      message.message
    );

    if (!success) {
      throw new Error('Failed to send message');
    }

    // Update database and API
    await Promise.all([
      this.store.updateMessage(message.id, { status: 'sent' }),
      this.api.reportSMS({
        messageId: message.id,
        status: 'sent',
        timestamp: new Date()
      })
    ]);
  }

  private handleSendError(message: QueuedMessage, error: Error): void {
    message.retries++;
    message.error = error.message;

    const maxRetries = this.config.get('queue.maxRetries', 3);
    if (message.retries >= maxRetries) {
      this.queue.delete(message.id);
      this.emit('message:failed', message);
      
      // Update database and API
      Promise.all([
        this.store.updateMessage(message.id, {
          status: 'failed',
          error: error.message
        }),
        this.api.reportSMS({
          messageId: message.id,
          status: 'failed',
          error: error.message,
          timestamp: new Date()
        })
      ]).catch(err => {
        this.logger.error('Failed to update message status:', err);
      });
    } else {
      // Calculate next retry time with exponential backoff
      const delay = Math.pow(2, message.retries) * 1000;
      message.nextAttempt = new Date(Date.now() + delay);
    }
  }

  // Public API methods
  async queueMessage(message: Omit<QueuedMessage, 'id' | 'retries' | 'createdAt'>): Promise<string> {
    const id = Date.now().toString();
    const queuedMessage: QueuedMessage = {
      ...message,
      id,
      retries: 0,
      createdAt: new Date()
    };

    this.queue.set(id, queuedMessage);
    this.emit('message:queued', queuedMessage);

    await this.store.saveMessage({
      id: parseInt(id),
      modemId: message.modemId,
      sender: message.recipient,
      message: message.message,
      timestamp: new Date(),
      status: 'pending'
    });

    return id;
  }

  getQueueStatus(): {
    total: number;
    pending: number;
    retrying: number;
  } {
    const messages = Array.from(this.queue.values());
    return {
      total: messages.length,
      pending: messages.filter(m => !m.nextAttempt).length,
      retrying: messages.filter(m => m.nextAttempt).length
    };
  }

  clearQueue(): void {
    this.queue.clear();
    this.emit('queue:cleared');
  }

  shutdown(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
    }
    this.queue.clear();
  }
} 