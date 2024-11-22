import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // Auth
    login: (username: string, password: string) => 
      ipcRenderer.invoke('auth:login', username, password),
    logout: () => 
      ipcRenderer.invoke('auth:logout'),

    // Plugins
    getPlugins: () => 
      ipcRenderer.invoke('plugins:list'),
    installPlugin: (pluginPath: string) => 
      ipcRenderer.invoke('plugins:install', pluginPath),
    enablePlugin: (pluginName: string) => 
      ipcRenderer.invoke('plugins:enable', pluginName),
    disablePlugin: (pluginName: string) => 
      ipcRenderer.invoke('plugins:disable', pluginName),
    uninstallPlugin: (pluginName: string) => 
      ipcRenderer.invoke('plugins:uninstall', pluginName),
    getPluginConfig: (pluginName: string) => 
      ipcRenderer.invoke('plugins:get-config', pluginName),
    savePluginConfig: (pluginName: string, config: any) => 
      ipcRenderer.invoke('plugins:save-config', pluginName, config),

    // Modems
    getModems: () => 
      ipcRenderer.invoke('modems:list'),
    sendSMS: (modemId: string, number: string, message: string) => 
      ipcRenderer.invoke('modems:send-sms', modemId, number, message),
    resetModem: (modemId: string) => 
      ipcRenderer.invoke('modems:reset', modemId),
    getModemStatus: (modemId: string) => 
      ipcRenderer.invoke('modems:status', modemId),
    configureModem: (modemId: string, config: any) => 
      ipcRenderer.invoke('modems:configure', modemId, config),

    // Messages
    getMessages: (options: any) => 
      ipcRenderer.invoke('messages:list', options),
    deleteMessage: (messageId: number) => 
      ipcRenderer.invoke('messages:delete', messageId),
    resendMessage: (messageId: number) => 
      ipcRenderer.invoke('messages:resend', messageId),

    // Config
    getSystemConfig: () => 
      ipcRenderer.invoke('config:get'),
    saveSystemConfig: (config: any) => 
      ipcRenderer.invoke('config:set', config),
    resetSystemConfig: () => 
      ipcRenderer.invoke('config:reset'),

    // System
    getSystemStats: () => 
      ipcRenderer.invoke('system:stats'),
    checkUpdate: () => 
      ipcRenderer.invoke('system:check-update'),
    installUpdate: () => 
      ipcRenderer.invoke('system:install-update'),

    // Events
    on: (channel: string, callback: Function) => {
      const validChannels = [
        'modem:connected',
        'modem:disconnected',
        'modem:error',
        'message:received',
        'message:sent',
        'message:error',
        'plugin:loaded',
        'plugin:unloaded',
        'plugin:error',
        'update:available',
        'system:error'
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (_, ...args) => callback(...args));
      }
    },
    off: (channel: string, callback: Function) => {
      const validChannels = [
        'modem:connected',
        'modem:disconnected',
        'modem:error',
        'message:received',
        'message:sent',
        'message:error',
        'plugin:loaded',
        'plugin:unloaded',
        'plugin:error',
        'update:available',
        'system:error'
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.removeListener(channel, callback as any);
      }
    }
  }
); 