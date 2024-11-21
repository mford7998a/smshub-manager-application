<template>
  <div>
    <v-row>
      <!-- Message Filters -->
      <v-col cols="12">
        <v-card>
          <v-card-text>
            <v-row align="center">
              <v-col cols="auto">
                <v-select
                  v-model="filter.status"
                  :items="statusFilters"
                  label="Status"
                  clearable
                  hide-details
                />
              </v-col>
              <v-col cols="auto">
                <v-select
                  v-model="filter.modem"
                  :items="modemFilters"
                  label="Modem"
                  clearable
                  hide-details
                />
              </v-col>
              <v-col>
                <v-text-field
                  v-model="filter.search"
                  append-icon="mdi-magnify"
                  label="Search messages"
                  hide-details
                />
              </v-col>
              <v-col cols="auto">
                <v-btn-group>
                  <v-btn
                    prepend-icon="mdi-refresh"
                    :loading="loading"
                    @click="loadMessages"
                  >
                    Refresh
                  </v-btn>
                  <v-btn
                    prepend-icon="mdi-export"
                    @click="exportMessages"
                  >
                    Export
                  </v-btn>
                </v-btn-group>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Message Table -->
      <v-col cols="12">
        <v-card>
          <v-data-table
            :headers="headers"
            :items="filteredMessages"
            :loading="loading"
            :items-per-page="25"
          >
            <template v-slot:item.status="{ item }">
              <v-chip
                :color="getStatusColor(item.raw.status)"
                size="small"
              >
                {{ item.raw.status }}
              </v-chip>
            </template>

            <template v-slot:item.timestamp="{ item }">
              {{ formatDate(item.raw.timestamp) }}
            </template>

            <template v-slot:item.actions="{ item }">
              <v-btn
                icon
                size="small"
                @click="showMessageDetails(item.raw)"
                title="View Details"
              >
                <v-icon>mdi-information</v-icon>
              </v-btn>
              <v-btn
                v-if="item.raw.status === 'failed'"
                icon
                size="small"
                color="warning"
                @click="retryMessage(item.raw)"
                title="Retry"
              >
                <v-icon>mdi-refresh</v-icon>
              </v-btn>
              <v-btn
                icon
                size="small"
                color="error"
                @click="deleteMessage(item.raw)"
                title="Delete"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Message Details Dialog -->
    <v-dialog v-model="detailsDialog" max-width="600px">
      <v-card v-if="selectedMessage">
        <v-card-title>
          Message Details
          <v-spacer />
          <v-btn icon @click="detailsDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-card-text>
          <v-list>
            <v-list-item>
              <v-list-item-title>Sender</v-list-item-title>
              <v-list-item-subtitle>{{ selectedMessage.sender }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Modem</v-list-item-title>
              <v-list-item-subtitle>
                {{ getModemInfo(selectedMessage.modemId) }}
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Received At</v-list-item-title>
              <v-list-item-subtitle>
                {{ formatDate(selectedMessage.timestamp) }}
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Status</v-list-item-title>
              <v-list-item-subtitle>
                <v-chip
                  :color="getStatusColor(selectedMessage.status)"
                  size="small"
                >
                  {{ selectedMessage.status }}
                </v-chip>
                <span v-if="selectedMessage.error" class="text-error ml-2">
                  {{ selectedMessage.error }}
                </span>
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Message</v-list-item-title>
              <v-list-item-subtitle class="mt-2 text-pre-wrap">
                {{ selectedMessage.message }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn
            v-if="selectedMessage.status === 'failed'"
            color="warning"
            @click="retryMessage(selectedMessage)"
          >
            Retry
          </v-btn>
          <v-btn
            color="error"
            @click="deleteMessage(selectedMessage)"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="400px">
      <v-card>
        <v-card-title>Confirm Delete</v-card-title>
        <v-card-text>
          Are you sure you want to delete this message? This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="grey"
            variant="text"
            @click="deleteDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            :loading="deleting"
            @click="confirmDelete"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Export Dialog -->
    <v-dialog v-model="exportDialog" max-width="400px">
      <v-card>
        <v-card-title>Export Messages</v-card-title>
        <v-card-text>
          <v-select
            v-model="exportFormat"
            :items="exportFormats"
            label="Format"
          />
          <v-select
            v-model="exportRange"
            :items="exportRanges"
            label="Time Range"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="grey"
            variant="text"
            @click="exportDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :loading="exporting"
            @click="confirmExport"
          >
            Export
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';

export default defineComponent({
  name: 'Messages',

  setup() {
    const store = useStore();
    const loading = ref(false);
    const deleting = ref(false);
    const exporting = ref(false);
    const detailsDialog = ref(false);
    const deleteDialog = ref(false);
    const exportDialog = ref(false);
    const selectedMessage = ref<any>(null);

    const filter = ref({
      status: '',
      modem: '',
      search: ''
    });

    const exportFormat = ref('csv');
    const exportRange = ref('24h');

    const messages = computed(() => store.state.messages);
    const modems = computed(() => store.state.modems);

    const headers = [
      { title: 'Sender', key: 'sender' },
      { title: 'Message', key: 'message' },
      { title: 'Modem', key: 'modemId' },
      { title: 'Received', key: 'timestamp' },
      { title: 'Status', key: 'status' },
      { title: 'Actions', key: 'actions', sortable: false }
    ];

    const statusFilters = [
      { title: 'All', value: '' },
      { title: 'Received', value: 'received' },
      { title: 'Sent', value: 'sent' },
      { title: 'Pending', value: 'pending' },
      { title: 'Failed', value: 'failed' }
    ];

    const modemFilters = computed(() => [
      { title: 'All', value: '' },
      ...modems.value.map((m: any) => ({
        title: `${m.model} (${m.imei})`,
        value: m.id
      }))
    ]);

    const exportFormats = [
      { title: 'CSV', value: 'csv' },
      { title: 'Excel', value: 'xlsx' },
      { title: 'PDF', value: 'pdf' }
    ];

    const exportRanges = [
      { title: 'Last 24 Hours', value: '24h' },
      { title: 'Last 7 Days', value: '7d' },
      { title: 'Last 30 Days', value: '30d' },
      { title: 'All Time', value: 'all' }
    ];

    const filteredMessages = computed(() => {
      return messages.value.filter((m: any) => {
        if (filter.value.status && m.status !== filter.value.status) return false;
        if (filter.value.modem && m.modemId !== filter.value.modem) return false;
        if (filter.value.search) {
          const search = filter.value.search.toLowerCase();
          return m.sender.toLowerCase().includes(search) ||
                 m.message.toLowerCase().includes(search);
        }
        return true;
      });
    });

    const loadMessages = async () => {
      loading.value = true;
      try {
        await store.dispatch('loadMessages');
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        loading.value = false;
      }
    };

    const showMessageDetails = (message: any) => {
      selectedMessage.value = message;
      detailsDialog.value = true;
    };

    const retryMessage = async (message: any) => {
      try {
        await window.api.retryMessage(message.id);
        await loadMessages();
      } catch (error) {
        console.error('Failed to retry message:', error);
      }
    };

    const deleteMessage = (message: any) => {
      selectedMessage.value = message;
      deleteDialog.value = true;
    };

    const confirmDelete = async () => {
      if (!selectedMessage.value) return;

      deleting.value = true;
      try {
        await window.api.deleteMessage(selectedMessage.value.id);
        deleteDialog.value = false;
        detailsDialog.value = false;
        await loadMessages();
      } catch (error) {
        console.error('Failed to delete message:', error);
      } finally {
        deleting.value = false;
      }
    };

    const exportMessages = () => {
      exportDialog.value = true;
    };

    const confirmExport = async () => {
      exporting.value = true;
      try {
        const url = await window.api.exportMessages(exportRange.value, exportFormat.value);
        const link = document.createElement('a');
        link.href = url;
        link.download = `messages_${exportRange.value}.${exportFormat.value}`;
        link.click();
        exportDialog.value = false;
      } catch (error) {
        console.error('Failed to export messages:', error);
      } finally {
        exporting.value = false;
      }
    };

    const getStatusColor = (status: string): string => {
      switch (status) {
        case 'received': return 'success';
        case 'sent': return 'info';
        case 'pending': return 'warning';
        case 'failed': return 'error';
        default: return 'grey';
      }
    };

    const getModemInfo = (modemId: string): string => {
      const modem = modems.value.find((m: any) => m.id === modemId);
      return modem ? `${modem.model} (${modem.imei})` : modemId;
    };

    const formatDate = (date: string | Date): string => {
      return new Date(date).toLocaleString();
    };

    onMounted(() => {
      loadMessages();
    });

    return {
      loading,
      deleting,
      exporting,
      messages,
      filteredMessages,
      headers,
      filter,
      statusFilters,
      modemFilters,
      detailsDialog,
      deleteDialog,
      exportDialog,
      selectedMessage,
      exportFormat,
      exportRange,
      exportFormats,
      exportRanges,
      loadMessages,
      showMessageDetails,
      retryMessage,
      deleteMessage,
      confirmDelete,
      exportMessages,
      confirmExport,
      getStatusColor,
      getModemInfo,
      formatDate
    };
  }
});
</script>

<style scoped>
.text-pre-wrap {
  white-space: pre-wrap;
}
</style> 