<template>
  <div>
    <v-row>
      <!-- Plugin Management -->
      <v-col cols="12">
        <v-card>
          <v-card-title>
            Installed Plugins
            <v-spacer />
            <v-btn
              color="primary"
              prepend-icon="mdi-plus"
              @click="showInstallDialog"
            >
              Install Plugin
            </v-btn>
          </v-card-title>

          <v-data-table
            :headers="headers"
            :items="plugins"
            :loading="loading"
          >
            <template v-slot:item.status="{ item }">
              <v-chip
                :color="item.raw.enabled ? 'success' : 'error'"
                size="small"
              >
                {{ item.raw.enabled ? 'Enabled' : 'Disabled' }}
              </v-chip>
            </template>

            <template v-slot:item.stats="{ item }">
              <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                  <div v-bind="props">
                    <v-chip
                      :color="getSuccessRateColor(item.raw.stats.successRate)"
                      size="small"
                      class="mr-2"
                    >
                      {{ item.raw.stats.successRate }}% Success
                    </v-chip>
                    <v-chip
                      color="primary"
                      size="small"
                    >
                      {{ item.raw.stats.messagesProcessed }} Messages
                    </v-chip>
                  </div>
                </template>
                <div>
                  Active Modems: {{ item.raw.stats.activeModems }}<br>
                  Messages Processed: {{ item.raw.stats.messagesProcessed }}<br>
                  Success Rate: {{ item.raw.stats.successRate }}%
                </div>
              </v-tooltip>
            </template>

            <template v-slot:item.actions="{ item }">
              <v-btn
                icon
                size="small"
                @click="showPluginConfig(item.raw)"
              >
                <v-icon>mdi-cog</v-icon>
              </v-btn>
              <v-btn
                icon
                size="small"
                :color="item.raw.enabled ? 'error' : 'success'"
                @click="togglePlugin(item.raw)"
              >
                <v-icon>
                  {{ item.raw.enabled ? 'mdi-stop' : 'mdi-play' }}
                </v-icon>
              </v-btn>
              <v-btn
                icon
                size="small"
                color="error"
                @click="uninstallPlugin(item.raw)"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Install Plugin Dialog -->
    <v-dialog v-model="installDialog" max-width="500px">
      <v-card>
        <v-card-title>Install Plugin</v-card-title>
        <v-card-text>
          <v-file-input
            v-model="pluginFile"
            accept=".zip"
            label="Select Plugin Package"
            prepend-icon="mdi-package-variant-closed"
            show-size
            :rules="[v => !!v || 'Plugin file is required']"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="error"
            variant="text"
            @click="installDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :loading="installing"
            :disabled="!pluginFile"
            @click="installPlugin"
          >
            Install
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Plugin Configuration Dialog -->
    <v-dialog v-model="configDialog" max-width="600px">
      <v-card v-if="selectedPlugin">
        <v-card-title>
          Configure {{ selectedPlugin.name }}
          <v-spacer />
          <v-btn icon @click="configDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-card-text>
          <v-form ref="configForm" v-model="configValid">
            <v-text-field
              v-model="pluginConfig.name"
              label="Plugin Name"
              :rules="[v => !!v || 'Name is required']"
            />
            <v-textarea
              v-model="pluginConfig.description"
              label="Description"
              rows="3"
            />
            <v-combobox
              v-model="pluginConfig.supportedModels"
              label="Supported Models"
              multiple
              chips
              small-chips
            />
          </v-form>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn
            color="error"
            variant="text"
            @click="configDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :loading="saving"
            :disabled="!configValid"
            @click="savePluginConfig"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Uninstall Confirmation Dialog -->
    <v-dialog v-model="uninstallDialog" max-width="400px">
      <v-card>
        <v-card-title>Confirm Uninstall</v-card-title>
        <v-card-text>
          Are you sure you want to uninstall this plugin? This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="grey"
            variant="text"
            @click="uninstallDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            :loading="uninstalling"
            @click="confirmUninstall"
          >
            Uninstall
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';
import { useStore } from 'vuex';

