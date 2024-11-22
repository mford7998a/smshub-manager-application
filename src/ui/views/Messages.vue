<template>
  <v-container fluid>
    <!-- Message Composition -->
    <v-row>
      <v-col cols="12" lg="4">
        <v-card>
          <v-card-title>
            New Message
            <v-spacer></v-spacer>
            <v-btn
              color="primary"
              :loading="sending"
              :disabled="!isValidMessage"
              @click="sendMessage"
            >
              Send
            </v-btn>
          </v-card-title>
          <v-card-text>
            <v-form ref="messageForm">
              <v-select
                v-model="newMessage.modemId"
                :items="availableModems"
                item-text="label"
                item-value="id"
                label="Select Modem"
                :rules="[v => !!v || 'Modem is required']"
              ></v-select>

              <v-text-field
                v-model="newMessage.recipient"
                label="Recipient Number"
                :rules="[
                  v => !!v || 'Number is required',
                  v => /^\+?[\d-]+$/.test(v) || 'Invalid phone number'
                ]"
              ></v-text-field>

              <v-textarea
                v-model="newMessage.message"
                label="Message"
                counter
                maxlength="160"
                :rules="[
                  v => !!v || 'Message is required',
                  v => v.length <= 160 || 'Message too long'
                ]"
              ></v-textarea>

              <v-select
                v-model="newMessage.priority"
                :items="priorityOptions"
                label="Priority"
              ></v-select>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Message Queue -->
      <v-col cols="12" lg="8">
        <v-card>
          <v-card-title>
            Message Queue
            <v-spacer></v-spacer>
            <v-text-field
              v-model="search"
              append-icon="mdi-magnify"
              label="Search"
              single-line
              hide-details
              class="mx-4"
            ></v-text-field>
            <v-btn-toggle v-model="timeRange" mandatory>
              <v-btn value="1h">1h</v-btn>
              <v-btn value="24h">24h</v-btn>
              <v-btn value="7d">7d</v-btn>
              <v-btn value="30d">30d</v-btn>
            </v-btn-toggle>
          </v-card-title>

          <v-data-table
            :headers="headers"
            :items="messages"
            :search="search"
            :loading="loading"
            :items-per-page="15"
            :footer-props="{
              'items-per-page-options': [15, 30, 50, 100]
            }"
          >
            <!-- Status Column -->
            <template v-slot:item.status="{ item }">
              <v-chip :color="getStatusColor(item.status)" small>
                {{ item.status }}
              </v-chip>
            </template>

            <!-- Timestamp Column -->
            <template v-slot:item.timestamp="{ item }">
              {{ formatDate(item.timestamp) }}
            </template>

            <!-- Actions Column -->
            <template v-slot:item.actions="{ item }">
              <v-btn
                icon
                small
                @click="resendMessage(item)"
                :disabled="!canResend(item)"
                :loading="item.resending"
              >
                <v-icon>mdi-refresh</v-icon>
              </v-btn>
              <v-btn
                icon
                small
                @click="showMessageDetails(item)"
              >
                <v-icon>mdi-information</v-icon>
              </v-btn>
              <v-btn
                icon
                small
                @click="deleteMessage(item)"
                :disabled="item.deleting"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Message Details Dialog -->
    <v-dialog v-model="detailDialog" max-width="600px">
      <v-card>
        <v-card-title>
          Message Details
          <v-spacer></v-spacer>
          <v-btn icon @click="detailDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <v-list dense>
            <v-list-item>
              <v-list-item-content>
                <v-list-item-title>Modem</v-list-item-title>
                <v-list-item-subtitle>{{ selectedMessage?.modemId }}</v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>

            <v-list-item>
              <v-list-item-content>
                <v-list-item-title>Recipient</v-list-item-title>
                <v-list-item-subtitle>{{ selectedMessage?.recipient }}</v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>

            <v-list-item>
              <v-list-item-content>
                <v-list-item-title>Message</v-list-item-title>
                <v-list-item-subtitle>{{ selectedMessage?.message }}</v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>

            <v-list-item>
              <v-list-item-content>
                <v-list-item-title>Status</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip :color="getStatusColor(selectedMessage?.status)" small>
                    {{ selectedMessage?.status }}
                  </v-chip>
                </v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>

            <v-list-item v-if="selectedMessage?.error">
              <v-list-item-content>
                <v-list-item-title>Error</v-list-item-title>
                <v-list-item-subtitle class="error--text">
                  {{ selectedMessage.error }}
                </v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>

            <v-list-item>
              <v-list-item-content>
                <v-list-item-title>Timestamp</v-list-item-title>
                <v-list-item-subtitle>
                  {{ formatDate(selectedMessage?.timestamp) }}
                </v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, watch } from 'vue';
