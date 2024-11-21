import { WebSocket, Server as WebSocketServer } from 'ws';
import { Server } from 'http';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export class WebSocketService extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(server: Server) {
    super();
    this.wss = new WebSocketServer({ server });
    this.initialize();
  }

  private initialize(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      logger.info('WebSocket client connected');

      ws.on('message', this.handleMessage.bind(this));
      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info('WebSocket client disconnected');
      });
      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
      });

      // Send initial state
      this.sendToClient(ws, 'init', {
        timestamp: new Date(),
        type: 'init'
      });
    });
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      this.emit('message', message);
    } catch (error) {
      logger.error('Failed to parse WebSocket message:', error);
    }
  }

  broadcast(type: string, data: any): void {
    const message = JSON.stringify({
      type,
      data,
      timestamp: new Date()
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private sendToClient(client: WebSocket, type: string, data: any): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type,
        data,
        timestamp: new Date()
      }));
    }
  }

  broadcastModemUpdate(modemId: string, data: any): void {
    this.broadcast('modem:update', {
      modemId,
      ...data
    });
  }

  broadcastMessageUpdate(messageId: number, data: any): void {
    this.broadcast('message:update', {
      messageId,
      ...data
    });
  }

  broadcastSystemStatus(status: any): void {
    this.broadcast('system:status', status);
  }

  broadcastError(error: Error): void {
    this.broadcast('error', {
      message: error.message,
      stack: error.stack
    });
  }

  stop(): void {
    this.wss.close(() => {
      logger.info('WebSocket server stopped');
    });
  }
} 