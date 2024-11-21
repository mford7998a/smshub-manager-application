import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';

interface SMSHubConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
}

interface ModemRegistration {
  imei: string;
  model: string;
  operator: string;
}

interface SMSReport {
  modemId: string;
  message: string;
  sender: string;
  timestamp: Date;
}

export class SMSHubAPI {
  private client: AxiosInstance;

  constructor(private config: SMSHubConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        logger.error('SMSHub API error:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data
        });
        throw error;
      }
    );
  }

  async registerModem(data: ModemRegistration): Promise<{ success: boolean; modemId: string }> {
    try {
      const response = await this.client.post('/modems/register', data);
      return response.data;
    } catch (error) {
      logger.error('Failed to register modem:', error);
      throw error;
    }
  }

  async unregisterModem(modemId: string): Promise<boolean> {
    try {
      const response = await this.client.post(`/modems/${modemId}/unregister`);
      return response.data.success;
    } catch (error) {
      logger.error('Failed to unregister modem:', error);
      throw error;
    }
  }

  async reportSMS(data: SMSReport): Promise<boolean> {
    try {
      const response = await this.client.post('/messages/report', {
        ...data,
        timestamp: data.timestamp.toISOString()
      });
      return response.data.success;
    } catch (error) {
      logger.error('Failed to report SMS:', error);
      throw error;
    }
  }

  async getModemQuota(modemId: string): Promise<{
    daily: number;
    monthly: number;
    used: number;
    remaining: number;
  }> {
    try {
      const response = await this.client.get(`/modems/${modemId}/quota`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get modem quota:', error);
      throw error;
    }
  }

  async getModemStatus(modemId: string): Promise<{
    online: boolean;
    lastSeen: Date;
    messageCount: number;
    errorCount: number;
  }> {
    try {
      const response = await this.client.get(`/modems/${modemId}/status`);
      return {
        ...response.data,
        lastSeen: new Date(response.data.lastSeen)
      };
    } catch (error) {
      logger.error('Failed to get modem status:', error);
      throw error;
    }
  }

  async getMessageHistory(modemId: string, options: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    messages: Array<{
      id: string;
      sender: string;
      message: string;
      timestamp: Date;
      status: string;
    }>;
    total: number;
  }> {
    try {
      const params = {
        startDate: options.startDate?.toISOString(),
        endDate: options.endDate?.toISOString(),
        limit: options.limit,
        offset: options.offset
      };

      const response = await this.client.get(`/modems/${modemId}/messages`, { params });
      return {
        messages: response.data.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })),
        total: response.data.total
      };
    } catch (error) {
      logger.error('Failed to get message history:', error);
      throw error;
    }
  }

  async updateModemConfig(modemId: string, config: {
    dailyQuota?: number;
    monthlyQuota?: number;
    allowedSenders?: string[];
    blockedSenders?: string[];
    messageFilters?: Array<{
      pattern: string;
      action: 'block' | 'allow';
    }>;
  }): Promise<boolean> {
    try {
      const response = await this.client.put(`/modems/${modemId}/config`, config);
      return response.data.success;
    } catch (error) {
      logger.error('Failed to update modem config:', error);
      throw error;
    }
  }

  async getSystemStats(): Promise<{
    totalModems: number;
    activeModems: number;
    totalMessages: number;
    messagesByStatus: Record<string, number>;
    errorRate: number;
  }> {
    try {
      const response = await this.client.get('/system/stats');
      return response.data;
    } catch (error) {
      logger.error('Failed to get system stats:', error);
      throw error;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const response = await this.client.get('/ping');
      return response.data.success;
    } catch (error) {
      logger.error('Failed to ping SMSHub API:', error);
      return false;
    }
  }
} 