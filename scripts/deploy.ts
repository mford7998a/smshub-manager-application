import * as builder from 'electron-builder';
import * as path from 'path';
import * as fs from 'fs-extra';
import { execSync } from 'child_process';

async function deploy() {
  // Ensure build is fresh
  await build();

  // Configure electron-builder
  const config: builder.Configuration = {
    appId: 'org.smshub.desktop',
    productName: 'SMSHub',
    copyright: `Copyright © ${new Date().getFullYear()}`,
    
    directories: {
      output: 'release',
      buildResources: 'build'
    },

    files: [
      'dist/**/*',
      'package.json'
    ],

    extraResources: [
      {
        from: 'plugins',
        to: 'plugins',
        filter: ['**/*']
      }
    ],

    win: {
      target: ['nsis', 'portable'],
      icon: 'build/icon.ico',
      publisherName: 'SMSHub'
    },

    mac: {
      target: ['dmg', 'zip'],
      icon: 'build/icon.icns',
      category: 'public.app-category.utilities'
    },

    linux: {
      target: ['AppImage', 'deb'],
      icon: 'build/icon.png',
      category: 'Utility'
    },

    nsis: {
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: 'SMSHub'
    },

    publish: {
      provider: 's3',
      bucket: 'smshub-releases',
      region: 'us-east-1',
      path: '/${os}/${arch}/${version}'
    }
  };

  // Build installers
  await builder.build({
    config,
    targets: builder.Platform.current().createTarget()
  });

  console.log('Deployment build completed successfully');
}

deploy().catch(console.error); 