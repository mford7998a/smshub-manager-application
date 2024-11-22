# SMSHub Plugin Development Kit

This guide will help you create plugins for the SMSHub application to support new modem devices.

## Getting Started

1. Create a new directory for your plugin:
```bash
mkdir my-modem-plugin
cd my-modem-plugin
```

2. Copy the template files:
```bash
cp /path/to/smshub/sdk/PluginTemplate.ts index.ts
cp /path/to/smshub/sdk/manifest.template.json manifest.json
cp /path/to/smshub/sdk/PluginTest.template.ts test/index.test.ts
```

3. Update the manifest.json with your plugin information:
```json
{
  "name": "my-modem-plugin",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "Support for My Custom Modem",
  "main": "index.js",
  "supportedModems": [
    {
      "vendor": "Vendor Name",
      "models": ["Model1", "Model2"]
    }
  ]
}
```

## Plugin Structure

```
my-modem-plugin/
├── manifest.json        # Plugin metadata and configuration
├── index.ts            # Main plugin implementation
├── README.md           # Plugin documentation
└── test/              
    └── index.test.ts   # Plugin tests
```

## Implementing Your Plugin

1. Extend the BaseModemPlugin class:
```typescript
import { BaseModemPlugin } from '@smshub/core';

class MyModemPlugin extends BaseModemPlugin {
  // Implement required methods
}
```

2. Required Methods:
- `initialize(device: USBDevice): Promise<void>`
- `sendSMS(number: string, message: string): Promise<boolean>`
- `readSMS(): Promise<any[]>`
- `getSignalStrength(): Promise<number>`
- `getNetworkInfo(): Promise<{operator: string; technology: string;}>`
- `reset(): Promise<void>`
- `getStatus(): Promise<{connected: boolean; signalStrength: number;}>`

3. Optional Methods:
- `enable(): Promise<void>`
- `disable(): Promise<void>`
- `configure(settings: Record<string, any>): Promise<void>`

## AT Commands

The plugin has access to the ATCommandProcessor through `this.atProcessor`:

```typescript
async initialize(device: USBDevice): Promise<void> {
  try {
    await this.atProcessor.sendCommand(device, 'ATZ');
    await this.atProcessor.sendCommand(device, 'ATE0');
    await this.atProcessor.sendCommand(device, 'AT+CMGF=1');
  } catch (error) {
    this.logger.error('Failed to initialize:', error);
    throw error;
  }
}
```

## Error Handling

Use the provided logger and error handling utilities:

```typescript
try {
  // Your code
} catch (error) {
  this.logger.error('Operation failed:', error);
  throw error;
}
```

## Testing

1. Run tests:
```bash
npm test
```

2. Test coverage:
```bash
npm run test:coverage
```

## Building

1. Build your plugin:
```bash
npm run build
```

2. Package for distribution:
```bash
npm run package
```

## Plugin Capabilities

Define your plugin's capabilities in manifest.json:

```json
{
  "capabilities": {
    "ussd": false,
    "customCommands": false,
    "networkSelection": false,
    "signalMonitoring": true,
    "autoFlash": false
  }
}
```

## Configuration Schema

Define configuration options in manifest.json:

```json
{
  "configSchema": {
    "type": "object",
    "properties": {
      "commandTimeout": {
        "type": "number",
        "default": 10000,
        "description": "AT command timeout in milliseconds"
      }
    }
  }
}
```

## Best Practices

1. Error Handling
- Always use try/catch blocks
- Log errors with appropriate levels
- Provide meaningful error messages
- Handle timeouts and retries

2. Resource Management
- Clean up resources in disable()
- Handle device disconnections
- Implement proper initialization checks

3. Testing
- Test all AT commands
- Test error conditions
- Test edge cases
- Mock hardware responses

4. Documentation
- Document AT commands used
- Document known limitations
- Provide troubleshooting guides
- Include example configurations

## Publishing

1. Test your plugin thoroughly
2. Update version number
3. Build and package
4. Submit to SMSHub plugin repository

## Support

- GitHub Issues: [link]
- Documentation: [link]
- Community Forum: [link] 