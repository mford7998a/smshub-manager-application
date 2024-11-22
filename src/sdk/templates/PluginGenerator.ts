import * as fs from 'fs-extra';
import * as path from 'path';
import { Logger } from '../../utils/logger';

const logger = new Logger('Plugin Generator');

export async function createPluginTemplate(
  name: string,
  targetDir: string,
  type: string
): Promise<void> {
  // Create project directory
  await fs.ensureDir(targetDir);

  // Create project structure
  const structure = [
    'src',
    'tests',
    'docs',
    'config'
  ];

  for (const dir of structure) {
    await fs.ensureDir(path.join(targetDir, dir));
  }

  // Generate package.json
  const packageJson = {
    name: `smshub-plugin-${name}`,
    version: '1.0.0',
    description: `SMSHub plugin for ${name}`,
    main: 'dist/index.js',
    scripts: {
      build: 'tsc',
      test: 'jest',
      validate: 'smshub-plugin validate .',
      package: 'smshub-plugin build .'
    },
    dependencies: {
      '@types/node': '^16.0.0',
      'typescript': '^4.5.0',
      'jest': '^27.0.0',
      '@types/jest': '^27.0.0'
    }
  };

  await fs.writeJson(
    path.join(targetDir, 'package.json'),
    packageJson,
    { spaces: 2 }
  );

  // Generate manifest.json
  const manifest = {
    name,
    version: '1.0.0',
    author: '',
    description: '',
    main: 'dist/index.js',
    supportedModems: [],
    dependencies: [],
    minAppVersion: '1.0.0',
    configSchema: {
      type: 'object',
      properties: {}
    },
    capabilities: {
      ussd: false,
      customCommands: false,
      networkSelection: false,
      signalMonitoring: true,
      autoFlash: false
    }
  };

  await fs.writeJson(
    path.join(targetDir, 'manifest.json'),
    manifest,
    { spaces: 2 }
  );

  // Generate TypeScript config
  const tsConfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      declaration: true,
      outDir: './dist',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true
    },
    include: ['src'],
    exclude: ['node_modules', 'tests']
  };

  await fs.writeJson(
    path.join(targetDir, 'tsconfig.json'),
    tsConfig,
    { spaces: 2 }
  );

  // Generate plugin source code
  await generatePluginSource(targetDir, type);

  // Generate test files
  await generateTestFiles(targetDir, type);

  // Generate documentation
  await generateDocs(targetDir);

  logger.info('Plugin template created successfully');
}

async function generatePluginSource(targetDir: string, type: string): Promise<void> {
  const sourceCode = type === 'modem' ? getModemPluginTemplate() : getExtensionPluginTemplate();
  await fs.writeFile(path.join(targetDir, 'src/index.ts'), sourceCode);
}

function getModemPluginTemplate(): string {
  return `
import { BaseModemPlugin } from 'smshub-sdk';
import { Device as USBDevice } from 'usb';

export class CustomModemPlugin extends BaseModemPlugin {
  private initialized: boolean = false;

  async initialize(device: USBDevice): Promise<void> {
    // TODO: Implement modem initialization
  }

  async sendSMS(number: string, message: string): Promise<boolean> {
    // TODO: Implement SMS sending
    return false;
  }

  async readSMS(): Promise<any[]> {
    // TODO: Implement SMS reading
    return [];
  }

  async getSignalStrength(): Promise<number> {
    // TODO: Implement signal strength reading
    return 0;
  }

  async getNetworkInfo(): Promise<{
    operator: string;
    technology: string;
  }> {
    // TODO: Implement network info reading
    return {
      operator: '',
      technology: ''
    };
  }

  async reset(): Promise<void> {
    // TODO: Implement modem reset
  }

  async getStatus(): Promise<{
    connected: boolean;
    signalStrength: number;
    operator?: string;
    technology?: string;
    error?: string;
  }> {
    // TODO: Implement status reading
    return {
      connected: false,
      signalStrength: 0
    };
  }
}
`;
}

function getExtensionPluginTemplate(): string {
  return `
import { BasePlugin } from 'smshub-sdk';

export class CustomExtensionPlugin extends BasePlugin {
  async initialize(): Promise<void> {
    // TODO: Implement initialization
  }

  async enable(): Promise<void> {
    // TODO: Implement enable logic
  }

  async disable(): Promise<void> {
    // TODO: Implement disable logic
  }
}
`;
}

async function generateTestFiles(targetDir: string, type: string): Promise<void> {
  const testCode = `
import { CustomModemPlugin } from '../src';

describe('CustomModemPlugin', () => {
  let plugin: CustomModemPlugin;

  beforeEach(() => {
    plugin = new CustomModemPlugin();
  });

  it('should initialize successfully', async () => {
    // TODO: Add test implementation
  });

  // Add more tests...
});
`;

  await fs.writeFile(path.join(targetDir, 'tests/index.test.ts'), testCode);
}

async function generateDocs(targetDir: string): Promise<void> {
  const readme = `
# SMSHub Plugin

## Description

Add your plugin description here.

## Installation

\`\`\`bash
npm install
\`\`\`

## Development

1. Build the plugin:
   \`\`\`bash
   npm run build
   \`\`\`

2. Run tests:
   \`\`\`bash
   npm test
   \`\`\`

3. Validate the plugin:
   \`\`\`bash
   npm run validate
   \`\`\`

## Configuration

Add configuration instructions here.

## API Reference

Document your plugin's API here.
`;

  await fs.writeFile(path.join(targetDir, 'README.md'), readme);
} 