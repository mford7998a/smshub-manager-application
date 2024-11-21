import { createStore } from 'vuex';
import { logger } from '../utils/logger';

interface State {
  modems: any[];
  messages: any[];
  plugins: any[];
  statistics: any;
  events: any[];
  systemStatus: {
    connected: boolean;
    activeModems: number;
    messagesProcessed: number;
    successRate: number;
    error: string | null;
  };
}

export default createStore<State>({
  state: {
    modems: [],
    messages: [],
    plugins: [],
    statistics: null,
    events: [],
    systemStatus: {
      connected: false,
      activeModems: 0,
      messagesProcessed: 0,
      successRate: 0,
      error: null
    }
  },

  mutations: {
    // Modem mutations
    setModems(state, modems) {
      state.modems = modems;
    },
    addModem(state, modem) {
      state.modems.push(modem);
    },
    removeModem(state, modemId) {
      state.modems = state.modems.filter(m => m.id !== modemId);
    },
    updateModemStatus(state, { modemId, status }) {
      const modem = state.modems.find(m => m.id === modemId);
      if (modem) {
        modem.status = status;
      }
    },

    // Message mutations
    setMessages(state, messages) {
      state.messages = messages;
    },
    addMessage(state, message) {
      state.messages.unshift(message);
    },
    removeMessage(state, messageId) {
      state.messages = state.messages.filter(m => m.id !== messageId);
    },
    updateMessageStatus(state, { messageId, status }) {
      const message = state.messages.find(m => m.id === messageId);
      if (message) {
        message.status = status;
      }
    },

    // Plugin mutations
    setPlugins(state, plugins) {
      state.plugins = plugins;
    },
    addPlugin(state, plugin) {
      state.plugins.push(plugin);
    },
    removePlugin(state, pluginId) {
      state.plugins = state.plugins.filter(p => p.id !== pluginId);
    },
    updatePluginStatus(state, { pluginId, enabled }) {
      const plugin = state.plugins.find(p => p.id === pluginId);
      if (plugin) {
        plugin.enabled = enabled;
      }
    },

    // Statistics mutations
    setStatistics(state, statistics) {
      state.statistics = statistics;
    },

    // Event mutations
    addEvent(state, event) {
      state.events.unshift(event);
      if (state.events.length > 100) {
        state.events.pop();
      }
    },
    clearEvents(state) {
      state.events = [];
    },

    // System status mutations
    updateSystemStatus(state, status) {
      state.systemStatus = status;
    }
  },

  actions: {
    // Modem actions
    async loadModems({ commit }) {
      try {
        const modems = await window.api.getModems();
        commit('setModems', modems);
      } catch (error) {
        logger.error('Failed to load modems:', error);
        throw error;
      }
    },

    // Message actions
    async loadMessages({ commit }) {
      try {
        const messages = await window.api.getMessages();
        commit('setMessages', messages);
      } catch (error) {
        logger.error('Failed to load messages:', error);
        throw error;
      }
    },

    async retryMessage({ commit }, messageId) {
      try {
        await window.api.retryMessage(messageId);
        commit('updateMessageStatus', { messageId, status: 'pending' });
      } catch (error) {
        logger.error('Failed to retry message:', error);
        throw error;
      }
    },

    async deleteMessage({ commit }, messageId) {
      try {
        await window.api.deleteMessage(messageId);
        commit('removeMessage', messageId);
      } catch (error) {
        logger.error('Failed to delete message:', error);
        throw error;
      }
    },

    // Plugin actions
    async loadPlugins({ commit }) {
      try {
        const plugins = await window.api.getPlugins();
        commit('setPlugins', plugins);
      } catch (error) {
        logger.error('Failed to load plugins:', error);
        throw error;
      }
    },

    async installPlugin({ commit }, file) {
      try {
        await window.api.installPlugin(file);
      } catch (error) {
        logger.error('Failed to install plugin:', error);
        throw error;
      }
    },

    async uninstallPlugin({ commit }, pluginId) {
      try {
        await window.api.uninstallPlugin(pluginId);
        commit('removePlugin', pluginId);
      } catch (error) {
        logger.error('Failed to uninstall plugin:', error);
        throw error;
      }
    },

    async togglePlugin({ commit }, pluginId) {
      try {
        const enabled = await window.api.togglePlugin(pluginId);
        commit('updatePluginStatus', { pluginId, enabled });
      } catch (error) {
        logger.error('Failed to toggle plugin:', error);
        throw error;
      }
    },

    // Statistics actions
    async loadStatistics({ commit }, timeRange) {
      try {
        const statistics = await window.api.getStatistics(timeRange);
        commit('setStatistics', statistics);
      } catch (error) {
        logger.error('Failed to load statistics:', error);
        throw error;
      }
    },

    // System status actions
    async updateSystemStatus({ commit }) {
      try {
        const stats = await window.api.getStatistics('24h');
        commit('updateSystemStatus', {
          connected: true,
          activeModems: stats.summary.activeModems,
          messagesProcessed: stats.summary.totalMessages,
          successRate: stats.summary.successRate,
          error: null
        });
      } catch (error) {
        commit('updateSystemStatus', {
          connected: false,
          activeModems: 0,
          messagesProcessed: 0,
          successRate: 0,
          error: error.message
        });
      }
    }
  },

  getters: {
    activeModems: state => state.modems.filter(m => m.status === 'online'),
    activePlugins: state => state.plugins.filter(p => p.enabled),
    recentMessages: state => state.messages.slice(0, 100),
    systemConnected: state => state.systemStatus.connected,
    hasErrors: state => state.systemStatus.error !== null
  }
}); 