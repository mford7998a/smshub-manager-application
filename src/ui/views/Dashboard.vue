<template>
  <div>
    <!-- System Status Cards -->
    <v-row>
      <v-col cols="12" md="3">
        <v-card :color="systemStatus.connected ? 'success' : 'error'" variant="outlined">
          <v-card-title class="d-flex align-center">
            <v-icon size="24" class="mr-2">
              {{ systemStatus.connected ? 'mdi-check-circle' : 'mdi-alert-circle' }}
            </v-icon>
            System Status
          </v-card-title>
          <v-card-text>
            <div class="text-h4">{{ systemStatus.connected ? 'Online' : 'Offline' }}</div>
            <div v-if="systemStatus.error" class="text-caption mt-2">
              {{ systemStatus.error }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card>
          <v-card-title>Active Modems</v-card-title>
          <v-card-text>
            <div class="text-h4">{{ activeModems.length }}</div>
            <v-chip
              :color="activeModems.length > 0 ? 'success' : 'error'"
              class="mt-2"
            >
              {{ activeModems.length > 0 ? 'Online' : 'No Modems' }}
            </v-chip>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card>
          <v-card-title>Messages Today</v-card-title>
          <v-card-text>
            <div class="text-h4">{{ messagesToday }}</div>
            <v-chip
              :color="messagesTrend >= 0 ? 'success' : 'error'"
              class="mt-2"
            >
              {{ messagesTrend >= 0 ? '+' : '' }}{{ messagesTrend }}% from yesterday
            </v-chip>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card>
          <v-card-title>Success Rate</v-card-title>
          <v-card-text>
            <div class="text-h4">{{ successRate }}%</div>
            <v-progress-linear
              :model-value="successRate"
              :color="getSuccessRateColor(successRate)"
              height="8"
              class="mt-2"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Message Activity Chart -->
    <v-row>
      <v-col cols="12" md="8">
        <v-card>
          <v-card-title class="d-flex align-center">
            Message Activity
            <v-spacer />
            <v-select
              v-model="timeRange"
              :items="timeRanges"
              density="compact"
              hide-details
              class="ml-4"
              style="max-width: 150px"
            />
          </v-card-title>
          <v-card-text>
            <v-chart
              :option="messageActivity"
              autoresize
              style="height: 300px"
            />
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Recent Events -->
      <v-col cols="12" md="4">
        <v-card>
          <v-card-title class="d-flex align-center">
            Recent Events
            <v-spacer />
            <v-btn
              icon="mdi-refresh"
              size="small"
              @click="loadEvents"
              :loading="loading"
            />
          </v-card-title>
          <v-list lines="two">
            <v-list-item
              v-for="(event, index) in recentEvents"
              :key="index"
              :subtitle="new Date(event.timestamp).toLocaleString()"
              :prepend-icon="event.type === 'error' ? 'mdi-alert' : 'mdi-information'"
              :prepend-icon-color="event.type === 'error' ? 'error' : 'info'"
            >
              {{ event.message }}
            </v-list-item>
            <v-list-item v-if="recentEvents.length === 0">
              <v-list-item-title>No recent events</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
    </v-row>

    <!-- Active Modems Table -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title class="d-flex align-center">
            Active Modems
            <v-spacer />
            <v-text-field
              v-model="search"
              append-icon="mdi-magnify"
              label="Search"
              hide-details
              density="compact"
              class="ml-4"
              style="max-width: 300px"
            />
          </v-card-title>

          <v-data-table
            :headers="modemHeaders"
            :items="activeModems"
            :search="search"
            :loading="loading"
          >
            <template v-slot:item.signal="{ item }">
              <v-progress-linear
                :model-value="item.raw.signal"
                :color="getSignalColor(item.raw.signal)"
                height="20"
              >
                <template v-slot:default="{ value }">
                  <strong>{{ Math.ceil(value) }}%</strong>
                </template>
              </v-progress-linear>
            </template>

            <template v-slot:item.actions="{ item }">
              <v-btn
                icon
                variant="text"
                :loading="item.raw.resetting"
                @click="resetModem(item.raw)"
                :title="'Reset ' + item.raw.model"
              >
                <v-icon>mdi-refresh</v-icon>
              </v-btn>
              <v-btn
                icon
                variant="text"
                @click="showModemDetails(item.raw)"
                :title="'View details for ' + item.raw.model"
              >
                <v-icon>mdi-information</v-icon>
              </v-btn>
              <v-btn
                icon
                variant="text"
                color="primary"
                @click="showModemConfig(item.raw)"
                :title="'Configure ' + item.raw.model"
              >
                <v-icon>mdi-cog</v-icon>
              </v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Modem Details Dialog -->
    <v-dialog v-model="detailsDialog" max-width="800px">
      <v-card v-if="selectedModem">
        <v-card-title>
          {{ selectedModem.model }} Details
          <v-spacer />
          <v-btn icon @click="detailsDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-card-text>
          <v-tabs v-model="activeTab">
            <v-tab value="info">Information</v-tab>
            <v-tab value="signal">Signal History</v-tab>
            <v-tab value="messages">Messages</v-tab>
          </v-tabs>

          <v-window v-model="activeTab">
            <v-window-item value="info">
              <v-list>
                <v-list-item>
                  <v-list-item-title>IMEI</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedModem.imei }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Operator</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedModem.operator }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Messages Today</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedModem.messagesProcessed }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Success Rate</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedModem.successRate }}%</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Network Mode</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedModem.networkMode }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Active Bands</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip-group>
                      <v-chip
                        v-for="band in selectedModem.activeBands"
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
            </v-window-item>

            <v-window-item value="signal">
              <v-chart
                :option="signalHistory"
                autoresize
                style="height: 300px"
              />
            </v-window-item>

            <v-window-item value="messages">
              <v-data-table
                :headers="messageHeaders"
                :items="selectedModem.recentMessages || []"
                :loading="loadingMessages"
              >
                <template v-slot:item.status="{ item }">
                  <v-chip
                    :color="getStatusColor(item.raw.status)"
                    size="small"
                  >
                    {{ item.raw.status }}
                  </v-chip>
                </template>
              </v-data-table>
            </v-window-item>
          </v-window>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted } from 'vue';
