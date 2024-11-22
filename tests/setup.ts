import { ConfigService } from '../src/services/ConfigService';
import { Store } from '../src/database/Store';
import { Logger } from '../src/utils/logger';
import * as path from 'path';
import * as fs from 'fs-extra';

// Setup test environment
process.env.NODE_ENV = 'test';

// Create test database path
const testDbPath = path.join(__dirname, 'test.db');

// Create test config
const testConfig = {
  system: {
    autoStart: false,
    minimizeToTray: false,
    theme: 'light',
    language: 'en'
  },
  security: {
    encryptionKey: 'test-key-123',
    encryptMessages: true,
    encryptLogs: false
  },
  logging: {
    level: 'error',
    maxFiles: 1,
    maxSize: 1048576
  }
};

// Setup/teardown helpers
export async function setupTestEnvironment(): Promise<{
  store: Store;
  config: ConfigService;
}> {
  // Ensure clean state
  await fs.remove(testDbPath);

  // Initialize test store
  const store = new Store(testDbPath);
  await store.initialize();

  // Initialize test config
  const config = new ConfigService(store);
  await config.initialize();
  await config.update(testConfig);

  // Initialize logger
  Logger.initialize(config);

  return { store, config };
}

export async function teardownTestEnvironment(): Promise<void> {
  await fs.remove(testDbPath);
} 