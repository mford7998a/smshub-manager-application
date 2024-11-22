import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { Store } from '../database/Store';
import { ConfigService } from './ConfigService';
import { SMSHubAPI } from '../api/SMSHubAPI';
import { encrypt, decrypt } from '../utils/encryption';
import { createHash } from 'crypto';

interface AuthSession {
  userId: string;
  token: string;
  expiresAt: Date;
  permissions: string[];
}

interface AuthCredentials {
  username: string;
  password: string;
}

export class AuthService extends EventEmitter {
  private logger: Logger;
  private store: Store;
  private config: ConfigService;
  private api: SMSHubAPI;
  private currentSession: AuthSession | null = null;
  private sessionCheckInterval?: NodeJS.Timeout;

  constructor(store: Store, config: ConfigService, api: SMSHubAPI) {
    super();
    this.logger = new Logger('AuthService');
    this.store = store;
    this.config = config;
    this.api = api;
  }

  async initialize(): Promise<void> {
    try {
      // Restore session if exists
      await this.restoreSession();
      
      // Start session monitoring
      this.startSessionCheck();
      
      this.logger.info('Auth Service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Auth Service:', error);
      throw error;
    }
  }

  private async restoreSession(): Promise<void> {
    try {
      const encryptedSession = await this.store.get('auth.session');
      if (!encryptedSession) return;

      const sessionData = await decrypt(
        encryptedSession,
        this.config.get('security.encryptionKey')
      );

      const session = JSON.parse(sessionData) as AuthSession;
      if (new Date(session.expiresAt) > new Date()) {
        this.currentSession = session;
        this.emit('auth:restored', { userId: session.userId });
      }
    } catch (error) {
      this.logger.error('Failed to restore session:', error);
    }
  }

  private startSessionCheck(): void {
    const interval = this.config.get('security.sessionCheckInterval', 60000);
    
    this.sessionCheckInterval = setInterval(() => {
      if (this.currentSession) {
        const expiresAt = new Date(this.currentSession.expiresAt);
        if (expiresAt <= new Date()) {
          this.logout();
        }
      }
    }, interval);
  }

  async login(credentials: AuthCredentials): Promise<void> {
    try {
      // Validate credentials
      if (!this.validateCredentials(credentials)) {
        throw new Error('Invalid credentials format');
      }

      // Authenticate with API
      const response = await this.api.authenticate(credentials);

      // Create session
      this.currentSession = {
        userId: response.userId,
        token: response.token,
        expiresAt: new Date(response.expiresAt),
        permissions: response.permissions
      };

      // Save encrypted session
      await this.saveSession();

      // Update API client with new token
      this.api.updateApiKey(response.token);

      this.emit('auth:login', { userId: response.userId });
      this.logger.info(`User logged in: ${response.userId}`);
    } catch (error) {
      this.logger.error('Login failed:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.currentSession) {
        await this.api.logout(this.currentSession.token);
        await this.store.delete('auth.session');
        
        this.currentSession = null;
        this.emit('auth:logout');
        
        this.logger.info('User logged out');
      }
    } catch (error) {
      this.logger.error('Logout failed:', error);
      throw error;
    }
  }

  private async saveSession(): Promise<void> {
    if (!this.currentSession) return;

    const encrypted = await encrypt(
      JSON.stringify(this.currentSession),
      this.config.get('security.encryptionKey')
    );

    await this.store.set('auth.session', encrypted);
  }

  private validateCredentials(credentials: AuthCredentials): boolean {
    return (
      typeof credentials.username === 'string' &&
      credentials.username.length > 0 &&
      typeof credentials.password === 'string' &&
      credentials.password.length >= 8
    );
  }

  isAuthenticated(): boolean {
    return (
      this.currentSession !== null &&
      new Date(this.currentSession.expiresAt) > new Date()
    );
  }

  hasPermission(permission: string): boolean {
    return (
      this.currentSession?.permissions.includes(permission) || 
      this.currentSession?.permissions.includes('admin') ||
      false
    );
  }

  getCurrentUser(): string | null {
    return this.currentSession?.userId || null;
  }

  getToken(): string | null {
    return this.currentSession?.token || null;
  }

  shutdown(): void {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
    }
  }
} 
} 