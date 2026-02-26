<script setup>
import SchematicViewport from '@/components/schematic/SchematicViewport.vue';
</script>

<template>
  <section class="design-main-stage">
    <SchematicViewport class="design-main-stage__viewport" />
  </section>
</template>

<style scoped>
.design-main-stage {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.design-main-stage__viewport {
  flex: 1 1 auto;
  min-height: 0;
}
</style>
