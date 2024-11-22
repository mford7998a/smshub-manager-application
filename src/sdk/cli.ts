#!/usr/bin/env node

import * as commander from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import { Logger } from '../utils/logger';
import { createPluginTemplate } from './templates/PluginGenerator';

const logger = new Logger('Plugin SDK CLI');

const program = new commander.Command();

program
  .name('smshub-plugin')
  .description('SMSHub Plugin Development Kit CLI')
  .version('1.0.0');

program
  .command('create <name>')
  .description('Create a new plugin project')
  .option('-t, --template <type>', 'Plugin template type (modem/extension)', 'modem')
  .option('-d, --directory <path>', 'Target directory', '.')
  .action(async (name: string, options: any) => {
    try {
      const targetDir = path.join(options.directory, name);
      await createPluginTemplate(name, targetDir, options.template);
      logger.info(`Plugin project created at: ${targetDir}`);
    } catch (error) {
      logger.error('Failed to create plugin:', error);
      process.exit(1);
    }
  });

program
  .command('validate <path>')
  .description('Validate plugin project')
  .action(async (pluginPath: string) => {
    try {
      // TODO: Implement plugin validation
      logger.info('Plugin validation successful');
    } catch (error) {
      logger.error('Plugin validation failed:', error);
      process.exit(1);
    }
  });

program
  .command('build <path>')
  .description('Build plugin package')
  .option('-o, --output <path>', 'Output directory', './dist')
  .action(async (pluginPath: string, options: any) => {
    try {
      // TODO: Implement plugin build
      logger.info('Plugin built successfully');
    } catch (error) {
      logger.error('Plugin build failed:', error);
      process.exit(1);
    }
  });

program.parse(); 