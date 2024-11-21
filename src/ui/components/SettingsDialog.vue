<template>
  <v-dialog v-model="dialog" max-width="800px">
    <v-card>
      <v-card-title>
        Settings
        <v-spacer />
        <v-btn icon @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text>
        <v-form ref="form" v-model="valid">
          <!-- API Configuration -->
          <v-card variant="outlined" class="mb-4">
            <v-card-title>API Configuration</v-card-title>
            <v-card-text>
              <v-text-field
                v-model="config.smshub.baseUrl"
                label="API Base URL"
                :rules="[v => !!v || 'Base URL is required']"
                required
              />
              <v-text-field
                v-model="config.smshub.apiKey"
                label="API Key"
                :rules="[v => !!v || 'API Key is required']"
                required
                type="password"
              />
              <v-text-field
                v-model.number="config.smshub.timeout"
                label="API Timeout (ms)"
                type="number"
                min="1000"
                max="60000"
              />
            </v-card-text>
          </v-card>

          <!-- Plugin Settings -->
          <v-card variant="outlined" class="mb-4">
            <v-card-title>Plugin Settings</v-card-title>
            <v-card-text>
              <v-switch
                v-model="config.plugins.autoload"
                label="Automatically load plugins on startup"
              />
              <v-text-field
                v-model="config.plugins.directory"
                label="Plugin Directory"
                :rules="[v => !!v || 'Plugin directory is required']"
                required
              />
            </v-card-text>
          </v-card>

          <!-- Logging Settings -->
          <v-card variant="outlined" class="mb-4">
            <v-card-title>Logging</v-card-title>
            <v-card-text>
              <v-select
                v-model="config.logging.level"
                :items="logLevels"
                label="Log Level"
              />
              <v-text-field
                v-model.number="config.logging.maxFiles"
                label="Max Log Files"
                type="number"
                min="1"
                max="20"
              />
              <v-text-field
                v-model.number="config.logging.maxSize"
                label="Max Log Size (MB)"
                type="number"
                min="1"
                max="100"
              />
            </v-card-text>
          </v-card>

          <!-- Modem Settings -->
          <v-card variant="outlined">
            <v-card-title>Modem Settings</v-card-title>
            <v-card-text>
              <v-text-field
                v-model.number="config.modem.defaultBaudRate"
                label="Default Baud Rate"
                type="number"
                :items="baudRates"
              />
              <v-text-field
                v-model.number="config.modem.commandTimeout"
                label="Command Timeout (ms)"
                type="number"
                min="1000"
                max="30000"
              />
              <v-text-field
                v-model.number="config.modem.reconnectDelay"
                label="Reconnect Delay (ms)"
                type="number"
                min="1000"
                max="30000"
              />
            </v-card-text>
          </v-card>
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          color="error"
          variant="text"
          @click="close"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          :loading="saving"
          :disabled="!valid"
          @click="save"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue';

export default defineComponent({
  name: 'SettingsDialog',

  props: {
    modelValue: {
      type: Boolean,
      required: true
    },
    settings: {
      type: Object,
      required: true
    }
  },

  emits: ['update:modelValue', 'save'],

  setup(props, { emit }) {
    const dialog = ref(props.modelValue);
    const valid = ref(false);
    const saving = ref(false);
    const form = ref<any>(null);

    const config = ref({
      smshub: {
        baseUrl: '',
        apiKey: '',
        timeout: 30000
      },
      plugins: {
        autoload: true,
        directory: ''
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
      }
    });

    const logLevels = [
      { title: 'Error', value: 'error' },
      { title: 'Warning', value: 'warn' },
      { title: 'Info', value: 'info' },
      { title: 'Debug', value: 'debug' }
    ];

    const baudRates = [
      9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600
    ];

    watch(() => props.modelValue, (newVal) => {
      dialog.value = newVal;
    });

    watch(dialog, (newVal) => {
      emit('update:modelValue', newVal);
      if (!newVal) {
        resetForm();
      }
    });

    watch(() => props.settings, (newVal) => {
      if (newVal) {
        config.value = { ...config.value, ...newVal };
      }
    }, { immediate: true });

    const resetForm = () => {
      if (form.value) {
        form.value.reset();
      }
      config.value = { ...props.settings };
    };

    const save = async () => {
      if (!valid.value) return;

      saving.value = true;
      try {
        emit('save', config.value);
      } finally {
        saving.value = false;
      }
    };

    const close = () => {
      dialog.value = false;
    };

    return {
      dialog,
      valid,
      saving,
      form,
      config,
      logLevels,
      baudRates,
      save,
      close
    };
  }
});
</script> 