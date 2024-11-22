<template>
  <v-dialog
    v-model="show"
    max-width="800px"
  >
    <v-card>
      <v-card-title>
        Settings
        <v-spacer></v-spacer>
        <v-btn
          icon
          @click="show = false"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text>
        <v-tabs v-model="activeTab">
          <v-tab>General</v-tab>
          <v-tab>API</v-tab>
          <v-tab>Modems</v-tab>
          <v-tab>Plugins</v-tab>
          <v-tab>Advanced</v-tab>
        </v-tabs>

        <v-tabs-items v-model="activeTab">
          <!-- General Settings -->
          <v-tab-item>
            <v-card flat>
              <v-card-text>
                <v-form ref="generalForm">
                  <v-switch
                    v-model="settings.general.autoStart"
                    label="Start on system boot"
                  ></v-switch>
                  <v-switch
                    v-model="settings.general.minimizeToTray"
                    label="Minimize to system tray"
                  ></v-switch>
                  <v-select
                    v-model="settings.general.theme"
                    :items="themeOptions"
                    label="Theme"
                  ></v-select>
                  <v-select
                    v-model="settings.general.language"
                    :items="languageOptions"
                    label="Language"
                  ></v-select>
                </v-form>
              </v-card-text>
            </v-card>
          </v-tab-item>

          <!-- API Settings -->
          <v-tab-item>
            <v-card flat>
              <v-card-text>
                <v-form ref="apiForm">
                  <v-text-field
                    v-model="settings.api.baseUrl"
                    label="API Base URL"
                    required
                  ></v-text-field>
                  <v-text-field
                    v-model="settings.api.apiKey"
                    label="API Key"
                    type="password"
                    required
                  ></v-text-field>
                  <v-slider
                    v-model="settings.api.timeout"
                    label="API Timeout (seconds)"
                    min="5"
                    max="60"
                    thumb-label
                  ></v-slider>
                </v-form>
              </v-card-text>
            </v-card>
          </v-tab-item>

          <!-- Modem Settings -->
          <v-tab-item>
            <v-card flat>
              <v-card-text>
                <v-form ref="modemForm">
                  <v-slider
                    v-model="settings.modem.commandTimeout"
                    label="Command Timeout (seconds)"
                    min="1"
                    max="30"
                    thumb-label
                  ></v-slider>
                  <v-slider
                    v-model="settings.modem.maxRetries"
                    label="Max Command Retries"
                    min="0"
                    max="5"
                    thumb-label
                  ></v-slider>
                  <v-slider
                    v-model="settings.modem.signalCheckInterval"
                    label="Signal Check Interval (seconds)"
                    min="10"
                    max="300"
                    thumb-label
                  ></v-slider>
                </v-form>
              </v-card-text>
            </v-card>
          </v-tab-item>

          <!-- Plugin Settings -->
          <v-tab-item>
            <v-card flat>
              <v-card-text>
                <v-form ref="pluginForm">
                  <v-switch
                    v-model="settings.plugins.autoload"
                    label="Auto-load plugins on startup"
                  ></v-switch>
                  <v-switch
                    v-model="settings.plugins.verifySignatures"
                    label="Verify plugin signatures"
                  ></v-switch>
                </v-form>
              </v-card-text>
            </v-card>
          </v-tab-item>

          <!-- Advanced Settings -->
          <v-tab-item>
            <v-card flat>
              <v-card-text>
                <v-form ref="advancedForm">
                  <v-select
                    v-model="settings.logging.level"
                    :items="logLevelOptions"
                    label="Log Level"
                  ></v-select>
                  <v-text-field
                    v-model.number="settings.logging.maxFiles"
                    label="Max Log Files"
                    type="number"
                    min="1"
                    max="20"
                  ></v-text-field>
                  <v-text-field
                    v-model.number="settings.logging.maxSize"
                    label="Max Log Size (MB)"
                    type="number"
                    min="1"
                    max="100"
                  ></v-text-field>
                </v-form>
              </v-card-text>
            </v-card>
          </v-tab-item>
        </v-tabs-items>
      </v-card-text>

      <v-divider></v-divider>

      <v-card-actions>
        <v-btn
          text
          color="error"
          @click="resetSettings"
        >
          Reset to Default
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn
          text
          @click="show = false"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          @click="saveSettings"
          :loading="saving"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { defineComponent, ref, reactive } from 'vue';
import { useStore } from 'vuex';

export default defineComponent({
  name: 'SettingsDialog',

  setup() {
    const store = useStore();
    const show = ref(false);
    const activeTab = ref(0);
    const saving = ref(false);

    const settings = reactive({
      general: {
        autoStart: false,
        minimizeToTray: true,
        theme: 'light',
        language: 'en'
      },
      api: {
        baseUrl: '',
        apiKey: '',
        timeout: 30
      },
      modem: {
        commandTimeout: 10,
        maxRetries: 3,
        signalCheckInterval: 30
      },
      plugins: {
        autoload: true,
        verifySignatures: true
      },
      logging: {
        level: 'info',
        maxFiles: 5,
        maxSize: 10
      }
    });

    const themeOptions = [
      { text: 'Light', value: 'light' },
      { text: 'Dark', value: 'dark' },
      { text: 'System', value: 'system' }
    ];

    const languageOptions = [
      { text: 'English', value: 'en' },
      { text: 'Spanish', value: 'es' },
      { text: 'French', value: 'fr' }
    ];

    const logLevelOptions = [
      { text: 'Debug', value: 'debug' },
      { text: 'Info', value: 'info' },
      { text: 'Warning', value: 'warn' },
      { text: 'Error', value: 'error' }
    ];

    const loadSettings = async () => {
      const config = await window.api.getSystemConfig();
      Object.assign(settings, config);
    };

    const saveSettings = async () => {
      saving.value = true;
      try {
        await window.api.saveSystemConfig(settings);
        show.value = false;
      } catch (error) {
        console.error('Failed to save settings:', error);
      } finally {
        saving.value = false;
      }
    };

    const resetSettings = async () => {
      await window.api.resetSystemConfig();
      await loadSettings();
    };

    return {
      show,
      activeTab,
      saving,
      settings,
      themeOptions,
      languageOptions,
      logLevelOptions,
      saveSettings,
      resetSettings
    };
  }
});
</script> 