import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { Store } from '../database/Store';
import { ModemManager } from './ModemManager';
import { ConfigService } from './ConfigService';
import { SMSHubAPI } from '../api/SMSHubAPI';
import * as os from 'os';

interface SystemMetrics {
  cpu: number;
  memory: number;
  uptime: number;
  activeModems: number;
  messageRate: number;
  errorRate: number;
  avgResponseTime: number;
}

interface ModemMetrics {
  id: string;
  signalStrength: number;
  errorCount: number;
  lastSeen: Date;
  status: string;
  messageSuccess: number;
  messageFailure: number;
  responseTime: number[];
}

export class HealthMonitor extends EventEmitter {
  private logger: Logger;
  private store: Store;
  private modemManager: ModemManager;
  private config: ConfigService;
  private api: SMSHubAPI;
  private metricsInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private metrics: Map<string, ModemMetrics> = new Map();
  private systemMetrics: SystemMetrics = {
    cpu: 0,
    memory: 0,
    uptime: 0,
    activeModems: 0,
    messageRate: 0,
    errorRate: 0,
    avgResponseTime: 0
  };

  constructor(
    store: Store,
    modemManager: ModemManager,
    config: ConfigService,
    api: SMSHubAPI
  ) {
    super();
    this.logger = new Logger('HealthMonitor');
    this.store = store;
    this.modemManager = modemManager;
    this.config = config;
    this.api = api;
  }

