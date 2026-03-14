<script setup>
import Dialog from 'primevue/dialog';
import { computed } from 'vue';
import SurfaceFocusPanel from '@/components/surface/SurfaceFocusPanel.vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  topologyResult: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['update:visible']);

const dialogVisible = computed({
  get: () => props.visible === true,
  set: (value) => emit('update:visible', value === true)
});
</script>

<template>
  <Dialog
    v-model:visible="dialogVisible"
    data-vue-owned="true"
    class="surface-focus-dialog"
    :modal="false"
    :draggable="true"
    :style="{ width: 'min(1200px, 96vw)' }"
  >
    <template #header>
      <span>Surface Focus</span>
    </template>
    <SurfaceFocusPanel :topology-result="topologyResult" />
  </Dialog>
</template>

<style scoped>
:deep(.surface-focus-dialog .p-dialog-content) {
  max-height: 78vh;
  overflow: auto;
}
</style>
