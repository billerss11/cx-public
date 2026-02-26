<script setup>
import { computed } from 'vue';
import { isTablesAccordionOpen, setTablesAccordionOpen } from './panes/tablePaneState.js';
import TablesTabsPanel from './TablesTabsPanel.vue';

setTablesAccordionOpen(false);

const accordionValue = computed({
  get: () => (isTablesAccordionOpen.value ? 'tables' : null),
  set: (nextValue) => {
    setTablesAccordionOpen(nextValue === 'tables');
  }
});
</script>

<template>
  <Accordion v-model:value="accordionValue" :lazy="true" class="side-accordion-panel">
    <AccordionPanel value="tables">
      <AccordionHeader>
        <span data-i18n="ui.sidebar.tables">Data Tables</span>
      </AccordionHeader>
      <AccordionContent>
        <div class="accordion-body">
          <TablesTabsPanel />
        </div>
      </AccordionContent>
    </AccordionPanel>
  </Accordion>
</template>
