import { SerialPort } from 'serialport';
import { EventEmitter } from 'events';

// Mock SerialPort
jest.mock('serialport', () => {
  class MockSerialPort extends EventEmitter {
    path: string;
    baudRate: number;
    isOpen: boolean = false;

    constructor(options: any) {
      super();
      this.path = options.path;
      this.baudRate = options.baudRate;
    }

    open(callback?: (error?: Error) => void): void {
      this.isOpen = true;
      callback && callback();
    }

    write(data: string, callback?: (error?: Error) => void): void {
      // Simulate successful AT command responses
      if (data.includes('AT')) {
        setTimeout(() => {
          this.emit('data', Buffer.from('OK\r\n'));
        }, 10);
      }
      callback && callback();
    }

    close(callback?: (error?: Error) => void): void {
      this.isOpen = false;
      callback && callback();
    }
  }

  return { SerialPort: MockSerialPort };
});

// Mock better-sqlite3
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => ({
    pragma: jest.fn(),
    prepare: jest.fn().mockReturnValue({
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
      finalize: jest.fn()
    }),
    exec: jest.fn(),
    close: jest.fn()
  }));
});

// Mock electron
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/mock/path'),
    on: jest.fn(),
    quit: jest.fn()
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    on: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    close: jest.fn(),
    webContents: {
      send: jest.fn()
    }
  }))
}));

// Global test timeout
jest.setTimeout(10000); 