import { format } from 'date-fns';

export default defineComponent({
  name: 'Messages',

  setup() {
    // State
    const loading = ref(false);
    const sending = ref(false);
    const search = ref('');
    const timeRange = ref('24h');
    const messages = ref([]);
    const detailDialog = ref(false);
    const selectedMessage = ref<any>(null);
    const messageForm = ref<any>(null);

    const newMessage = ref({
      modemId: '',
      recipient: '',
      message: '',
      priority: 'normal'
    });

    // Options
    const priorityOptions = [
      { text: 'High', value: 'high' },
      { text: 'Normal', value: 'normal' },
      { text: 'Low', value: 'low' }
    ];

    const headers = [
      { text: 'Modem', value: 'modemId' },
      { text: 'Recipient', value: 'recipient' },
      { text: 'Message', value: 'message' },
      { text: 'Status', value: 'status' },
      { text: 'Time', value: 'timestamp' },
      { text: 'Actions', value: 'actions', sortable: false }
    ];

    // Computed
    const isValidMessage = computed(() => {
      return (
        newMessage.value.modemId &&
        /^\+?[\d-]+$/.test(newMessage.value.recipient) &&
        newMessage.value.message &&
        newMessage.value.message.length <= 160
      );
    });

    const availableModems = computed(() => {
      // TODO: Get from store
      return [];
    });

    // Methods
    const loadMessages = async () => {
      loading.value = true;
      try {
        messages.value = await window.api.getMessages({
          timeRange: timeRange.value
        });
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        loading.value = false;
      }
    };

    const sendMessage = async () => {
      if (!messageForm.value.validate()) return;

      sending.value = true;
      try {
        await window.api.sendMessage(
          newMessage.value.modemId,
          newMessage.value.recipient,
          newMessage.value.message,
          { priority: newMessage.value.priority }
        );

        // Reset form
        newMessage.value = {
          modemId: '',
          recipient: '',
          message: '',
          priority: 'normal'
        };
        messageForm.value.reset();

        // Refresh messages
        await loadMessages();
      } catch (error) {
        console.error('Failed to send message:', error);
      } finally {
        sending.value = false;
      }
    };

    const resendMessage = async (message: any) => {
      message.resending = true;
      try {
        await window.api.resendMessage(message.id);
        await loadMessages();
      } catch (error) {
        console.error('Failed to resend message:', error);
      } finally {
        message.resending = false;
      }
    };

    const deleteMessage = async (message: any) => {
      if (!confirm('Are you sure you want to delete this message?')) {
        return;
      }

      message.deleting = true;
      try {
        await window.api.deleteMessage(message.id);
        await loadMessages();
      } catch (error) {
        console.error('Failed to delete message:', error);
      }
    };

    const showMessageDetails = (message: any) => {
      selectedMessage.value = message;
      detailDialog.value = true;
    };

    // Utility functions
    const getStatusColor = (status: string): string => {
      const colors: Record<string, string> = {
        sent: 'success',
        received: 'success',
        pending: 'warning',
        failed: 'error'
      };
      return colors[status] || 'grey';
    };

    const formatDate = (date: string | Date): string => {
      return format(new Date(date), 'MMM d, HH:mm:ss');
    };

    const canResend = (message: any): boolean => {
      return message.status === 'failed';
    };

    // Watch for time range changes
    watch(timeRange, () => {
      loadMessages();
    });

    // Initial load
    onMounted(() => {
      loadMessages();
    });

    return {
      loading,
      sending,
      search,
      timeRange,
      messages,
      newMessage,
      detailDialog,
      selectedMessage,
      messageForm,
      priorityOptions,
      headers,
      availableModems,
      isValidMessage,
      sendMessage,
      resendMessage,
      deleteMessage,
      showMessageDetails,
      getStatusColor,
      formatDate,
      canResend
    };
  }
});
</script>

<style scoped>
.v-card {
  margin-bottom: 16px;
}
</style> 