import { useStore } from 'vuex';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, BarChart } from 'echarts/charts';
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
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent
]);

export default defineComponent({
  name: 'Dashboard',
  components: { VChart },

  setup() {
    const store = useStore();
    const loading = ref(false);
    const loadingMessages = ref(false);
    const search = ref('');
    const detailsDialog = ref(false);
    const selectedModem = ref<any>(null);
    const activeTab = ref('info');
    const timeRange = ref('24h');

    const systemStatus = computed(() => store.state.systemStatus);
    const activeModems = computed(() => store.state.modems.filter((m: any) => m.status === 'online'));
    const activePlugins = computed(() => store.state.plugins.filter((p: any) => p.enabled).length);
    const totalPlugins = computed(() => store.state.plugins.length);
    const messagesToday = computed(() => store.state.statistics.summary?.totalMessages || 0);
    const messagesTrend = computed(() => store.state.statistics.summary?.messagesTrend || 0);
    const successRate = computed(() => store.state.statistics.summary?.successRate || 0);

    const messageActivity = computed(() => ({
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: store.state.statistics.messageVolume?.labels || []
      },
      yAxis: {
        type: 'value'
      },
      series: [{
        data: store.state.statistics.messageVolume?.data || [],
        type: 'bar',
        smooth: true
      }]
    }));

    const signalHistory = computed(() => ({
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
        smooth: true
      }]
    }));

    const modemHeaders = [
      { title: 'Model', key: 'model' },
      { title: 'Operator', key: 'operator' },
      { title: 'Signal', key: 'signal' },
      { title: 'Messages Today', key: 'messagesProcessed' },
      { title: 'Success Rate', key: 'successRate', suffix: '%' },
      { title: 'Actions', key: 'actions', sortable: false }
    ];

    const recentEvents = computed(() => store.state.events || []);

    const showModemDetails = (modem: any) => {
      selectedModem.value = modem;
      detailsDialog.value = true;
    };

    const resetModem = async (modem: any) => {
      modem.resetting = true;
      try {
        await window.api.resetModem(modem.id);
      } catch (error) {
        console.error('Failed to reset modem:', error);
      } finally {
        modem.resetting = false;
      }
    };

    const getSuccessRateColor = (rate: number): string => {
      if (rate >= 90) return 'success';
      if (rate >= 70) return 'warning';
      return 'error';
    };

    const getSignalColor = (signal: number): string => {
      if (signal >= 70) return 'success';
      if (signal >= 40) return 'warning';
      return 'error';
    };

    const getStatusColor = (status: string): string => {
      if (status === 'sent') return 'success';
      if (status === 'received') return 'info';
      return 'error';
    };

    const timeRanges = [
      { text: '24h', value: '24h' },
      { text: '7d', value: '7d' },
      { text: '30d', value: '30d' }
    ];

    const messageHeaders = [
      { title: 'Status', key: 'status' },
      { title: 'Message', key: 'message' },
      { title: 'Timestamp', key: 'timestamp' }
    ];

    const showModemConfig = (modem: any) => {
      // Implement modem configuration dialog
    };

    const loadEvents = async () => {
      loading.value = true;
      try {
        await store.dispatch('loadEvents');
      } catch (error) {
        console.error('Failed to load events:', error);
      } finally {
        loading.value = false;
      }
    };

    onMounted(async () => {
      loading.value = true;
      try {
        await store.dispatch('loadStatistics', '24h');
      } catch (error) {
        console.error('Failed to load statistics:', error);
      } finally {
        loading.value = false;
      }
    });

    return {
      loading,
      loadingMessages,
      search,
      timeRange,
      detailsDialog,
      selectedModem,
      activeTab,
      systemStatus,
      activeModems,
      messagesToday,
      messagesTrend,
      successRate,
      messageActivity,
      recentEvents,
      modemHeaders,
      messageHeaders,
      signalHistory,
      timeRanges,
      showModemDetails,
      showModemConfig,
      resetModem,
      loadEvents,
      getSuccessRateColor,
      getSignalColor,
      getStatusColor
    };
  }
});
</script>

<style scoped>
.v-card-title {
  font-size: 1.1rem;
}

.text-h4 {
  font-weight: 500;
}

.v-list-item-subtitle {
  white-space: pre-wrap;
}
</style> 