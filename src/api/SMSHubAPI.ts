import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { ConfigService } from '../services/ConfigService';
import { ErrorHandler } from '../utils/ErrorHandler';

interface SMSHubConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export class SMSHubAPI extends EventEmitter {
  private logger: Logger;
  private config: ConfigService;
  private client: AxiosInstance;
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: ConfigService) {
    super();
    this.logger = new Logger('SMSHubAPI');
    this.config = config;
    
    const apiConfig = this.getAPIConfig();
    this.client = axios.create({
      baseURL: apiConfig.baseUrl,
      timeout: apiConfig.timeout,
      headers: {
        'Authorization': `Bearer ${apiConfig.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private getAPIConfig(): SMSHubConfig {
    return {
      apiKey: this.config.get('api.key', ''),
      baseUrl: this.config.get('api.baseUrl', 'https://api.smshub.org/v1'),
      timeout: this.config.get('api.timeout', 30000),
      retryAttempts: this.config.get('api.retryAttempts', 3),
      retryDelay: this.config.get('api.retryDelay', 1000)
    };
  }

  private setupInterceptors(): void {
    // Response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      async error => {
        const config = error.config;
        
        if (!config || !config.retry) {
          config.retry = 0;
        }

        const apiConfig = this.getAPIConfig();
        if (config.retry >= apiConfig.retryAttempts) {
          return Promise.reject(error);
        }

        config.retry += 1;
        
        const delayMs = config.retry * apiConfig.retryDelay;
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        return this.client(config);
      }
    );
  }

  // Authentication methods
  async authenticate(credentials: {
    username: string;
    password: string;
  }): Promise<{
    userId: string;
    token: string;
    expiresAt: string;
    permissions: string[];
  }> {
    try {
      const response = await this.client.post('/auth/login', credentials);
      return response.data;
    } catch (error) {
      this.logger.error('Authentication failed:', error);
      throw error;
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await this.client.get('/auth/validate');
      return response.data.valid === true;
    } catch (error) {
      this.logger.error('API key validation failed:', error);
      return false;
    }
  }

  // Modem registration
  async registerModem(data: {
    imei: string;
    model: string;
    operator: string;
  }): Promise<{
    success: boolean;
    modemId: string;
    error?: string;
  }> {
    try {
      const response = await this.client.post('/modems/register', data);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to register modem:', error);
      throw error;
    }
  }

  // Message operations
  async sendMessage(data: {
    modemId: string;
    recipient: string;
    message: string;
    priority?: 'high' | 'normal' | 'low';
  }): Promise<{
    success: boolean;
    messageId: string;
    error?: string;
  }> {
    try {
      const response = await this.client.post('/messages/send', data);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      throw error;
    }
  }

  async updateModemStatus(modemId: string, status: {
    online: boolean;
    signalStrength?: number;
    operator?: string;
    error?: string;
  }): Promise<void> {
    try {
      await this.client.post(`/modems/${modemId}/status`, status);
    } catch (error) {
      this.logger.error(`Failed to update modem status for ${modemId}:`, error);
      throw error;
    }
  }

  async getMessageQueue(modemId: string): Promise<Array<{
    id: string;
    recipient: string;
    message: string;
    priority: string;
    createdAt: Date;
  }>> {
    try {
      const response = await this.client.get(`/modems/${modemId}/queue`);
      return response.data.messages;
    } catch (error) {
      this.logger.error(`Failed to get message queue for ${modemId}:`, error);
      throw error;
    }
  }

  async acknowledgeMessage(messageId: string, status: {
    success: boolean;
    error?: string;
  }): Promise<void> {
    try {
      await this.client.post(`/messages/${messageId}/ack`, status);
    } catch (error) {
      this.logger.error(`Failed to acknowledge message ${messageId}:`, error);
      throw error;
    }
  }

  // Status reporting
  async reportSMS(data: {
    messageId: string;
    status: 'sent' | 'failed';
    error?: string;
    timestamp: Date;
  }): Promise<void> {
    try {
      await this.client.post('/messages/report', data);
    } catch (error) {
      this.logger.error('Failed to report SMS status:', error);
      throw error;
    }
  }

  async updateSystemStatus(data: {
    metrics: any;
    timestamp: string;
  }): Promise<void> {
    try {
      await this.client.post('/system/status', data);
    } catch (error) {
      this.logger.error('Failed to update system status:', error);
      throw error;
    }
  }

  // Configuration
  updateApiKey(apiKey: string): void {
    this.client.defaults.headers['Authorization'] = `Bearer ${apiKey}`;
    this.config.set('api.key', apiKey);
  }

  // Session management
  async logout(token: string): Promise<void> {
    try {
      await this.client.post('/auth/logout', { token });
    } catch (error) {
      this.logger.error('Logout failed:', error);
      throw error;
    }
  }
} 