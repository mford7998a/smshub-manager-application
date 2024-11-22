import { ConfigService } from '../src/services/ConfigService';
import { Store } from '../src/database/Store';
import * as path from 'path';
import * as fs from 'fs-extra';
import { app } from 'electron';

async function setup() {
  console.log('Setting up SMSHub Desktop...');

  // Ensure directories exist
  const userDataPath = app.getPath('userData');
  const dirs = [
    path.join(userDataPath, 'plugins'),
    path.join(userDataPath, 'logs'),
    path.join(userDataPath, 'db')
  ];

  for (const dir of dirs) {
    await fs.ensureDir(dir);
    console.log(`Created directory: ${dir}`);
  }

  // Initialize database
  const store = new Store();
  await store.initialize();
  console.log('Database initialized');

  // Create initial config
  const config = new ConfigService(store);
  await config.initialize();
  console.log('Configuration initialized');

  console.log('Setup complete! You can now run the application.');
}

setup().catch(console.error); 