<template>
  <div class="d-flex align-center">
    <v-chip
      :color="statusColor"
      small
      class="mr-2"
    >
      {{ statusText }}
    </v-chip>
    <v-tooltip bottom>
      <template v-slot:activator="{ on, attrs }">
        <div v-bind="attrs" v-on="on">
          <v-badge
            :content="activeModems.toString()"
            :color="activeModems > 0 ? 'success' : 'grey'"
            overlap
          >
            <v-icon>mdi-cellphone-link</v-icon>
          </v-badge>
        </div>
      </template>
      <span>Active Modems</span>
    </v-tooltip>

    <v-tooltip bottom>
      <template v-slot:activator="{ on, attrs }">
        <div v-bind="attrs" v-on="on" class="ml-4">
          <v-badge
            :content="messagesProcessed.toString()"
            color="primary"
            overlap
          >
            <v-icon>mdi-message-processing</v-icon>
          </v-badge>
        </div>
      </template>
      <span>Messages Processed Today</span>
    </v-tooltip>

    <v-tooltip bottom>
      <template v-slot:activator="{ on, attrs }">
        <div v-bind="attrs" v-on="on" class="ml-4">
          <v-chip
            small
            :color="successRateColor"
          >
            {{ successRate }}%
          </v-chip>
        </div>
      </template>
      <span>Success Rate</span>
    </v-tooltip>

    <v-dialog
      v-model="errorDialog"
      max-width="500px"
      v-if="error"
    >
      <template v-slot:activator="{ on, attrs }">
        <v-btn
          icon
          color="error"
          v-if="error"
          v-bind="attrs"
          v-on="on"
          class="ml-2"
        >
          <v-icon>mdi-alert</v-icon>
        </v-btn>
      </template>
      <v-card>
        <v-card-title>System Error</v-card-title>
        <v-card-text>
          <v-alert
            type="error"
            text
          >
            {{ error }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="primary"
            text
            @click="errorDialog = false"
          >
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref } from 'vue';
import { useStore } from 'vuex';

export default defineComponent({
  name: 'SystemStatus',

  setup() {
    const store = useStore();
    const errorDialog = ref(false);

    const connected = computed(() => store.state.system.connected);
    const activeModems = computed(() => store.state.system.activeModems);
    const messagesProcessed = computed(() => store.state.system.messagesProcessed);
    const successRate = computed(() => store.state.system.successRate);
    const error = computed(() => store.state.system.error);

    const statusColor = computed(() => {
      if (error.value) return 'error';
      if (!connected.value) return 'warning';
      return 'success';
    });

    const statusText = computed(() => {
      if (error.value) return 'Error';
      if (!connected.value) return 'Disconnected';
      return 'Connected';
    });

    const successRateColor = computed(() => {
      const rate = successRate.value;
      if (rate >= 95) return 'success';
      if (rate >= 80) return 'warning';
      return 'error';
    });

    return {
      errorDialog,
      connected,
      activeModems,
      messagesProcessed,
      successRate,
      error,
      statusColor,
      statusText,
      successRateColor
    };
  }
});
</script> 