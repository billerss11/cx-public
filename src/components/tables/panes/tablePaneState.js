import { ref } from 'vue';

export const activeTableTabKey = ref('casing');
export const isTablesAccordionOpen = ref(false);
export const pendingTableRowFocus = ref(null);

export function setActiveTableTabKey(tabKey) {
  activeTableTabKey.value = tabKey;
}

export function setTablesAccordionOpen(isOpen) {
  isTablesAccordionOpen.value = isOpen;
}

export function requestTableRowFocus(tableType, rowIndex) {
  if (!tableType || !Number.isInteger(rowIndex) || rowIndex < 0) return;
  pendingTableRowFocus.value = {
    tableType,
    rowIndex,
    requestId: `${tableType}:${rowIndex}:${Date.now()}`
  };
}

export function clearPendingTableRowFocus(requestId) {
  const currentRequest = pendingTableRowFocus.value;
  if (!currentRequest) return;
  if (requestId && currentRequest.requestId !== requestId) return;
  pendingTableRowFocus.value = null;
}
