<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" app>
      <v-list>
        <v-list-item
          v-for="(item, i) in menuItems"
          :key="i"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
        />
      </v-list>

      <template v-slot:append>
        <v-divider />
        <v-list>
          <v-list-item
            prepend-icon="mdi-cog"
            title="Settings"
            @click="showSettings"
          />
          <v-list-item
            prepend-icon="mdi-information"
            title="About"
            @click="showAbout"
          />
        </v-list>
      </template>
    </v-navigation-drawer>

    <v-app-bar app elevation="1">
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-toolbar-title>SMSHub Manager</v-toolbar-title>
      <v-spacer />
      
      <v-btn
        icon
        :color="systemStatus.connected ? 'success' : 'error'"
        @click="showSystemStatus"
      >
        <v-icon>{{ systemStatus.connected ? 'mdi-check-circle' : 'mdi-alert-circle' }}</v-icon>
      </v-btn>
    </v-app-bar>

    <v-main>
      <v-container fluid>
        <router-view />
      </v-container>
    </v-main>

    <settings-dialog
      v-model="settingsOpen"
      :settings="settings"
      @save="saveSettings"
    />

    <v-dialog v-model="aboutOpen" max-width="500px">
      <v-card>
        <v-card-title>About SMSHub Manager</v-card-title>
        <v-card-text>
          <p>Version: {{ version }}</p>
          <p>A powerful desktop application for managing multiple USB modems for SMS processing.</p>
          <v-divider class="my-4" />
          <p class="text-caption">
            © {{ new Date().getFullYear() }} SMSHub. All rights reserved.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="primary"
            variant="text"
            @click="aboutOpen = false"
          >
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="statusOpen" max-width="600px">
      <v-card>
        <v-card-title>System Status</v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item>
              <v-list-item-title>API Connection</v-list-item-title>
              <v-list-item-subtitle>
                <v-chip
                  :color="systemStatus.connected ? 'success' : 'error'"
                  size="small"
                >
                  {{ systemStatus.connected ? 'Connected' : 'Disconnected' }}
                </v-chip>
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Active Modems</v-list-item-title>
              <v-list-item-subtitle>{{ systemStatus.activeModems }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Messages Today</v-list-item-title>
              <v-list-item-subtitle>{{ systemStatus.messagesProcessed }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Success Rate</v-list-item-title>
              <v-list-item-subtitle>{{ systemStatus.successRate }}%</v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="systemStatus.error">
              <v-list-item-title>Last Error</v-list-item-title>
              <v-list-item-subtitle class="text-error">
                {{ systemStatus.error }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-dialog>

    <notification-system ref="notifications" />
  </v-app>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted } from 'vue';
import { useStore } from 'vuex';
import SettingsDialog from './components/SettingsDialog.vue';
import NotificationSystem from './components/NotificationSystem.vue';
import { version } from '../../package.json';

export default defineComponent({
  name: 'App',
  components: { SettingsDialog, NotificationSystem },

  setup() {
    const store = useStore();
    const drawer = ref(true);
    const settingsOpen = ref(false);
    const aboutOpen = ref(false);
    const statusOpen = ref(false);
    const settings = ref({});
    const systemStatus = ref({
      connected: false,
      activeModems: 0,
      messagesProcessed: 0,
      successRate: 0,
      error: null
    });

    const menuItems = [
      { title: 'Dashboard', icon: 'mdi-view-dashboard', to: '/' },
      { title: 'Modems', icon: 'mdi-cellphone-link', to: '/modems' },
      { title: 'Messages', icon: 'mdi-message-text', to: '/messages' },
      { title: 'Statistics', icon: 'mdi-chart-bar', to: '/statistics' },
      { title: 'Plugins', icon: 'mdi-puzzle', to: '/plugins' }
    ];

    const showSettings = () => {
      settingsOpen.value = true;
    };

    const showAbout = () => {
      aboutOpen.value = true;
    };

    const showSystemStatus = () => {
      statusOpen.value = true;
    };

    const saveSettings = async (newSettings: any) => {
      try {
        await window.api.saveSystemConfig(newSettings);
        settings.value = newSettings;
        settingsOpen.value = false;
        showNotification('Settings saved successfully', 'success');
      } catch (error) {
        console.error('Failed to save settings:', error);
        showNotification('Failed to save settings', 'error');
      }
    };

    const showNotification = (text: string, type: string = 'success') => {
      const notifications = ref<any>(null);
      notifications.value?.showNotification({
        text,
        type,
        timeout: type === 'error' ? 5000 : 3000
      });
    };

    const updateSystemStatus = async () => {
      try {
        const stats = await window.api.getStatistics('24h');
        systemStatus.value = {
          connected: true,
          activeModems: stats.summary.activeModems,
          messagesProcessed: stats.summary.totalMessages,
          successRate: stats.summary.successRate,
          error: null
        };
      } catch (error) {
        systemStatus.value.connected = false;
        systemStatus.value.error = (error as Error).message;
      }
    };

    let statusInterval: number;

    onMounted(async () => {
      // Load initial data
      await Promise.all([
        store.dispatch('loadModems'),
        store.dispatch('loadMessages'),
        store.dispatch('loadPlugins'),
        store.dispatch('loadStatistics', '24h')
      ]);

      // Setup event listeners
      window.api.onModemConnected((modem) => {
        store.commit('addModem', modem);
        showNotification(`Modem ${modem.model} connected`);
      });

      window.api.onModemDisconnected((modemId) => {
        store.commit('removeModem', modemId);
        showNotification(`Modem disconnected`, 'warning');
      });

      window.api.onSystemError((error) => {
        showNotification(error.message, 'error');
      });

      // Start status updates
      updateSystemStatus();
      statusInterval = window.setInterval(updateSystemStatus, 30000);
    });

    onUnmounted(() => {
      if (statusInterval) {
        clearInterval(statusInterval);
      }
    });

    return {
      version,
      drawer,
      menuItems,
      settingsOpen,
      aboutOpen,
      statusOpen,
      settings,
      systemStatus,
      showSettings,
      showAbout,
      showSystemStatus,
      saveSettings
    };
  }
});
</script>

<style>
.v-application {
  font-family: 'Roboto', sans-serif;
}

.v-main {
  background-color: #f5f5f5;
}

.v-navigation-drawer {
  background-color: #1E1E1E;
}

.v-list-item {
  margin: 4px 0;
}

.v-list-item--active {
  background-color: var(--v-primary-base) !important;
}
</style> 