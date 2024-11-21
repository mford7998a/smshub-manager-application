<template>
  <v-dialog v-model="dialog" max-width="600px">
    <v-card>
      <v-card-title>
        Flash Modem Firmware
        <v-spacer />
        <v-btn icon @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text>
        <v-form ref="form" v-model="valid">
          <v-select
            v-model="config.firmwareVersion"
            :items="availableFirmware"
            label="Firmware Version"
            :rules="[v => !!v || 'Firmware version is required']"
            required
          />

          <v-select
            v-model="config.carrier"
            :items="carriers"
            label="Carrier"
            clearable
          />

          <v-text-field
            v-model="config.apn"
            label="APN"
            placeholder="Enter APN"
            clearable
          />

          <v-switch
            v-model="config.forceGeneric"
            label="Force Generic Firmware"
            hint="Use this if carrier-specific firmware is not working"
            persistent-hint
          />

          <v-alert
            v-if="error"
            type="error"
            class="mt-4"
          >
            {{ error }}
          </v-alert>

          <v-alert
            v-if="warning"
            type="warning"
            class="mt-4"
          >
            {{ warning }}
          </v-alert>
        </v-form>
      </v-card-text>

      <v-card-text v-if="flashing">
        <v-progress-linear
          indeterminate
          color="primary"
        />
        <div class="text-center mt-2">
          {{ status }}
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          color="error"
          variant="text"
          :disabled="flashing"
          @click="close"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          :loading="flashing"
          :disabled="!valid"
          @click="flash"
        >
          Flash
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue';

export default defineComponent({
  name: 'AutoflashDialog',

  props: {
    modelValue: {
      type: Boolean,
      required: true
    },
    modem: {
      type: Object,
      required: true
    }
  },

  emits: ['update:modelValue', 'success', 'error'],

  setup(props, { emit }) {
    const dialog = ref(props.modelValue);
    const valid = ref(false);
    const form = ref(null);
    const flashing = ref(false);
    const status = ref('');
    const error = ref('');
    const warning = ref('');

    const config = ref({
      firmwareVersion: '',
      carrier: '',
      apn: '',
      forceGeneric: false
    });

    const availableFirmware = [
      { title: 'v1.2.3 (Latest)', value: '1.2.3' },
      { title: 'v1.2.2', value: '1.2.2' },
      { title: 'v1.2.1', value: '1.2.1' }
    ];

    const carriers = [
      { title: 'AT&T', value: 'att' },
      { title: 'T-Mobile', value: 'tmobile' },
      { title: 'Verizon', value: 'verizon' },
      { title: 'Sprint', value: 'sprint' }
    ];

    watch(() => props.modelValue, (newVal) => {
      dialog.value = newVal;
    });

    watch(dialog, (newVal) => {
      emit('update:modelValue', newVal);
      if (!newVal) {
        resetForm();
      }
    });

    const resetForm = () => {
      if (form.value) {
        form.value.reset();
      }
      config.value = {
        firmwareVersion: '',
        carrier: '',
        apn: '',
        forceGeneric: false
      };
      error.value = '';
      warning.value = '';
      status.value = '';
    };

    const flash = async () => {
      if (!valid.value) return;

      flashing.value = true;
      error.value = '';
      warning.value = '';

      try {
        status.value = 'Downloading firmware...';
        await window.api.flashModem({
          ...config.value,
          type: props.modem.model
        });

        emit('success');
        dialog.value = false;
      } catch (err) {
        error.value = err.message || 'Failed to flash modem';
        emit('error', err);
      } finally {
        flashing.value = false;
        status.value = '';
      }
    };

    const close = () => {
      if (!flashing.value) {
        dialog.value = false;
      }
    };

    return {
      dialog,
      valid,
      form,
      config,
      flashing,
      status,
      error,
      warning,
      availableFirmware,
      carriers,
      flash,
      close
    };
  }
});
</script> 