  async initialize(): Promise<void> {
    try {
      await this.startMonitoring();
      this.setupEventListeners();
      this.logger.info('Health Monitor initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Health Monitor:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    // Listen for modem events
    this.modemManager.on('modem:connected', this.handleModemConnected.bind(this));
    this.modemManager.on('modem:disconnected', this.handleModemDisconnected.bind(this));
    this.modemManager.on('modem:error', this.handleModemError.bind(this));
    this.modemManager.on('message:sent', this.handleMessageSent.bind(this));
    this.modemManager.on('message:failed', this.handleMessageFailed.bind(this));
  }

  private async startMonitoring(): Promise<void> {
    // Collect metrics every minute
    const metricsInterval = this.config.get('monitoring.metricsInterval', 60000);
    this.metricsInterval = setInterval(
      () => this.collectMetrics(),
      metricsInterval
    );

    // Run health checks every 5 minutes
    const healthInterval = this.config.get('monitoring.healthInterval', 300000);
    this.healthCheckInterval = setInterval(
      () => this.runHealthChecks(),
      healthInterval
    );

    // Initial collection
    await this.collectMetrics();
    await this.runHealthChecks();
  }

  private async collectMetrics(): Promise<void> {
    try {
      // System metrics
      const cpuUsage = await this.getCPUUsage();
      const memoryUsage = this.getMemoryUsage();
      const uptime = process.uptime();

      // Modem metrics
      const modemStats = await this.getModemStats();
      const messageStats = await this.getMessageStats();

      // Update system metrics
      this.systemMetrics = {
        cpu: cpuUsage,
        memory: memoryUsage,
        uptime,
        activeModems: modemStats.activeCount,
        messageRate: messageStats.rate,
        errorRate: messageStats.errorRate,
        avgResponseTime: messageStats.avgResponseTime
      };

      // Save metrics to database
      await this.store.saveMetrics({
        timestamp: new Date(),
        type: 'system',
        metrics: this.systemMetrics
      });

      // Report to API
      await this.api.updateSystemStatus({
        metrics: this.systemMetrics,
        timestamp: new Date().toISOString()
      });

      this.emit('metrics:updated', this.systemMetrics);
    } catch (error) {
      this.logger.error('Failed to collect metrics:', error);
    }
  }

  private async getCPUUsage(): Promise<number> {
    const cpus = os.cpus();
    const totalCPU = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total);
    }, 0);
    return (totalCPU / cpus.length) * 100;
  }

  private getMemoryUsage(): number {
    const used = process.memoryUsage().heapUsed;
    const total = os.totalmem();
    return (used / total) * 100;
  }

  private async getModemStats(): Promise<{
    activeCount: number;
    totalCount: number;
    errorCount: number;
  }> {
    const modems = this.modemManager.getAllModems();
    const active = modems.filter(m => m.status === 'ready').length;
    const errors = modems.filter(m => m.status === 'error').length;

    return {
      activeCount: active,
      totalCount: modems.length,
      errorCount: errors
    };
  }

  private async getMessageStats(): Promise<{
    rate: number;
    errorRate: number;
    avgResponseTime: number;
  }> {
    const stats = await this.store.getMessageStats('1h');
    return {
      rate: stats.messageRate,
      errorRate: stats.errorRate,
      avgResponseTime: stats.avgResponseTime
    };
  }

  private async runHealthChecks(): Promise<void> {
    try {
      // Check system health
      const systemHealth = await this.checkSystemHealth();
      if (!systemHealth.healthy) {
        this.handleSystemIssue(systemHealth.issues);
      }

      // Check modem health
      const modemHealth = await this.checkModemHealth();
      for (const issue of modemHealth.issues) {
        this.handleModemIssue(issue);
      }

      // Check API health
      const apiHealth = await this.checkAPIHealth();
      if (!apiHealth.healthy) {
        this.handleAPIIssue(apiHealth.issues);
      }
    } catch (error) {
      this.logger.error('Failed to run health checks:', error);
    }
  }

  private async checkSystemHealth(): Promise<{
    healthy: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    const thresholds = {
      maxCPU: this.config.get('monitoring.maxCPU', 80),
      maxMemory: this.config.get('monitoring.maxMemory', 80),
      minActiveModems: this.config.get('monitoring.minActiveModems', 1)
    };

    if (this.systemMetrics.cpu > thresholds.maxCPU) {
      issues.push(`High CPU usage: ${this.systemMetrics.cpu.toFixed(1)}%`);
    }

    if (this.systemMetrics.memory > thresholds.maxMemory) {
      issues.push(`High memory usage: ${this.systemMetrics.memory.toFixed(1)}%`);
    }

    if (this.systemMetrics.activeModems < thresholds.minActiveModems) {
      issues.push(`Low active modem count: ${this.systemMetrics.activeModems}`);
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }

  private async checkModemHealth(): Promise<{
    healthy: boolean;
    issues: Array<{
      modemId: string;
      issue: string;
      severity: 'warning' | 'error';
    }>;
  }> {
    const issues: Array<{
      modemId: string;
      issue: string;
      severity: 'warning' | 'error';
    }> = [];

    const thresholds = {
      minSignal: this.config.get('monitoring.minSignalStrength', 10),
      maxErrors: this.config.get('monitoring.maxModemErrors', 5),
      maxOfflineTime: this.config.get('monitoring.maxOfflineTime', 300000)
    };

    for (const [modemId, metrics] of this.metrics) {
      if (metrics.signalStrength < thresholds.minSignal) {
        issues.push({
          modemId,
          issue: `Low signal strength: ${metrics.signalStrength}`,
          severity: 'warning'
        });
      }

      if (metrics.errorCount > thresholds.maxErrors) {
        issues.push({
          modemId,
          issue: `High error count: ${metrics.errorCount}`,
          severity: 'error'
        });
      }

      const offlineTime = Date.now() - metrics.lastSeen.getTime();
      if (offlineTime > thresholds.maxOfflineTime) {
        issues.push({
          modemId,
          issue: `Modem offline for ${Math.floor(offlineTime / 1000)}s`,
          severity: 'error'
        });
      }
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }

  private async checkAPIHealth(): Promise<{
    healthy: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      const apiStatus = await this.api.validateApiKey();
      if (!apiStatus) {
        issues.push('API authentication failed');
      }
    } catch (error) {
      issues.push(`API connection error: ${error.message}`);
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }

  private handleSystemIssue(issues: string[]): void {
    for (const issue of issues) {
      this.logger.warn('System health issue:', issue);
      this.emit('health:system:issue', { issue });
    }
  }

  private handleModemIssue(issue: {
    modemId: string;
    issue: string;
    severity: string;
  }): void {
    this.logger.warn(`Modem health issue (${issue.modemId}):`, issue.issue);
    this.emit('health:modem:issue', issue);
  }

  private handleAPIIssue(issues: string[]): void {
    for (const issue of issues) {
      this.logger.warn('API health issue:', issue);
      this.emit('health:api:issue', { issue });
    }
  }

  // Event handlers
  private handleModemConnected(modemId: string): void {
    this.metrics.set(modemId, {
      id: modemId,
      signalStrength: 0,
      errorCount: 0,
      lastSeen: new Date(),
      status: 'connected',
      messageSuccess: 0,
      messageFailure: 0,
      responseTime: []
    });
  }

  private handleModemDisconnected(modemId: string): void {
    this.metrics.delete(modemId);
  }

  private handleModemError(data: { modemId: string; error: Error }): void {
    const metrics = this.metrics.get(data.modemId);
    if (metrics) {
      metrics.errorCount++;
      metrics.status = 'error';
      this.metrics.set(data.modemId, metrics);
    }
  }

  private handleMessageSent(data: {
    modemId: string;
    responseTime: number;
  }): void {
    const metrics = this.metrics.get(data.modemId);
    if (metrics) {
      metrics.messageSuccess++;
      metrics.responseTime.push(data.responseTime);
      metrics.lastSeen = new Date();
      this.metrics.set(data.modemId, metrics);
    }
  }

  private handleMessageFailed(data: { modemId: string }): void {
    const metrics = this.metrics.get(data.modemId);
    if (metrics) {
      metrics.messageFailure++;
      metrics.lastSeen = new Date();
      this.metrics.set(data.modemId, metrics);
    }
  }

  // Public API
  getSystemMetrics(): SystemMetrics {
    return { ...this.systemMetrics };
  }

  getModemMetrics(modemId: string): ModemMetrics | undefined {
    const metrics = this.metrics.get(modemId);
    return metrics ? { ...metrics } : undefined;
  }

  getAllModemMetrics(): ModemMetrics[] {
    return Array.from(this.metrics.values()).map(m => ({ ...m }));
  }

  shutdown(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
} 