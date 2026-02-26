<script setup>
import { onBeforeUnmount, onMounted } from 'vue';
import { bootstrapApplication } from '@/app/bootstrap.js';
import { useInteractionStore } from '@/stores/interactionStore.js';
import { useThemeStore } from '@/stores/themeStore.js';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';
import MainLayout from './layouts/MainLayout.vue';

const viewConfigStore = useViewConfigStore();
const interactionStore = useInteractionStore();
const themeStore = useThemeStore();
let disposeBootstrap = null;

onMounted(() => {
  themeStore.initializeTheme();
  disposeBootstrap = bootstrapApplication(viewConfigStore, interactionStore);
});

onBeforeUnmount(() => {
  themeStore.disposeTheme();
  disposeBootstrap?.();
  disposeBootstrap = null;
});
</script>

<template>
  <div class="container-fluid">
    <MainLayout />
  </div>

  <div id="alertContainer" aria-live="polite" aria-atomic="true"></div>
</template>
