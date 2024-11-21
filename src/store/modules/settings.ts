import { Module } from 'vuex';
import { logger } from '../../utils/logger';

interface SettingsState {
  smshub: {
    baseUrl: string;
    apiKey: string;
    timeout: number;
  };
  plugins: {
    directory: string;
    autoload: boolean;
  };
  logging: {
    level: string;
    maxFiles: number;
    maxSize: number;
  };
  modem: {
    defaultBaudRate: number;
    commandTimeout: number;
    reconnectDelay: number;
  };
  ui: {
    theme: 'light' | 'dark';
    language: string;
    autoRefresh: boolean;
    refreshInterval: number;
    dateFormat: string;
    timeFormat: string;
  };
  notifications: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
    errorOnly: boolean;
  };
}

const settingsModule: Module<SettingsState, any> = {
  namespaced: true,

  state: {
    smshub: {
      baseUrl: 'https://api.smshub.com',
      apiKey: '',
      timeout: 30000
    },
    plugins: {
      directory: '',
      autoload: true
    },
    logging: {
      level: 'info',
      maxFiles: 5,
      maxSize: 5
    },
    modem: {
      defaultBaudRate: 115200,
      commandTimeout: 10000,
      reconnectDelay: 5000
    },
    ui: {
      theme: 'dark',
      language: 'en',
      autoRefresh: true,
      refreshInterval: 30000,
      dateFormat: 'YYYY-MM-DD',
      timeFormat: 'HH:mm:ss'
    },
    notifications: {
      enabled: true,
      sound: true,
      desktop: true,
      errorOnly: false
    }
  },

  mutations: {
    setSettings(state, settings) {
      Object.assign(state, settings);
    },
    updateSMSHubSettings(state, settings) {
      Object.assign(state.smshub, settings);
    },
    updatePluginSettings(state, settings) {
      Object.assign(state.plugins, settings);
    },
    updateLoggingSettings(state, settings) {
      Object.assign(state.logging, settings);
    },
    updateModemSettings(state, settings) {
      Object.assign(state.modem, settings);
    },
    updateUISettings(state, settings) {
      Object.assign(state.ui, settings);
    },
    updateNotificationSettings(state, settings) {
      Object.assign(state.notifications, settings);
    }
  },

  actions: {
    async loadSettings({ commit }) {
      try {
        const settings = await window.api.getSystemConfig();
        commit('setSettings', settings);
      } catch (error) {
        logger.error('Failed to load settings:', error);
        throw error;
      }
    },

    async saveSettings({ state }) {
      try {
        await window.api.saveSystemConfig(state);
      } catch (error) {
        logger.error('Failed to save settings:', error);
        throw error;
      }
    },

    async updateSMSHubSettings({ commit, dispatch }, settings) {
      commit('updateSMSHubSettings', settings);
      await dispatch('saveSettings');
    },

    async updatePluginSettings({ commit, dispatch }, settings) {
      commit('updatePluginSettings', settings);
      await dispatch('saveSettings');
    },

    async updateLoggingSettings({ commit, dispatch }, settings) {
      commit('updateLoggingSettings', settings);
      await dispatch('saveSettings');
    },

    async updateModemSettings({ commit, dispatch }, settings) {
      commit('updateModemSettings', settings);
      await dispatch('saveSettings');
    },

    async updateUISettings({ commit, dispatch }, settings) {
      commit('updateUISettings', settings);
      await dispatch('saveSettings');
    },

    async updateNotificationSettings({ commit, dispatch }, settings) {
      commit('updateNotificationSettings', settings);
      await dispatch('saveSettings');
    }
  },

  getters: {
    isDarkTheme: state => state.ui.theme === 'dark',
    refreshInterval: state => state.ui.refreshInterval,
    notificationsEnabled: state => state.notifications.enabled,
    shouldShowDesktopNotifications: state => 
      state.notifications.enabled && state.notifications.desktop,
    shouldPlaySound: state => 
      state.notifications.enabled && state.notifications.sound,
    dateTimeFormat: state => 
      `${state.ui.dateFormat} ${state.ui.timeFormat}`
  }
};

export default settingsModule; 