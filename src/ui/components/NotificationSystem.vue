<template>
  <div class="notification-system">
    <!-- Toast Notifications -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="snackbar.timeout"
      :multi-line="snackbar.multiLine"
      top
      right
    >
      {{ snackbar.text }}

      <template v-slot:action="{ attrs }">
        <v-btn
          text
          v-bind="attrs"
          @click="snackbar.show = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>

    <!-- Alert Dialog -->
    <v-dialog
      v-model="dialog.show"
      max-width="500px"
      persistent
    >
      <v-card>
        <v-card-title :class="dialog.color + '--text'">
          {{ dialog.title }}
        </v-card-title>

        <v-card-text>
          {{ dialog.message }}
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            text
            @click="handleDialogAction(false)"
          >
            {{ dialog.cancelText }}
          </v-btn>
          <v-btn
            :color="dialog.color"
            @click="handleDialogAction(true)"
          >
            {{ dialog.confirmText }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, onMounted, onUnmounted } from 'vue';

interface SnackbarState {
  show: boolean;
  text: string;
  color: string;
  timeout: number;
  multiLine: boolean;
}

interface DialogState {
  show: boolean;
  title: string;
  message: string;
  color: string;
  confirmText: string;
  cancelText: string;
  resolve?: (value: boolean) => void;
}

export default defineComponent({
  name: 'NotificationSystem',

  setup() {
    const snackbar = reactive<SnackbarState>({
      show: false,
      text: '',
      color: 'info',
      timeout: 5000,
      multiLine: false
    });

    const dialog = reactive<DialogState>({
      show: false,
      title: '',
      message: '',
      color: 'primary',
      confirmText: 'Confirm',
      cancelText: 'Cancel'
    });

    const showNotification = (
      text: string,
      options: {
        color?: string;
        timeout?: number;
        multiLine?: boolean;
      } = {}
    ) => {
      snackbar.text = text;
      snackbar.color = options.color || 'info';
      snackbar.timeout = options.timeout || 5000;
      snackbar.multiLine = options.multiLine || false;
      snackbar.show = true;
    };

    const showConfirmation = (
      title: string,
      message: string,
      options: {
        color?: string;
        confirmText?: string;
        cancelText?: string;
      } = {}
    ): Promise<boolean> => {
      return new Promise((resolve) => {
        dialog.title = title;
        dialog.message = message;
        dialog.color = options.color || 'primary';
        dialog.confirmText = options.confirmText || 'Confirm';
        dialog.cancelText = options.cancelText || 'Cancel';
        dialog.resolve = resolve;
        dialog.show = true;
      });
    };

    const handleDialogAction = (confirmed: boolean) => {
      dialog.show = false;
      dialog.resolve?.(confirmed);
    };

    // Event handlers
    const handleModemEvent = (event: any) => {
      switch (event.type) {
        case 'modem:connected':
          showNotification(`Modem ${event.id} connected`, { color: 'success' });
          break;
        case 'modem:disconnected':
          showNotification(`Modem ${event.id} disconnected`, { color: 'warning' });
          break;
        case 'modem:error':
          showNotification(`Modem error: ${event.error}`, { 
            color: 'error',
            multiLine: true,
            timeout: 10000
          });
          break;
      }
    };

    const handlePluginEvent = (event: any) => {
      switch (event.type) {
        case 'plugin:installed':
          showNotification(`Plugin ${event.name} installed`, { color: 'success' });
          break;
        case 'plugin:uninstalled':
          showNotification(`Plugin ${event.name} uninstalled`, { color: 'info' });
          break;
        case 'plugin:error':
          showNotification(`Plugin error: ${event.error}`, { 
            color: 'error',
            multiLine: true
          });
          break;
      }
    };

    const handleSystemEvent = (event: any) => {
      switch (event.type) {
        case 'system:error':
          showNotification(`System error: ${event.error}`, {
            color: 'error',
            multiLine: true,
            timeout: 0
          });
          break;
        case 'update:available':
          showNotification('Update available', {
            color: 'info',
            timeout: 0
          });
          break;
      }
    };

    // Setup event listeners
    onMounted(() => {
      window.api.on('modem:event', handleModemEvent);
      window.api.on('plugin:event', handlePluginEvent);
      window.api.on('system:event', handleSystemEvent);
    });

    // Cleanup
    onUnmounted(() => {
      window.api.off('modem:event', handleModemEvent);
      window.api.off('plugin:event', handlePluginEvent);
      window.api.off('system:event', handleSystemEvent);
    });

    return {
      snackbar,
      dialog,
      showNotification,
      showConfirmation,
      handleDialogAction
    };
  }
});
</script>

<style scoped>
.notification-system {
  position: fixed;
  z-index: 9999;
}
</style> 