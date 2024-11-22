<template>
  <v-form ref="form" v-model="valid">
    <template v-for="(field, key) in schema.properties" :key="key">
      <!-- Text Input -->
      <v-text-field
        v-if="field.type === 'string' && !field.enum"
        v-model="formData[key]"
        :label="field.description || key"
        :rules="createRules(field)"
        :required="isRequired(key)"
      ></v-text-field>

      <!-- Number Input -->
      <v-text-field
        v-else-if="field.type === 'number' || field.type === 'integer'"
        v-model.number="formData[key]"
        type="number"
        :label="field.description || key"
        :rules="createRules(field)"
        :required="isRequired(key)"
        :min="field.minimum"
        :max="field.maximum"
        :step="field.type === 'integer' ? 1 : 'any'"
      ></v-text-field>

      <!-- Select Input -->
      <v-select
        v-else-if="field.enum"
        v-model="formData[key]"
        :items="field.enum"
        :label="field.description || key"
        :rules="createRules(field)"
        :required="isRequired(key)"
      ></v-select>

      <!-- Boolean Input -->
      <v-switch
        v-else-if="field.type === 'boolean'"
        v-model="formData[key]"
        :label="field.description || key"
      ></v-switch>

      <!-- Array Input -->
      <template v-else-if="field.type === 'array'">
        <v-subheader>{{ field.description || key }}</v-subheader>
        <v-card outlined class="pa-3 mb-3">
          <div v-for="(item, index) in formData[key]" :key="index" class="d-flex align-center">
            <v-text-field
              v-model="formData[key][index]"
              :label="`Item ${index + 1}`"
              :rules="createRules(field.items)"
            ></v-text-field>
            <v-btn
              icon
              small
              class="ml-2"
              @click="removeArrayItem(key, index)"
            >
              <v-icon>mdi-delete</v-icon>
            </v-btn>
          </div>
          <v-btn
            small
            text
            color="primary"
            @click="addArrayItem(key)"
          >
            Add Item
          </v-btn>
        </v-card>
      </template>

      <!-- Object Input -->
      <template v-else-if="field.type === 'object'">
        <v-subheader>{{ field.description || key }}</v-subheader>
        <v-card outlined class="pa-3 mb-3">
          <dynamic-form
            :schema="field"
            v-model="formData[key]"
            @input="handleNestedInput(key, $event)"
          ></dynamic-form>
        </v-card>
      </template>
    </template>
  </v-form>
</template>

<script lang="ts">
import { defineComponent, ref, reactive, watch, PropType } from 'vue';

interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  description?: string;
  minimum?: number;
  maximum?: number;
  enum?: any[];
  items?: any;
}

export default defineComponent({
  name: 'DynamicForm',

  props: {
    schema: {
      type: Object as PropType<JSONSchema>,
      required: true
    },
    modelValue: {
      type: Object,
      default: () => ({})
    }
  },

  emits: ['update:modelValue', 'validation'],

  setup(props, { emit }) {
    const form = ref<any>(null);
    const valid = ref(true);
    const formData = reactive<Record<string, any>>({});

    // Initialize form data
    watch(() => props.modelValue, (newValue) => {
      Object.assign(formData, newValue);
    }, { immediate: true });

    // Watch for form data changes
    watch(formData, (newValue) => {
      emit('update:modelValue', { ...newValue });
    }, { deep: true });

    // Watch validation state
    watch(valid, (newValue) => {
      emit('validation', newValue);
    });

    const isRequired = (key: string): boolean => {
      return props.schema.required?.includes(key) || false;
    };

    const createRules = (field: any): ((v: any) => boolean | string)[] => {
      const rules: ((v: any) => boolean | string)[] = [];

      if (isRequired(field)) {
        rules.push(v => !!v || 'Field is required');
      }

      if (field.type === 'number' || field.type === 'integer') {
        if (field.minimum !== undefined) {
          rules.push(v => v >= field.minimum || `Minimum value is ${field.minimum}`);
        }
        if (field.maximum !== undefined) {
          rules.push(v => v <= field.maximum || `Maximum value is ${field.maximum}`);
        }
      }

      if (field.pattern) {
        rules.push(v => new RegExp(field.pattern).test(v) || 'Invalid format');
      }

      return rules;
    };

    const addArrayItem = (key: string) => {
      if (!Array.isArray(formData[key])) {
        formData[key] = [];
      }
      formData[key].push('');
    };

    const removeArrayItem = (key: string, index: number) => {
      formData[key].splice(index, 1);
    };

    const handleNestedInput = (key: string, value: any) => {
      formData[key] = value;
    };

    const validate = async (): Promise<boolean> => {
      return form.value?.validate() || false;
    };

    const reset = () => {
      form.value?.reset();
      Object.keys(formData).forEach(key => {
        delete formData[key];
      });
    };

    return {
      form,
      valid,
      formData,
      isRequired,
      createRules,
      addArrayItem,
      removeArrayItem,
      handleNestedInput,
      validate,
      reset
    };
  }
});
</script>

<style scoped>
.v-form {
  max-width: 100%;
}
</style> 