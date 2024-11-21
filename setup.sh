#!/bin/bash

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root"
  exit 1
fi

# Install dependencies
echo "Installing system dependencies..."
apt-get update
apt-get install -y \
  libusb-1.0-0 \
  udev \
  policykit-1 \
  curl \
  qmi-utils

# Create udev rules for USB modems
echo "Setting up udev rules..."
cat > /etc/udev/rules.d/99-smshub.rules << EOL
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

# Reload udev rules
udevadm control --reload-rules
udevadm trigger

# Install service
echo "Installing system service..."
cp build/linux/smshub-manager.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable smshub-manager
systemctl start smshub-manager

# Create log directory
mkdir -p /var/log/smshub
chown -R $SUDO_USER:$SUDO_USER /var/log/smshub

echo "Installation complete!"
echo "SMSHub Manager is now running as a system service"
echo "Check status with: systemctl status smshub-manager" 