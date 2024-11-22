# SMSHub Desktop

A desktop application for managing multiple USB modems for SMS processing with plugin support.

## System Requirements

- Node.js 16.x or later
- Python 2.7 (for node-gyp)
- Build tools:
  - Windows: Visual Studio Build Tools
  - Linux: build-essential, libudev-dev
  - macOS: Xcode Command Line Tools

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/smshub-desktop.git
cd smshub-desktop
```

2. Install dependencies:
```bash
npm install
```

3. Build native dependencies:
```bash
npm run rebuild
```

4. Create configuration:
```bash
npm run setup
```

## Development

Start the application in development mode:
```bash
npm run dev
```

## Building

Build the application for your platform:
```bash
npm run build
```

The built application will be in the `dist` directory.

## Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- tests/unit/services/ModemManager.test.ts

# Run tests with coverage
npm run test:coverage
```

## Plugin Development

See the [Plugin Development Guide](docs/plugin-development.md) for information on creating plugins.

## Configuration

Configuration file is stored in:
- Windows: `%APPDATA%/smshub/config.json`
- macOS: `~/Library/Application Support/smshub/config.json`
- Linux: `~/.config/smshub/config.json`

## Troubleshooting

### USB Device Access

#### Linux
Create a udev rule to allow USB access:

```bash
sudo nano /etc/udev/rules.d/99-smshub.rules
```

Add:
```
SUBSYSTEM=="usb", ATTRS{idVendor}=="1199", MODE="0666"
SUBSYSTEM=="usb", ATTRS{idVendor}=="2c7c", MODE="0666"
SUBSYSTEM=="usb", ATTRS{idVendor}=="2cb7", MODE="0666"
```

Reload rules:
```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

#### Windows
Install the required USB drivers for your modems.

## License

MIT 