#!/bin/bash

# Exit on error
set -e

echo "Setting up development environment..."

# Install system dependencies
if [ "$(uname)" == "Darwin" ]; then
    # macOS
    brew install libusb
elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
    # Linux
    sudo apt-get update
    sudo apt-get install -y \
        libusb-1.0-0 \
        udev \
        policykit-1 \
        curl \
        qmi-utils
fi

# Create udev rules for USB modems (Linux only)
if [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
    echo "Setting up udev rules..."
    sudo tee /etc/udev/rules.d/99-smshub.rules << EOL
# Sierra Wireless
SUBSYSTEM=="usb", ATTRS{idVendor}=="1199", MODE="0666"
# Quectel
SUBSYSTEM=="usb", ATTRS{idVendor}=="2c7c", MODE="0666"
# Fibocom
SUBSYSTEM=="usb", ATTRS{idVendor}=="2cb7", MODE="0666"
# Franklin
SUBSYSTEM=="usb", ATTRS{idVendor}=="1508", MODE="0666"
# ZTE
SUBSYSTEM=="usb", ATTRS{idVendor}=="19d2", MODE="0666"
# Huawei
SUBSYSTEM=="usb", ATTRS{idVendor}=="12d1", MODE="0666"
# Ericsson
SUBSYSTEM=="usb", ATTRS{idVendor}=="0bdb", MODE="0666"
# Qualcomm
SUBSYSTEM=="usb", ATTRS{idVendor}=="1e0e", MODE="0666"
EOL

    sudo udevadm control --reload-rules
    sudo udevadm trigger
fi

# Install Node.js dependencies
npm install

# Build development version
npm run build

echo "Development environment setup complete!"
echo "Run 'docker-compose up' to start the development server" 