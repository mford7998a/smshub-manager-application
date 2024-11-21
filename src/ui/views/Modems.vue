<template>
  <div>
    <!-- Modem Grid -->
    <v-row>
      <v-col
        v-for="modem in modems"
        :key="modem.imei"
        cols="12"
        md="6"
        lg="4"
      >
        <v-card>
          <v-card-title class="d-flex align-center">
            {{ modem.model }}
            <v-spacer />
            <v-chip
              :color="modem.status === 'online' ? 'success' : 'error'"
              size="small"
            >
              {{ modem.status }}
            </v-chip>
          </v-card-title>

          <v-card-text>
            <v-list>
              <v-list-item>
                <v-list-item-title>IMEI</v-list-item-title>
                <v-list-item-subtitle>{{ modem.imei }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Operator</v-list-item-title>
                <v-list-item-subtitle>{{ modem.operator }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Signal Strength</v-list-item-title>
                <v-list-item-subtitle>
                  <v-progress-linear
                    :model-value="modem.signal"
                    :color="getSignalColor(modem.signal)"
                    height="20"
                  >
                    <template v-slot:default>
                      {{ modem.signal }}%
                    </template>
                  </v-progress-linear>
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Network Mode</v-list-item-title>
                <v-list-item-subtitle>{{ modem.networkMode || 'Auto' }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Active Bands</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip-group>
                    <v-chip
                      v-for="band in modem.activeBands"
                      :key="band"
                      size="small"
                      color="primary"
                    >
                      {{ band }}
                    </v-chip>
                  </v-chip-group>
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>

            <v-row class="mt-4">
              <v-col>
                <v-btn
                  block
                  color="primary"
                  prepend-icon="mdi-cog"
                  @click="showModemConfig(modem)"
                >
                  Configure
                </v-btn>
              </v-col>
              <v-col>
                <v-btn
                  block
                  :color="modem.status === 'online' ? 'warning' : 'success'"
                  :prepend-icon="modem.status === 'online' ? 'mdi-refresh' : 'mdi-power'"
                  :loading="modem.resetting"
                  @click="resetModem(modem)"
                >
                  {{ modem.status === 'online' ? 'Reset' : 'Connect' }}
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- No Modems Message -->
      <v-col v-if="modems.length === 0" cols="12">
        <v-alert
          type="info"
          text="No modems connected. Please connect a USB modem to get started."
        />
      </v-col>
    </v-row>

    <!-- Modem Configuration Dialog -->
    <v-dialog v-model="configDialog" max-width="800px">
      <v-card v-if="selectedModem">
        <v-card-title>
          Configure {{ selectedModem.model }}
          <v-spacer />
          <v-btn icon @click="configDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-card-text>
          <v-tabs v-model="activeTab">
            <v-tab value="network">Network</v-tab>
            <v-tab value="bands">Bands</v-tab>
            <v-tab value="advanced">Advanced</v-tab>
            <v-tab value="firmware">Firmware</v-tab>
            <v-tab value="diagnostics">Diagnostics</v-tab>
          </v-tabs>

          <v-window v-model="activeTab">
            <!-- Network Settings -->
            <v-window-item value="network">
              <v-container>
                <v-row>
                  <v-col cols="12">
                    <v-select
                      v-model="config.networkMode"
                      :items="networkModes"
                      label="Network Mode"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-text-field
                      v-model="config.apn"
                      label="APN"
                      placeholder="Enter APN"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-switch
                      v-model="config.carrierAggregation"
                      label="Carrier Aggregation"
                      :disabled="!selectedModem.capabilities?.supportsCA"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-btn
                      color="primary"
                      prepend-icon="mdi-magnify"
                      :loading="scanning"
                      @click="scanNetworks"
                    >
                      Scan Networks
                    </v-btn>
                  </v-col>
                </v-row>
              </v-container>
            </v-window-item>

            <!-- Band Selection -->
            <v-window-item value="bands">
              <v-container>
                <v-row>
                  <v-col cols="12">
                    <v-chip-group
                      v-model="config.bands"
                      multiple
                      column
                    >
                      <v-chip
                        v-for="band in selectedModem.capabilities?.supportedBands"
                        :key="band"
                        :value="band"
                        filter
                      >
                        {{ band }}
                      </v-chip>
                    </v-chip-group>
                  </v-col>
                </v-row>
              </v-container>
            </v-window-item>

            <!-- Advanced Settings -->
            <v-window-item value="advanced">
              <v-container>
                <v-row>
                  <v-col cols="12">
                    <v-text-field
                      v-model="customCommand"
                      label="Custom AT Command"
                      :disabled="!selectedModem.capabilities?.supportsCustomAT"
                      append-inner-icon="mdi-send"
                      @click:append-inner="sendCustomCommand"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-textarea
                      v-model="commandResponse"
                      label="Response"
                      readonly
                      rows="5"
                    />
                  </v-col>
                </v-row>
              </v-container>
            </v-window-item>

            <!-- Firmware Management -->
            <v-window-item value="firmware">
              <v-container>
                <v-row>
                  <v-col cols="12">
                    <v-card variant="outlined">
                      <v-card-text>
                        <strong>Current Version:</strong> {{ selectedModem.firmwareVersion }}
                      </v-card-text>
                    </v-card>
                  </v-col>
                  <v-col cols="12">
                    <v-btn
                      block
                      color="primary"
                      prepend-icon="mdi-update"
                      @click="showAutoflashDialog"
                    >
                      Update Firmware
                    </v-btn>
                  </v-col>
                </v-row>
              </v-container>
            </v-window-item>

            <!-- Diagnostics -->
            <v-window-item value="diagnostics">
              <v-container>
                <v-row>
                  <v-col cols="12">
                    <v-list>
                      <v-list-item>
                        <v-list-item-title>Uptime</v-list-item-title>
                        <v-list-item-subtitle>{{ formatUptime(selectedModem.uptime) }}</v-list-item-subtitle>
                      </v-list-item>
                      <v-list-item>
                        <v-list-item-title>Error Count</v-list-item-title>
                        <v-list-item-subtitle>{{ selectedModem.errorCount }}</v-list-item-subtitle>
                      </v-list-item>
                      <v-list-item v-if="selectedModem.lastError">
                        <v-list-item-title>Last Error</v-list-item-title>
                        <v-list-item-subtitle class="text-error">{{ selectedModem.lastError }}</v-list-item-subtitle>
                      </v-list-item>
                    </v-list>
                  </v-col>
                  <v-col cols="12">
                    <v-card-title>Signal History</v-card-title>
                    <v-chart
                      :option="signalHistoryChart"
                      autoresize
                      style="height: 300px"
                    />
                  </v-col>
                </v-row>
              </v-container>
            </v-window-item>
          </v-window>
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
            @click="saveConfig"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Network Scan Dialog -->
    <v-dialog v-model="scanDialog" max-width="400px">
      <v-card>
        <v-card-title>Available Networks</v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item
              v-for="network in availableNetworks"
              :key="network.operator"
              :subtitle="network.technology"
              @click="selectNetwork(network)"
            >
              {{ network.operator }}
              <template v-slot:append>
                <v-chip
                  :color="getSignalColor(network.signal)"
                  size="small"
                >
                  {{ network.signal }}%
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Autoflash Dialog -->
    <autoflash-dialog
      v-model="autoflashDialog"
      :modem="selectedModem"
      @success="onAutoflashSuccess"
      @error="onAutoflashError"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent
} from 'echarts/components';
import VChart from 'vue-echarts';
import AutoflashDialog from '../components/AutoflashDialog.vue';

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent
]);

