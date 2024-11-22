import * as esbuild from 'esbuild';
import * as path from 'path';
import * as fs from 'fs-extra';
import { execSync } from 'child_process';

async function build() {
  // Clean dist directory
  await fs.remove('dist');
  await fs.ensureDir('dist');

  // Build main process
  await esbuild.build({
    entryPoints: ['src/main/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node16',
    outfile: 'dist/main.js',
    external: ['electron', 'better-sqlite3', 'usb'],
    minify: true,
    sourcemap: true
  });

  // Build preload scripts
  await esbuild.build({
    entryPoints: ['src/preload/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node16',
    outfile: 'dist/preload.js',
    external: ['electron'],
    minify: true,
    sourcemap: true
  });

  // Build renderer process
  await esbuild.build({
    entryPoints: ['src/ui/index.ts'],
    bundle: true,
    platform: 'browser',
    target: 'es2020',
    outfile: 'dist/renderer.js',
    minify: true,
    sourcemap: true
  });

  // Copy static assets
  await fs.copy('src/ui/index.html', 'dist/index.html');
  await fs.copy('src/assets', 'dist/assets');

  // Create package.json for distribution
  const pkg = await fs.readJson('package.json');
  const distPkg = {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    author: pkg.author,
    main: 'main.js',
    dependencies: {
      'better-sqlite3': pkg.dependencies['better-sqlite3'],
      'usb': pkg.dependencies['usb']
    }
  };
  await fs.writeJson('dist/package.json', distPkg, { spaces: 2 });

  console.log('Build completed successfully');
}

build().catch(console.error); 