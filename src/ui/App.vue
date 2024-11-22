<template>
  <v-app>
    <v-navigation-drawer
      v-model="drawer"
      app
      clipped
    >
      <v-list>
        <v-list-item
          v-for="item in menuItems"
          :key="item.title"
          :to="item.to"
          link
        >
          <v-list-item-icon>
            <v-icon>{{ item.icon }}</v-icon>
          </v-list-item-icon>

          <v-list-item-content>
            <v-list-item-title>{{ item.title }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar
      app
      clipped-left
      color="primary"
      dark
    >
      <v-app-bar-nav-icon @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>SMSHub</v-toolbar-title>
      <v-spacer></v-spacer>

      <system-status></system-status>

      <v-btn
        icon
        @click="showSettings = true"
      >
        <v-icon>mdi-cog</v-icon>
      </v-btn>
    </v-app-bar>

    <v-main>
      <v-container fluid>
        <router-view></router-view>
      </v-container>
    </v-main>

    <settings-dialog
      v-model="showSettings"
    ></settings-dialog>

    <notification-system></notification-system>
  </v-app>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import SystemStatus from './components/SystemStatus.vue';
import SettingsDialog from './components/SettingsDialog.vue';
import NotificationSystem from './components/NotificationSystem.vue';

export default defineComponent({
  name: 'App',

  components: {
    SystemStatus,
    SettingsDialog,
    NotificationSystem
  },

  setup() {
    const drawer = ref(true);
    const showSettings = ref(false);

    const menuItems = [
      {
        title: 'Dashboard',
        icon: 'mdi-view-dashboard',
        to: '/'
      },
      {
        title: 'Messages',
        icon: 'mdi-message',
        to: '/messages'
      },
      {
        title: 'Plugins',
        icon: 'mdi-puzzle',
        to: '/plugins'
      },
      {
        title: 'Logs',
        icon: 'mdi-text',
        to: '/logs'
      }
    ];

    return {
      drawer,
      showSettings,
      menuItems
    };
  }
});
</script>

<style>
.v-main {
  background-color: #f5f5f5;
}

.v-navigation-drawer {
  background-color: #ffffff;
}

.v-list-item--active {
  background-color: #e3f2fd;
}
</style> 