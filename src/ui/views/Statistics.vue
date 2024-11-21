<template>
  <div>
    <!-- Time Range and Export Controls -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-text>
            <v-row align="center">
              <v-col cols="auto">
                <v-select
                  v-model="timeRange"
                  :items="timeRanges"
                  label="Time Range"
                  hide-details
                  style="min-width: 200px"
                />
              </v-col>
              <v-col cols="auto">
                <v-btn
                  color="primary"
                  :loading="loading"
                  @click="loadStats"
                >
                  Update
                </v-btn>
              </v-col>
              <v-spacer />
              <v-col cols="auto">
                <v-btn-group>
                  <v-btn
                    prepend-icon="mdi-file-excel"
                    @click="exportData('xlsx')"
                  >
                    Excel
                  </v-btn>
                  <v-btn
                    prepend-icon="mdi-file-delimited"
                    @click="exportData('csv')"
                  >
                    CSV
                  </v-btn>
                  <v-btn
                    prepend-icon="mdi-file-pdf"
                    @click="exportData('pdf')"
                  >
                    PDF
                  </v-btn>
                </v-btn-group>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Summary Cards -->
    <v-row>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-title>Total Messages</v-card-title>
          <v-card-text>
            <div class="text-h4">{{ stats?.summary.totalMessages || 0 }}</div>
            <v-chip
              :color="stats?.summary.messagesTrend >= 0 ? 'success' : 'error'"
              class="mt-2"
            >
              {{ stats?.summary.messagesTrend >= 0 ? '+' : '' }}{{ stats?.summary.messagesTrend || 0 }}% from previous period
            </v-chip>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card>
          <v-card-title>Success Rate</v-card-title>
          <v-card-text>
            <div class="text-h4">{{ stats?.summary.successRate || 0 }}%</div>
            <v-progress-linear
              :model-value="stats?.summary.successRate || 0"
              :color="getSuccessRateColor(stats?.summary.successRate || 0)"
              height="8"
              class="mt-2"
            />
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card>
          <v-card-title>Response Time</v-card-title>
          <v-card-text>
            <div class="text-h4">{{ stats?.summary.avgResponseTime || 0 }}ms</div>
            <v-chip
              :color="stats?.summary.responseTimeTrend <= 0 ? 'success' : 'error'"
              class="mt-2"
            >
              {{ stats?.summary.responseTimeTrend <= 0 ? '+' : '' }}{{ stats?.summary.responseTimeTrend || 0 }}% from previous period
            </v-chip>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card>
          <v-card-title>Modem Utilization</v-card-title>
          <v-card-text>
            <div class="text-h4">{{ stats?.summary.modemUtilization || 0 }}%</div>
            <v-progress-linear
              :model-value="stats?.summary.modemUtilization || 0"
              color="primary"
              height="8"
              class="mt-2"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Charts -->
    <v-row>
      <v-col cols="12" lg="8">
        <v-card>
          <v-card-title>Message Volume</v-card-title>
          <v-card-text>
            <v-chart
              :option="messageVolumeChart"
              autoresize
              style="height: 400px"
            />
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card>
          <v-card-title>Status Distribution</v-card-title>
          <v-card-text>
            <v-chart
              :option="statusDistributionChart"
              autoresize
              style="height: 400px"
            />
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12">
        <v-card>
          <v-card-title>Modem Performance</v-card-title>
          <v-data-table
            :headers="modemHeaders"
            :items="stats?.modemStats || []"
            :loading="loading"
          >
            <template v-slot:item.successRate="{ item }">
              <v-progress-linear
                :model-value="item.raw.successRate"
                :color="getSuccessRateColor(item.raw.successRate)"
                height="20"
              >
                <template v-slot:default>
                  {{ item.raw.successRate }}%
                </template>
              </v-progress-linear>
            </template>

            <template v-slot:item.avgSignal="{ item }">
              <v-progress-linear
                :model-value="item.raw.avgSignal"
                :color="getSignalColor(item.raw.avgSignal)"
                height="20"
              >
                <template v-slot:default>
                  {{ item.raw.avgSignal }}%
                </template>
              </v-progress-linear>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, watch } from 'vue';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  TitleComponent
} from 'echarts/components';
import VChart from 'vue-echarts';

use([
  CanvasRenderer,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  TitleComponent
]);

export default defineComponent({
  name: 'Statistics',
  components: { VChart },

  setup() {
    const loading = ref(false);
    const timeRange = ref('24h');
    const stats = ref<any>(null);

    const timeRanges = [
      { title: 'Last 24 Hours', value: '24h' },
      { title: 'Last 7 Days', value: '7d' },
      { title: 'Last 30 Days', value: '30d' },
      { title: 'Last 90 Days', value: '90d' }
    ];

    const modemHeaders = [
      { title: 'IMEI', key: 'imei' },
      { title: 'Model', key: 'model' },
      { title: 'Messages', key: 'messageCount' },
      { title: 'Success Rate', key: 'successRate' },
      { title: 'Avg Signal', key: 'avgSignal' },
      { title: 'Avg Response Time', key: 'avgResponseTime', suffix: 'ms' }
    ];

    const messageVolumeChart = computed(() => ({
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
        data: stats.value?.messageVolume?.labels || []
      },
      yAxis: {
        type: 'value'
      },
      series: [{
        data: stats.value?.messageVolume?.data || [],
        type: 'line',
        smooth: true,
        areaStyle: {
          opacity: 0.3
        }
      }],
      dataZoom: [{
        type: 'inside',
        start: 0,
        end: 100
      }]
    }));

    const statusDistributionChart = computed(() => ({
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left'
      },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '20',
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: Object.entries(stats.value?.statusDistribution || {}).map(([name, value]) => ({
          name,
          value
        }))
      }]
    }));

    const loadStats = async () => {
      loading.value = true;
      try {
        stats.value = await window.api.getStatistics(timeRange.value);
      } catch (error) {
        console.error('Failed to load statistics:', error);
      } finally {
        loading.value = false;
      }
    };

    const exportData = async (format: string) => {
      try {
        const url = await window.api.exportStatistics(timeRange.value, format);
        const link = document.createElement('a');
        link.href = url;
        link.download = `statistics_${timeRange.value}.${format}`;
        link.click();
      } catch (error) {
        console.error('Failed to export statistics:', error);
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

    watch(timeRange, () => {
      loadStats();
    });

    onMounted(() => {
      loadStats();
    });

    return {
      loading,
      timeRange,
      timeRanges,
      stats,
      modemHeaders,
      messageVolumeChart,
      statusDistributionChart,
      loadStats,
      exportData,
      getSuccessRateColor,
      getSignalColor
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
</style> 