import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { Store } from '../database/Store';
import { ConfigService } from './ConfigService';
import * as WebSocket from 'ws';
import { encrypt, decrypt } from '../utils/encryption';

interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
}

export class WebSocketService extends EventEmitter {
  private logger: Logger;
  private store: Store;
  private config: ConfigService;
  private server?: WebSocket.Server;
  private clients: Map<string, WebSocket> = new Map();
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(store: Store, config: ConfigService) {
    super();
    this.logger = new Logger('WebSocketService');
    this.store = store;
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      const port = this.config.get('websocket.port', 8080);
      
      this.server = new WebSocket.Server({ port });
      this.setupServerHandlers();
      this.startHeartbeat();

      this.logger.info(`WebSocket server started on port ${port}`);
    } catch (error) {
      this.logger.error('Failed to initialize WebSocket service:', error);
      throw error;
    }
  }

  private setupServerHandlers(): void {
    if (!this.server) return;

    this.server.on('connection', (ws: WebSocket, req: any) => {
      this.handleConnection(ws, req);
    });

    this.server.on('error', (error: Error) => {
      this.logger.error('WebSocket server error:', error);
    });
  }

  private handleConnection(ws: WebSocket, req: any): void {
    const clientId = this.generateClientId(req);
    this.clients.set(clientId, ws);

    this.logger.info(`Client connected: ${clientId}`);

    ws.on('message', async (data: WebSocket.Data) => {
      try {
        await this.handleMessage(clientId, data);
      } catch (error) {
        this.logger.error(`Error handling message from ${clientId}:`, error);
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    ws.on('error', (error: Error) => {
      this.logger.error(`WebSocket error for client ${clientId}:`, error);
    });

    // Send initial state
    this.sendInitialState(clientId);
  }

  private generateClientId(req: any): string {
    const ip = req.socket.remoteAddress;
    const timestamp = Date.now();
    return `${ip}-${timestamp}`;
  }

  private async handleMessage(clientId: string, data: WebSocket.Data): Promise<void> {
    const ws = this.clients.get(clientId);
    if (!ws) return;

    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      
      // Validate message format
      if (!this.validateMessage(message)) {
        throw new Error('Invalid message format');
      }

      // Handle different message types
      switch (message.type) {
        case 'subscribe':
          await this.handleSubscribe(clientId, message.payload);
          break;
        case 'unsubscribe':
          await this.handleUnsubscribe(clientId, message.payload);
          break;
        case 'ping':
          this.handlePing(clientId);
          break;
        default:
          this.logger.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.logger.error('Failed to handle WebSocket message:', error);
      this.sendError(clientId, 'Invalid message format');
    }
  }

  private validateMessage(message: any): message is WebSocketMessage {
    return (
      message &&
      typeof message.type === 'string' &&
      message.payload !== undefined &&
      typeof message.timestamp === 'string'
    );
  }

  private async handleSubscribe(clientId: string, topics: string[]): Promise<void> {
    // Store client subscriptions
    // Implementation depends on subscription management requirements
  }

  private async handleUnsubscribe(clientId: string, topics: string[]): Promise<void> {
    // Remove client subscriptions
    // Implementation depends on subscription management requirements
  }

  private handlePing(clientId: string): void {
    this.sendMessage(clientId, {
      type: 'pong',
      payload: { timestamp: Date.now() },
      timestamp: new Date().toISOString()
    });
  }

  private handleDisconnection(clientId: string): void {
    this.clients.delete(clientId);
    this.logger.info(`Client disconnected: ${clientId}`);
  }

  private async sendInitialState(clientId: string): Promise<void> {
    // Send current system state to new client
    const state = {
      modems: await this.store.getModems(),
      messages: await this.store.getMessages({ limit: 100 }),
      stats: await this.store.getStats()
    };

    this.sendMessage(clientId, {
      type: 'initial_state',
      payload: state,
      timestamp: new Date().toISOString()
    });
  }

  private startHeartbeat(): void {
    const interval = this.config.get('websocket.heartbeatInterval', 30000);
    
    this.heartbeatInterval = setInterval(() => {
      this.broadcast({
        type: 'heartbeat',
        payload: { timestamp: Date.now() },
        timestamp: new Date().toISOString()
      });
    }, interval);
  }

  // Public API methods
  broadcast(message: WebSocketMessage): void {
    const payload = JSON.stringify(message);
    
    for (const [clientId, ws] of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      } else {
        this.clients.delete(clientId);
      }
    }
  }

  sendMessage(clientId: string, message: WebSocketMessage): void {
    const ws = this.clients.get(clientId);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  sendError(clientId: string, error: string): void {
    this.sendMessage(clientId, {
      type: 'error',
      payload: { message: error },
      timestamp: new Date().toISOString()
    });
  }

  notifyModemUpdate(modemId: string, data: any): void {
    this.broadcast({
      type: 'modem:update',
      payload: { modemId, ...data },
      timestamp: new Date().toISOString()
    });
  }

  notifyMessageReceived(message: any): void {
    this.broadcast({
      type: 'message:received',
      payload: message,
      timestamp: new Date().toISOString()
    });
  }

  notifyError(error: any): void {
    this.broadcast({
      type: 'system:error',
      payload: error,
      timestamp: new Date().toISOString()
    });
  }

  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all client connections
    for (const [clientId, ws] of this.clients) {
      try {
        ws.close();
      } catch (error) {
        this.logger.error(`Error closing connection for client ${clientId}:`, error);
      }
    }

    // Close server
    this.server?.close((error) => {
      if (error) {
        this.logger.error('Error closing WebSocket server:', error);
      }
    });
  }
} 