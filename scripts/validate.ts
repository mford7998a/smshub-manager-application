import * as path from 'path';
import * as fs from 'fs-extra';
import { execSync } from 'child_process';

async function validate() {
  console.log('Running pre-deployment validation...');

  // Run tests
  console.log('Running tests...');
  execSync('npm run test', { stdio: 'inherit' });

  // Type checking
  console.log('Running type check...');
  execSync('tsc --noEmit', { stdio: 'inherit' });

  // Lint check
  console.log('Running lint check...');
  execSync('eslint src/**/*.{ts,vue}', { stdio: 'inherit' });

  // Check dependencies
  console.log('Checking dependencies...');
  execSync('npm audit', { stdio: 'inherit' });

  // Validate plugins
  console.log('Validating plugins...');
  const pluginsDir = path.join(__dirname, '../plugins');
  const plugins = await fs.readdir(pluginsDir);

  for (const plugin of plugins) {
    const manifestPath = path.join(pluginsDir, plugin, 'manifest.json');
    if (await fs.pathExists(manifestPath)) {
      const manifest = await fs.readJson(manifestPath);
      validatePluginManifest(manifest);
    }
  }

  console.log('Validation completed successfully');
}

function validatePluginManifest(manifest: any) {
  const required = ['name', 'version', 'main', 'supportedModems'];
  for (const field of required) {
    if (!manifest[field]) {
      throw new Error(`Plugin manifest missing required field: ${field}`);
    }
  }
}

validate().catch(console.error); 