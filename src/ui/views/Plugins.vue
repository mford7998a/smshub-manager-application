<template>
  <v-container fluid>
    <v-row>
      <!-- Plugin List -->
      <v-col cols="12" lg="8">
        <v-card>
          <v-card-title>
            Installed Plugins
            <v-spacer></v-spacer>
            <v-btn
              color="primary"
              @click="showInstallDialog = true"
            >
              Install Plugin
            </v-btn>
          </v-card-title>

          <v-data-table
            :headers="headers"
            :items="plugins"
            :loading="loading"
          >
            <!-- Status Column -->
            <template v-slot:item.enabled="{ item }">
              <v-switch
                v-model="item.enabled"
                :loading="item.updating"
                @change="togglePlugin(item)"
                dense
              ></v-switch>
            </template>

            <!-- Version Column -->
            <template v-slot:item.version="{ item }">
              <v-chip
                :color="getVersionColor(item.version)"
                small
              >
                {{ item.version }}
              </v-chip>
            </template>

            <!-- Actions Column -->
            <template v-slot:item.actions="{ item }">
              <v-btn
                icon
                small
                @click="configurePlugin(item)"
                :disabled="!item.enabled"
              >
                <v-icon>mdi-cog</v-icon>
              </v-btn>
              <v-btn
                icon
                small
                @click="uninstallPlugin(item)"
                :disabled="item.updating"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-col>

      <!-- Plugin Details -->
      <v-col cols="12" lg="4">
        <v-card v-if="selectedPlugin">
          <v-card-title>
            {{ selectedPlugin.name }}
            <v-spacer></v-spacer>
            <v-chip
              :color="getStatusColor(selectedPlugin.enabled)"
              small
            >
              {{ selectedPlugin.enabled ? 'Enabled' : 'Disabled' }}
            </v-chip>
          </v-card-title>

          <v-card-text>
            <v-list dense>
              <v-list-item>
                <v-list-item-content>
                  <v-list-item-title>Version</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedPlugin.version }}</v-list-item-subtitle>
                </v-list-item-content>
              </v-list-item>

              <v-list-item>
                <v-list-item-content>
                  <v-list-item-title>Author</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedPlugin.author }}</v-list-item-subtitle>
                </v-list-item-content>
              </v-list-item>

              <v-list-item>
                <v-list-item-content>
                  <v-list-item-title>Description</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedPlugin.description }}</v-list-item-subtitle>
                </v-list-item-content>
              </v-list-item>

              <v-divider></v-divider>

              <v-list-item>
                <v-list-item-content>
                  <v-list-item-title>Supported Modems</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip
                      v-for="modem in selectedPlugin.supportedModems"
                      :key="modem.vendor"
                      class="mr-1 mt-1"
                      small
                    >
                      {{ modem.vendor }}
                    </v-chip>
                  </v-list-item-subtitle>
                </v-list-item-content>
              </v-list-item>

              <v-list-item>
                <v-list-item-content>
                  <v-list-item-title>Capabilities</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip
                      v-for="(enabled, cap) in selectedPlugin.capabilities"
                      :key="cap"
                      :color="enabled ? 'success' : 'grey'"
                      class="mr-1 mt-1"
                      small
                    >
                      {{ cap }}
                    </v-chip>
                  </v-list-item-subtitle>
                </v-list-item-content>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Install Plugin Dialog -->
    <v-dialog
      v-model="showInstallDialog"
      max-width="500px"
    >
      <v-card>
        <v-card-title>Install Plugin</v-card-title>
        <v-card-text>
          <v-file-input
            v-model="pluginFile"
            label="Select Plugin Package"
            accept=".zip"
            :rules="[v => !!v || 'Plugin package is required']"
          ></v-file-input>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            text
            @click="showInstallDialog = false"
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
  </v-container>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';
import { useStore } from 'vuex';
import DynamicForm from '../components/DynamicForm.vue';

export default defineComponent({
  name: 'Plugins',
  components: {
    DynamicForm
  },

  setup() {
    const store = useStore();
    const loading = ref(false);
    const search = ref('');
    const configDialog = ref(false);
    const installDialog = ref(false);
    const selectedPlugin = ref<any>(null);
    const pluginFile = ref<File | null>(null);
    const installing = ref(false);
    const saving = ref(false);

    const headers = [
      { text: 'Name', value: 'name' },
      { text: 'Version', value: 'version' },
      { text: 'Description', value: 'description' },
      { text: 'Enabled', value: 'enabled' },
      { text: 'Capabilities', value: 'capabilities' },
      { text: 'Actions', value: 'actions', sortable: false }
    ];

    const plugins = ref<any[]>([]);

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

    const togglePlugin = async (plugin: any) => {
      plugin.updating = true;
      try {
        await window.api.togglePlugin(plugin.name, plugin.enabled);
      } catch (error) {
        plugin.enabled = !plugin.enabled;
        console.error('Failed to toggle plugin:', error);
      } finally {
        plugin.updating = false;
      }
    };

    const configurePlugin = (plugin: any) => {
      selectedPlugin.value = plugin;
      configDialog.value = true;
    };

    const savePluginConfig = async () => {
      if (!selectedPlugin.value) return;
      
      saving.value = true;
      try {
        await window.api.updatePluginConfig(
          selectedPlugin.value.name,
          selectedPlugin.value.config
        );
        configDialog.value = false;
      } catch (error) {
        console.error('Failed to save plugin config:', error);
      } finally {
        saving.value = false;
      }
    };

    const installPlugin = () => {
      installDialog.value = true;
    };

    const confirmInstall = async () => {
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

    const uninstallPlugin = async (plugin: any) => {
      if (!confirm(`Are you sure you want to uninstall ${plugin.name}?`)) {
        return;
      }

      plugin.updating = true;
      try {
        await window.api.uninstallPlugin(plugin.name);
        await loadPlugins();
      } catch (error) {
        console.error('Failed to uninstall plugin:', error);
      }
    };

    onMounted(() => {
      loadPlugins();
    });

    return {
      loading,
      search,
      headers,
      plugins,
      configDialog,
      installDialog,
      selectedPlugin,
      pluginFile,
      installing,
      saving,
      togglePlugin,
      configurePlugin,
      savePluginConfig,
      installPlugin,
      confirmInstall,
      uninstallPlugin
    };
  }
});
</script> 