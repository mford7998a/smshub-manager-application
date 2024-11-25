# Base image
FROM node:18-bullseye

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libusb-1.0-0 \
    udev \
    policykit-1 \
    curl \
    qmi-utils \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm ci

# Copy app source
COPY . .

# Build app
RUN npm run build

# Expose ports
EXPOSE 3000

# Start development server
CMD ["npm", "run", "dev"] 