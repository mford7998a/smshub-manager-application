#!/bin/bash

# Exit on error
set -e

VERSION=$1
APP_DIR="/opt/smshub"
BACKUP_DIR="/opt/smshub/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "Deploying version: $VERSION"

# Create backup
echo "Creating backup..."
mkdir -p $BACKUP_DIR
tar -czf "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" -C $APP_DIR . --exclude="./backups"

# Download new release
echo "Downloading release..."
curl -L -o smshub.deb "https://github.com/yourusername/smshub-desktop/releases/download/$VERSION/smshub-desktop_${VERSION#v}_amd64.deb"

# Stop service
echo "Stopping service..."
systemctl stop smshub-manager

# Install new version
echo "Installing new version..."
dpkg -i smshub.deb

# Update configuration
echo "Updating configuration..."
cp $APP_DIR/config.json.new $APP_DIR/config.json

# Start service
echo "Starting service..."
systemctl start smshub-manager

# Verify deployment
echo "Verifying deployment..."
if systemctl is-active --quiet smshub-manager; then
  echo "Deployment successful!"
  
  # Clean up old backups (keep last 5)
  cd $BACKUP_DIR
  ls -t | tail -n +6 | xargs -r rm
  
  # Clean up downloaded package
  rm smshub.deb
else
  echo "Deployment failed!"
  echo "Rolling back..."
  
  # Restore from backup
  cd $APP_DIR
  tar -xzf "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz"
  
  systemctl start smshub-manager
  exit 1
fi 