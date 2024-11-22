<template>
  <v-container fluid>
    <!-- System Overview -->
    <v-row>
      <v-col cols="12" lg="4">
        <v-card>
          <v-card-title>
            System Overview
            <v-spacer></v-spacer>
            <v-btn icon @click="refreshStats">
              <v-icon>mdi-refresh</v-icon>
            </v-btn>
          </v-card-title>
          <v-card-text>
            <v-list dense>
              <!-- Active Modems -->
              <v-list-item>
                <v-list-item-content>
                  <v-list-item-title>Active Modems</v-list-item-title>
                  <v-list-item-subtitle>{{ stats.activeModems }} / {{ stats.totalModems }}</v-list-item-subtitle>
                </v-list-item-content>
                <v-list-item-action>
                  <v-icon :color="getHealthColor(stats.activeModems / stats.totalModems)">
                    mdi-usb-port
                  </v-icon>
                </v-list-item-action>
              </v-list-item>

              <!-- Message Rate -->
              <v-list-item>
                <v-list-item-content>
                  <v-list-item-title>Message Rate</v-list-item-title>
                  <v-list-item-subtitle>{{ stats.messageRate.toFixed(2) }}/sec</v-list-item-subtitle>
                </v-list-item-content>
                <v-list-item-action>
                  <v-icon :color="getHealthColor(1 - stats.errorRate)">
                    mdi-message-processing
                  </v-icon>
                </v-list-item-action>
              </v-list-item>

              <!-- Error Rate -->
              <v-list-item>
                <v-list-item-content>
                  <v-list-item-title>Error Rate</v-list-item-title>
                  <v-list-item-subtitle>{{ (stats.errorRate * 100).toFixed(2) }}%</v-list-item-subtitle>
                </v-list-item-content>
                <v-list-item-action>
                  <v-icon :color="getHealthColor(1 - stats.errorRate)">
                    mdi-alert-circle
                  </v-icon>
                </v-list-item-action>
              </v-list-item>

              <!-- System Health -->
              <v-list-item>
                <v-list-item-content>
                  <v-list-item-title>System Health</v-list-item-title>
                  <v-list-item-subtitle>
                    CPU: {{ stats.cpu.toFixed(1) }}% | Memory: {{ stats.memory.toFixed(1) }}MB
                  </v-list-item-subtitle>
                </v-list-item-content>
                <v-list-item-action>
                  <v-icon :color="getHealthColor(1 - stats.cpu / 100)">
                    mdi-cpu-64-bit
                  </v-icon>
                </v-list-item-action>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Performance Metrics -->
      <v-col cols="12" lg="8">
        <v-card>
          <v-card-title>
            Performance Metrics
            <v-spacer></v-spacer>
            <v-select
              v-model="timeRange"
              :items="timeRangeOptions"
              label="Time Range"
              dense
              hide-details
              class="time-range-select"
              @change="updateCharts"
            ></v-select>
          </v-card-title>
          <v-card-text>
            <v-row>
              <!-- Message Rate Chart -->
              <v-col cols="12" md="6">
                <v-chart :option="messageRateChart" autoresize />
              </v-col>
              <!-- Error Rate Chart -->
              <v-col cols="12" md="6">
                <v-chart :option="errorRateChart" autoresize />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Modem Status -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>
            Modem Status
            <v-spacer></v-spacer>
            <v-text-field
              v-model="search"
              append-icon="mdi-magnify"
              label="Search"
              single-line
              hide-details
            ></v-text-field>
          </v-card-title>

          <v-data-table
            :headers="headers"
            :items="modems"
            :search="search"
            :loading="loading"
            :items-per-page="10"
          >
            <!-- Status Column -->
            <template v-slot:item.status="{ item }">
              <v-chip :color="getStatusColor(item.status)" small>
                {{ item.status }}
              </v-chip>
            </template>

            <!-- Signal Strength Column -->
            <template v-slot:item.signalStrength="{ item }">
              <v-progress-linear
                :value="item.signalStrength"
                :color="getSignalColor(item.signalStrength)"
                height="20"
              >
                <template v-slot:default>
                  {{ item.signalStrength }}%
                </template>
              </v-progress-linear>
            </template>

            <!-- Actions Column -->
            <template v-slot:item.actions="{ item }">
              <v-btn
                icon
                small
                @click="resetModem(item)"
                :loading="item.resetting"
                :disabled="item.status === 'disconnected'"
              >
                <v-icon>mdi-refresh</v-icon>
              </v-btn>
              <v-btn
                icon
                small
                @click="configureModem(item)"
                :disabled="item.status === 'disconnected'"
              >
                <v-icon>mdi-cog</v-icon>
              </v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Modem Configuration Dialog -->
    <v-dialog v-model="configDialog" max-width="600px">
      <v-card>
        <v-card-title>
          Configure Modem
          <v-spacer></v-spacer>
          <v-btn icon @click="configDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <v-form ref="configForm">
            <v-text-field
              v-model="selectedModem.name"
              label="Name"
              required
            ></v-text-field>
            <v-select
              v-model="selectedModem.mode"
              :items="networkModes"
              label="Network Mode"
            ></v-select>
            <v-switch
              v-model="selectedModem.autoReconnect"
              label="Auto Reconnect"
            ></v-switch>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="primary"
            @click="saveModemConfig"
            :loading="saving"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted } from 'vue';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent
} from 'echarts/components';
import VChart from 'vue-echarts';

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent
]);

