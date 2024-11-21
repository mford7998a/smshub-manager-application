import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Modem management
  getModems: () => ipcRenderer.invoke('getModems'),
  getModemStats: (modemId: string) => ipcRenderer.invoke('getModemStats', modemId),
  sendSMS: (data: { modemId: string; number: string; message: string }) => 
    ipcRenderer.invoke('sendSMS', data),
  configureModem: (data: {
    modemId: string;
    config: {
      networkMode?: '4g' | '5g' | 'auto';
      bands?: string[];
      carrierAggregation?: boolean;
      apn?: string;
    }
  }) => ipcRenderer.invoke('configureModem', data),
  resetModem: (modemId: string) => ipcRenderer.invoke('resetModem', modemId),
  sendATCommand: (data: { modemId: string; command: string }) => 
    ipcRenderer.invoke('sendATCommand', data),
  getModemDetails: (modemId: string) => ipcRenderer.invoke('getModemDetails', modemId),
  getModemDiagnostics: (modemId: string) => ipcRenderer.invoke('getModemDiagnostics', modemId),
  getAvailableBands: (modemId: string) => ipcRenderer.invoke('getAvailableBands', modemId),
  scanNetworks: (modemId: string) => ipcRenderer.invoke('scanNetworks', modemId),
  selectNetwork: (data: { modemId: string; operator: string }) => 
    ipcRenderer.invoke('selectNetwork', data),
  
  // Event listeners
  onModemConnected: (callback: (modem: any) => void) => 
    ipcRenderer.on('modem:connected', (_, modem) => callback(modem)),
  onModemDisconnected: (callback: (modemId: string) => void) => 
    ipcRenderer.on('modem:disconnected', (_, modemId) => callback(modemId)),
  onModemError: (callback: (error: any) => void) => 
    ipcRenderer.on('modem:error', (_, error) => callback(error)),
  onModemStatusChanged: (callback: (data: any) => void) => 
    ipcRenderer.on('modem:status', (_, data) => callback(data)),
  
  // Message management
  getMessages: () => ipcRenderer.invoke('getMessages'),
  retryMessage: (messageId: number) => ipcRenderer.invoke('retryMessage', messageId),
  deleteMessage: (messageId: number) => ipcRenderer.invoke('deleteMessage', messageId),
  
  // Message events
  onMessageReceived: (callback: (message: any) => void) => 
    ipcRenderer.on('message:received', (_, message) => callback(message)),
  onMessageStatusChanged: (callback: (data: any) => void) => 
    ipcRenderer.on('message:status', (_, data) => callback(data)),
  
  // Statistics
  getStatistics: (timeRange: string) => ipcRenderer.invoke('getStatistics', timeRange),
  exportStatistics: (timeRange: string, format: string) => 
    ipcRenderer.invoke('exportStatistics', timeRange, format),
  
  // Plugin Management
  getPlugins: () => ipcRenderer.invoke('getPlugins'),
  installPlugin: (file: File) => ipcRenderer.invoke('installPlugin', file),
  uninstallPlugin: (pluginId: string) => ipcRenderer.invoke('uninstallPlugin', pluginId),
  togglePlugin: (pluginId: string) => ipcRenderer.invoke('togglePlugin', pluginId),
  getPluginConfig: (pluginId: string) => ipcRenderer.invoke('getPluginConfig', pluginId),
  savePluginConfig: (pluginId: string, config: any) => 
    ipcRenderer.invoke('savePluginConfig', pluginId, config),
  
  // Plugin events
  onPluginInstalled: (callback: (plugin: any) => void) => 
    ipcRenderer.on('plugin:installed', (_, plugin) => callback(plugin)),
  onPluginUninstalled: (callback: (pluginId: string) => void) => 
    ipcRenderer.on('plugin:uninstalled', (_, pluginId) => callback(pluginId)),
  onPluginError: (callback: (error: any) => void) => 
    ipcRenderer.on('plugin:error', (_, error) => callback(error)),
  onPluginStatusChanged: (callback: (data: any) => void) => 
    ipcRenderer.on('plugin:status', (_, data) => callback(data)),
  
  // Autoflash
  flashModem: (config: {
    firmwareVersion?: string;
    carrier?: string;
    type?: string;
    apn?: string;
    forceGeneric?: boolean;
  }) => ipcRenderer.invoke('flashModem', config),
  
  // System
  getSystemConfig: () => ipcRenderer.invoke('getSystemConfig'),
  saveSystemConfig: (config: any) => ipcRenderer.invoke('saveSystemConfig', config),
  
  // System events
  onSystemError: (callback: (error: any) => void) => 
    ipcRenderer.on('system:error', (_, error) => callback(error)),
  onSystemStatus: (callback: (status: any) => void) => 
    ipcRenderer.on('system:status', (_, status) => callback(status))
}); 