/// <reference types="node" />
/// <reference types="electron" />
/// <reference types="@types/webpack-env" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $store: any;
    $router: any;
  }
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production';
      ELECTRON_WEBPACK_WDS_PORT: string;
    }
  }

  interface Window {
    api: {
      // Modem management
      getModems: () => Promise<ModemInfo[]>;
      getModemStats: (modemId: string) => Promise<ModemStats>;
      sendSMS: (data: { modemId: string; number: string; message: string }) => Promise<boolean>;
      
      // Event listeners
      onModemConnected: (callback: (modem: ModemInfo) => void) => void;
      onModemDisconnected: (callback: (modemId: string) => void) => void;
      onModemError: (callback: (error: Error) => void) => void;
      
      // Message management
      getMessages: () => Promise<MessageInfo[]>;
      retryMessage: (messageId: number) => Promise<boolean>;
      deleteMessage: (messageId: number) => Promise<boolean>;
      
      // Message events
      onMessageReceived: (callback: (message: MessageInfo) => void) => void;
      onMessageStatusChanged: (callback: (data: MessageStatus) => void) => void;
      
      // Statistics
      getStatistics: (timeRange: string) => Promise<Statistics>;
      exportStatistics: (timeRange: string, format: string) => Promise<string>;
      
      // Plugin Management
      getPlugins: () => Promise<PluginInfo[]>;
      installPlugin: (file: File) => Promise<boolean>;
      uninstallPlugin: (pluginId: string) => Promise<boolean>;
      togglePlugin: (pluginId: string) => Promise<boolean>;
      getPluginConfig: (pluginId: string) => Promise<any>;
      savePluginConfig: (pluginId: string, config: any) => Promise<boolean>;
      
      // Plugin events
      onPluginInstalled: (callback: (plugin: PluginInfo) => void) => void;
      onPluginUninstalled: (callback: (pluginId: string) => void) => void;
      onPluginError: (callback: (error: Error) => void) => void;
      
      // Autoflash
      flashModem: (config: AutoflashConfig) => Promise<void>;
    };
  }
}

interface ModemInfo {
  id: string;
  imei: string;
  model: string;
  operator: string;
  status: 'online' | 'offline';
  signal: number;
}

interface ModemStats {
  signalStrength: number;
  technology: string;
  band: string;
  timestamp: Date;
}

interface MessageInfo {
  id: number;
  modemId: string;
  sender: string;
  message: string;
  timestamp: Date;
  status: 'received' | 'sent' | 'pending' | 'failed';
}

interface MessageStatus {
  id: number;
  status: 'received' | 'sent' | 'pending' | 'failed';
  error?: string;
}

interface Statistics {
  summary: {
    totalMessages: number;
    messagesTrend: number;
    successRate: number;
    avgResponseTime: number;
    responseTimeTrend: number;
    activeModems: number;
    modemUtilization: number;
  };
  messageVolume: any;
  statusDistribution: any;
  modemStats: any[];
}

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  author: string;
  description: string;
  supportedModels: string[];
  stats: {
    activeModems: number;
    messagesProcessed: number;
    successRate: number;
  };
}

interface AutoflashConfig {
  firmwareVersion?: string;
  carrier?: string;
  type?: string;
  apn?: string;
  forceGeneric?: boolean;
}

export {}; 