export default defineComponent({
  name: 'Dashboard',
  components: {
    VChart
  },

  setup() {
    // State
    const stats = ref({
      activeModems: 0,
      totalModems: 0,
      messageRate: 0,
      errorRate: 0,
      cpu: 0,
      memory: 0
    });

    const modems = ref([]);
    const loading = ref(false);
    const search = ref('');
    const timeRange = ref('1h');
    const configDialog = ref(false);
    const selectedModem = ref({});
    const saving = ref(false);

    // Options
    const timeRangeOptions = [
      { text: 'Last Hour', value: '1h' },
      { text: 'Last 24 Hours', value: '24h' },
      { text: 'Last 7 Days', value: '7d' },
      { text: 'Last 30 Days', value: '30d' }
    ];

    const headers = [
      { text: 'ID', value: 'id' },
      { text: 'Model', value: 'model' },
      { text: 'Status', value: 'status' },
      { text: 'Signal', value: 'signalStrength' },
      { text: 'Messages', value: 'messageCount' },
      { text: 'Errors', value: 'errorCount' },
      { text: 'Actions', value: 'actions', sortable: false }
    ];

    const networkModes = [
      { text: 'Auto', value: 'auto' },
      { text: '4G Only', value: '4g' },
      { text: '3G Only', value: '3g' },
      { text: '2G Only', value: '2g' }
    ];

    // Chart options
    const messageRateChart = ref({
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        data: ['Messages/sec']
      },
      xAxis: {
        type: 'time'
      },
      yAxis: {
        type: 'value'
      },
      series: [{
        name: 'Messages/sec',
        type: 'line',
        smooth: true,
        data: []
      }]
    });

    const errorRateChart = ref({
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        data: ['Error Rate %']
      },
      xAxis: {
        type: 'time'
      },
      yAxis: {
        type: 'value',
        max: 100
      },
      series: [{
        name: 'Error Rate %',
        type: 'line',
        smooth: true,
        data: []
      }]
    });

    // Methods
    const refreshStats = async () => {
      loading.value = true;
      try {
        stats.value = await window.api.getSystemStats();
        modems.value = await window.api.getModems();
        await updateCharts();
      } catch (error) {
        console.error('Failed to refresh stats:', error);
      } finally {
        loading.value = false;
      }
    };

    const updateCharts = async () => {
      try {
        const data = await window.api.getPerformanceMetrics(timeRange.value);
        messageRateChart.value.series[0].data = data.messageRates;
        errorRateChart.value.series[0].data = data.errorRates;
      } catch (error) {
        console.error('Failed to update charts:', error);
      }
    };

    const resetModem = async (modem: any) => {
      modem.resetting = true;
      try {
        await window.api.resetModem(modem.id);
        await refreshStats();
      } catch (error) {
        console.error('Failed to reset modem:', error);
      } finally {
        modem.resetting = false;
      }
    };

    const configureModem = (modem: any) => {
      selectedModem.value = { ...modem };
      configDialog.value = true;
    };

    const saveModemConfig = async () => {
      saving.value = true;
      try {
        await window.api.configureModem(
          selectedModem.value.id,
          selectedModem.value
        );
        configDialog.value = false;
        await refreshStats();
      } catch (error) {
        console.error('Failed to save modem config:', error);
      } finally {
        saving.value = false;
      }
    };

    // Utility functions
    const getHealthColor = (value: number): string => {
      if (value >= 0.8) return 'success';
      if (value >= 0.5) return 'warning';
      return 'error';
    };

    const getStatusColor = (status: string): string => {
      const colors: Record<string, string> = {
        ready: 'success',
        initializing: 'info',
        error: 'error',
        disconnected: 'grey'
      };
      return colors[status] || 'grey';
    };

    const getSignalColor = (strength: number): string => {
      if (strength >= 70) return 'success';
      if (strength >= 40) return 'warning';
      return 'error';
    };

    // Lifecycle hooks
    onMounted(async () => {
      await refreshStats();
      // Start auto-refresh
      const refreshInterval = setInterval(refreshStats, 30000);
      onUnmounted(() => clearInterval(refreshInterval));

      // Setup WebSocket updates
      window.api.on('stats:updated', (newStats: any) => {
        stats.value = newStats;
      });

      window.api.on('modem:updated', (modemId: string) => {
        refreshStats();
      });
    });

    return {
      stats,
      modems,
      loading,
      search,
      timeRange,
      timeRangeOptions,
      headers,
      networkModes,
      configDialog,
      selectedModem,
      saving,
      messageRateChart,
      errorRateChart,
      refreshStats,
      resetModem,
      configureModem,
      saveModemConfig,
      getHealthColor,
      getStatusColor,
      getSignalColor
    };
  }
});
</script>

<style scoped>
.time-range-select {
  max-width: 150px;
}

.v-card {
  margin-bottom: 16px;
}

.echarts {
  min-height: 300px;
}
</style> 