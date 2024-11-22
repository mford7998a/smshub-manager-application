declare namespace Electron {
  interface IpcMain {
    handle(channel: string, listener: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any): void;
    removeHandler(channel: string): void;
  }

  interface IpcRenderer {
    invoke(channel: string, ...args: any[]): Promise<any>;
    on(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): this;
    removeListener(channel: string, listener: (...args: any[]) => void): this;
  }

  interface WebContents {
    send(channel: string, ...args: any[]): void;
  }

  interface IpcMainInvokeEvent {
    processId: number;
    frameId: number;
    sender: WebContents;
  }

  interface IpcRendererEvent {
    processId: number;
    frameId: number;
  }

  interface App {
    getPath(name: string): string;
    getVersion(): string;
    quit(): void;
    on(event: string, listener: Function): this;
    whenReady(): Promise<void>;
  }

  interface BrowserWindow {
    loadURL(url: string): Promise<void>;
    loadFile(filePath: string): Promise<void>;
    webContents: WebContents;
    on(event: string, listener: Function): this;
    close(): void;
  }

  interface BrowserWindowConstructorOptions {
    width: number;
    height: number;
    webPreferences: {
      nodeIntegration: boolean;
      contextIsolation: boolean;
      preload: string;
    };
  }
}

declare module 'electron' {
  export const app: Electron.App;
  export const ipcMain: Electron.IpcMain;
  export const ipcRenderer: Electron.IpcRenderer;
  export class BrowserWindow {
    constructor(options: Electron.BrowserWindowConstructorOptions);
    static getAllWindows(): BrowserWindow[];
    loadURL(url: string): Promise<void>;
    loadFile(filePath: string): Promise<void>;
    webContents: Electron.WebContents;
    on(event: string, listener: Function): this;
    close(): void;
  }
}

// Preload script context
interface Window {
  api: {
    // Auth
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;

    // Plugins
    getPlugins: () => Promise<any[]>;
    installPlugin: (pluginPath: string) => Promise<void>;
    enablePlugin: (pluginName: string) => Promise<void>;
    disablePlugin: (pluginName: string) => Promise<void>;
    uninstallPlugin: (pluginName: string) => Promise<void>;
    getPluginConfig: (pluginName: string) => Promise<any>;
    savePluginConfig: (pluginName: string, config: any) => Promise<void>;

    // Modems
    getModems: () => Promise<any[]>;
    sendSMS: (modemId: string, number: string, message: string) => Promise<boolean>;
    resetModem: (modemId: string) => Promise<void>;
    getModemStatus: (modemId: string) => Promise<any>;
    configureModem: (modemId: string, config: any) => Promise<void>;

    // Messages
    getMessages: (options: any) => Promise<any>;
    deleteMessage: (messageId: number) => Promise<void>;
    resendMessage: (messageId: number) => Promise<void>;

    // Config
    getSystemConfig: () => Promise<any>;
    saveSystemConfig: (config: any) => Promise<void>;
    resetSystemConfig: () => Promise<void>;

    // System
    getSystemStats: () => Promise<any>;
    checkUpdate: () => Promise<any>;
    installUpdate: () => Promise<void>;

    // Events
    on: (channel: string, callback: Function) => void;
    off: (channel: string, callback: Function) => void;
  };
} 