export default defineComponent({
  name: 'Plugins',

  setup() {
    const store = useStore();
    const loading = ref(false);
    const installDialog = ref(false);
    const configDialog = ref(false);
    const uninstallDialog = ref(false);
    const installing = ref(false);
    const saving = ref(false);
    const uninstalling = ref(false);
    const pluginFile = ref<File | null>(null);
    const selectedPlugin = ref<any>(null);
    const configValid = ref(false);
    const configForm = ref<any>(null);

    const plugins = ref<any[]>([]);

    const headers = [
      { title: 'Name', key: 'name' },
      { title: 'Version', key: 'version' },
      { title: 'Status', key: 'status' },
      { title: 'Author', key: 'author' },
      { title: 'Statistics', key: 'stats' },
      { title: 'Actions', key: 'actions', sortable: false }
    ];

    const pluginConfig = ref({
      name: '',
      description: '',
      supportedModels: [] as string[]
    });

    const loadPlugins = async () => {
      loading.value = true;
      try {
        plugins.value = await window.api.getPlugins();
      } catch (error) {
        console.error('Failed to load plugins:', error);
      } finally {
        loading.value = false;
      }
    };

    const showInstallDialog = () => {
      pluginFile.value = null;
      installDialog.value = true;
    };

    const installPlugin = async () => {
      if (!pluginFile.value) return;

      installing.value = true;
      try {
        await window.api.installPlugin(pluginFile.value);
        installDialog.value = false;
        await loadPlugins();
      } catch (error) {
        console.error('Failed to install plugin:', error);
      } finally {
        installing.value = false;
      }
    };

    const showPluginConfig = async (plugin: any) => {
      selectedPlugin.value = plugin;
      const config = await window.api.getPluginConfig(plugin.id);
      pluginConfig.value = {
        name: config.name || plugin.name,
        description: config.description || plugin.description,
        supportedModels: config.supportedModels || plugin.supportedModels
      };
      configDialog.value = true;
    };

    const savePluginConfig = async () => {
      if (!selectedPlugin.value || !configValid.value) return;

      saving.value = true;
      try {
        await window.api.savePluginConfig(selectedPlugin.value.id, pluginConfig.value);
        configDialog.value = false;
        await loadPlugins();
      } catch (error) {
        console.error('Failed to save plugin configuration:', error);
      } finally {
        saving.value = false;
      }
    };

    const togglePlugin = async (plugin: any) => {
      try {
        await window.api.togglePlugin(plugin.id);
        await loadPlugins();
      } catch (error) {
        console.error('Failed to toggle plugin:', error);
      }
    };

    const uninstallPlugin = (plugin: any) => {
      selectedPlugin.value = plugin;
      uninstallDialog.value = true;
    };

    const confirmUninstall = async () => {
      if (!selectedPlugin.value) return;

      uninstalling.value = true;
      try {
        await window.api.uninstallPlugin(selectedPlugin.value.id);
        uninstallDialog.value = false;
        await loadPlugins();
      } catch (error) {
        console.error('Failed to uninstall plugin:', error);
      } finally {
        uninstalling.value = false;
      }
    };

    const getSuccessRateColor = (rate: number): string => {
      if (rate >= 90) return 'success';
      if (rate >= 70) return 'warning';
      return 'error';
    };

    onMounted(() => {
      loadPlugins();
    });

    return {
      loading,
      plugins,
      headers,
      installDialog,
      configDialog,
      uninstallDialog,
      installing,
      saving,
      uninstalling,
      pluginFile,
      selectedPlugin,
      configValid,
      configForm,
      pluginConfig,
      showInstallDialog,
      installPlugin,
      showPluginConfig,
      savePluginConfig,
      togglePlugin,
      uninstallPlugin,
      confirmUninstall,
      getSuccessRateColor
    };
  }
});
</script> 