export default defineComponent({
  name: 'Modems',
  components: { VChart, AutoflashDialog },

  setup() {
    const store = useStore();
    const configDialog = ref(false);
    const scanDialog = ref(false);
    const autoflashDialog = ref(false);
    const selectedModem = ref<any>(null);
    const activeTab = ref('network');
    const saving = ref(false);
    const scanning = ref(false);
    const customCommand = ref('');
    const commandResponse = ref('');
    const availableNetworks = ref<any[]>([]);

    const modems = computed(() => store.state.modems);

    const config = ref({
      networkMode: '4g',
      apn: '',
      carrierAggregation: false,
      bands: [] as string[]
    });

    const networkModes = [
      { title: '4G Only', value: '4g' },
      { title: '5G NSA', value: '5g' },
      { title: 'Auto', value: 'auto' }
    ];

    const signalHistoryChart = computed(() => ({
      tooltip: {
        trigger: 'axis'
      },
      xAxis: {
        type: 'time',
        boundaryGap: false
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100
      },
      series: [{
        data: selectedModem.value?.signalHistory || [],
        type: 'line',
        smooth: true,
        areaStyle: {
          opacity: 0.3
        }
      }]
    }));

    const showModemConfig = async (modem: any) => {
      selectedModem.value = modem;
      const details = await window.api.getModemDetails(modem.id);
      config.value = {
        networkMode: details.config.networkMode || '4g',
        apn: details.config.apn || '',
        carrierAggregation: details.config.carrierAggregation || false,
        bands: details.config.bands || []
      };
      configDialog.value = true;
    };

    const resetModem = async (modem: any) => {
      try {
        modem.resetting = true;
        await window.api.resetModem(modem.id);
      } catch (error) {
        console.error('Failed to reset modem:', error);
      } finally {
        modem.resetting = false;
      }
    };

    const saveConfig = async () => {
      if (!selectedModem.value) return;

      saving.value = true;
      try {
        await window.api.configureModem({
          modemId: selectedModem.value.id,
          config: config.value
        });
        configDialog.value = false;
      } catch (error) {
        console.error('Failed to save modem configuration:', error);
      } finally {
        saving.value = false;
      }
    };

    const scanNetworks = async () => {
      if (!selectedModem.value) return;

      scanning.value = true;
      try {
        availableNetworks.value = await window.api.scanNetworks(selectedModem.value.id);
        scanDialog.value = true;
      } catch (error) {
        console.error('Failed to scan networks:', error);
      } finally {
        scanning.value = false;
      }
    };

    const selectNetwork = async (network: any) => {
      if (!selectedModem.value) return;

      try {
        await window.api.selectNetwork({
          modemId: selectedModem.value.id,
          operator: network.operator
        });
        scanDialog.value = false;
      } catch (error) {
        console.error('Failed to select network:', error);
      }
    };

    const sendCustomCommand = async () => {
      if (!selectedModem.value || !customCommand.value) return;

      try {
        const response = await window.api.sendATCommand({
          modemId: selectedModem.value.id,
          command: customCommand.value
        });
        commandResponse.value = response.data;
        customCommand.value = '';
      } catch (error) {
        console.error('Failed to send AT command:', error);
        commandResponse.value = `Error: ${error}`;
      }
    };

    const showAutoflashDialog = () => {
      autoflashDialog.value = true;
    };

    const onAutoflashSuccess = () => {
      configDialog.value = false;
    };

    const onAutoflashError = (error: Error) => {
      console.error('Autoflash error:', error);
    };

    const getSignalColor = (signal: number): string => {
      if (signal >= 70) return 'success';
      if (signal >= 40) return 'warning';
      return 'error';
    };

    const formatUptime = (ms: number): string => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) return `${days}d ${hours % 24}h`;
      if (hours > 0) return `${hours}h ${minutes % 60}m`;
      if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
      return `${seconds}s`;
    };

    onMounted(() => {
      store.dispatch('loadModems');
    });

    return {
      modems,
      configDialog,
      scanDialog,
      autoflashDialog,
      selectedModem,
      activeTab,
      saving,
      scanning,
      config,
      customCommand,
      commandResponse,
      availableNetworks,
      networkModes,
      signalHistoryChart,
      showModemConfig,
      resetModem,
      saveConfig,
      scanNetworks,
      selectNetwork,
      sendCustomCommand,
      showAutoflashDialog,
      onAutoflashSuccess,
      onAutoflashError,
      getSignalColor,
      formatUptime
    };
  }
});
</script> 