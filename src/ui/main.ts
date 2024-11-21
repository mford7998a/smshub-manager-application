import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import { createStore } from 'vuex';
import { createVuetify } from 'vuetify';
import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';

// Components
import App from './App.vue';
import Dashboard from './views/Dashboard.vue';
import Modems from './views/Modems.vue';
import Messages from './views/Messages.vue';
import Statistics from './views/Statistics.vue';
import Plugins from './views/Plugins.vue';
import NotificationSystem from './components/NotificationSystem.vue';

// Router configuration
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Dashboard },
    { path: '/modems', component: Modems },
    { path: '/messages', component: Messages },
    { path: '/statistics', component: Statistics },
    { path: '/plugins', component: Plugins }
  ]
});

// Vuex store
const store = createStore({
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
    async loadModems({ commit }) {
      try {
        const modems = await window.api.getModems();
        commit('setModems', modems);
      } catch (error) {
        console.error('Failed to load modems:', error);
      }
    },
    async loadMessages({ commit }) {
      try {
        const messages = await window.api.getMessages();
        commit('setMessages', messages);
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    },
    async loadPlugins({ commit }) {
      try {
        const plugins = await window.api.getPlugins();
        commit('setPlugins', plugins);
      } catch (error) {
        console.error('Failed to load plugins:', error);
      }
    },
    async loadStatistics({ commit }, timeRange) {
      try {
        const statistics = await window.api.getStatistics(timeRange);
        commit('setStatistics', statistics);
      } catch (error) {
        console.error('Failed to load statistics:', error);
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

// Vuetify configuration
const vuetify = createVuetify({
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        colors: {
          primary: '#1976D2',
          secondary: '#424242',
          accent: '#82B1FF',
          error: '#FF5252',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FFC107'
        }
      }
    }
  }
});

// Create and mount Vue app
const app = createApp(App);

// Register global components
app.component('notification-system', NotificationSystem);

// Use plugins
app.use(router);
app.use(store);
app.use(vuetify);

// Mount app
app.mount('#app');

// Setup global error handler
app.config.errorHandler = (err, vm, info) => {
  console.error('Global error:', err);
  console.error('Component:', vm);
  console.error('Info:', info);
  
  // Show error notification
  const notification = app.config.globalProperties.$notification;
  if (notification) {
    notification.showError({
      title: 'Application Error',
      message: err.message,
      error: err
    });
  }
}; 