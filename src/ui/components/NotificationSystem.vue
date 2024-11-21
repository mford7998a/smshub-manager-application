<template>
  <div>
    <!-- Global Snackbar -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="snackbar.timeout"
      :location="snackbar.location"
      :multi-line="snackbar.multiLine"
    >
      <div class="d-flex align-center">
        <v-icon
          :icon="getIcon(snackbar.type)"
          class="mr-2"
          size="20"
        />
        <div>
          <div v-if="snackbar.title" class="text-subtitle-2 font-weight-bold">
            {{ snackbar.title }}
          </div>
          <div>{{ snackbar.text }}</div>
        </div>
      </div>

      <template v-slot:actions>
        <v-btn
          v-if="snackbar.action"
          variant="text"
          @click="snackbar.action.handler"
        >
          {{ snackbar.action.text }}
        </v-btn>
        <v-btn
          variant="text"
          @click="closeSnackbar"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>

    <!-- Error Dialog for Critical Errors -->
    <v-dialog
      v-model="errorDialog.show"
      max-width="500px"
      persistent
    >
      <v-card>
        <v-card-title class="bg-error text-white">
          <v-icon icon="mdi-alert-circle" class="mr-2" />
          System Error
        </v-card-title>
        <v-card-text class="pt-4">
          <p class="text-body-1">{{ errorDialog.message }}</p>
          <p v-if="errorDialog.details" class="text-caption mt-2">
            {{ errorDialog.details }}
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="error"
            variant="text"
            @click="closeErrorDialog"
          >
            Close
          </v-btn>
          <v-btn
            v-if="errorDialog.retry"
            color="primary"
            @click="retryError"
          >
            Retry
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, provide } from 'vue';

interface SnackbarState {
  show: boolean;
  text: string;
  title?: string;
  color: string;
  timeout: number;
  location?: 'top' | 'bottom';
  multiLine: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
  action?: {
    text: string;
    handler: () => void;
  };
}

interface ErrorDialogState {
  show: boolean;
  message: string;
  details?: string;
  retry?: () => Promise<void>;
}

export default defineComponent({
  name: 'NotificationSystem',

  setup() {
    const snackbar = ref<SnackbarState>({
      show: false,
      text: '',
      color: 'success',
      timeout: 5000,
      location: 'bottom',
      multiLine: false,
      type: 'success'
    });

    const errorDialog = ref<ErrorDialogState>({
      show: false,
      message: ''
    });

    const showNotification = (options: {
      text: string;
      title?: string;
      type?: 'success' | 'error' | 'warning' | 'info';
      timeout?: number;
      location?: 'top' | 'bottom';
      action?: {
        text: string;
        handler: () => void;
      };
    }) => {
      const colorMap = {
        success: 'success',
        error: 'error',
        warning: 'warning',
        info: 'info'
      };

      snackbar.value = {
        show: true,
        text: options.text,
        title: options.title,
        color: colorMap[options.type || 'success'],
        timeout: options.timeout || 5000,
        location: options.location || 'bottom',
        multiLine: !!options.title,
        type: options.type || 'success',
        action: options.action
      };
    };

    const showError = (options: {
      message: string;
      details?: string;
      retry?: () => Promise<void>;
    }) => {
      errorDialog.value = {
        show: true,
        message: options.message,
        details: options.details,
        retry: options.retry
      };
    };

    const closeSnackbar = () => {
      snackbar.value.show = false;
    };

    const closeErrorDialog = () => {
      errorDialog.value.show = false;
    };

    const retryError = async () => {
      if (errorDialog.value.retry) {
        try {
          await errorDialog.value.retry();
          errorDialog.value.show = false;
        } catch (error) {
          console.error('Retry failed:', error);
        }
      }
    };

    const getIcon = (type: string): string => {
      const iconMap: Record<string, string> = {
        success: 'mdi-check-circle',
        error: 'mdi-alert-circle',
        warning: 'mdi-alert',
        info: 'mdi-information'
      };
      return iconMap[type] || 'mdi-information';
    };

    // Provide notification methods to child components
    provide('notifications', {
      showNotification,
      showError
    });

    return {
      snackbar,
      errorDialog,
      closeSnackbar,
      closeErrorDialog,
      retryError,
      getIcon
    };
  }
});
</script>

<style scoped>
.v-snackbar {
  .v-snackbar__content {
    padding: 12px;
  }
}
</style> 