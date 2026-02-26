<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import MultiSelect from 'primevue/multiselect';
import Select from 'primevue/select';
import SelectButton from 'primevue/selectbutton';
import SplitButton from 'primevue/splitbutton';
import DataManagementControls from '@/components/controls/DataManagementControls.vue';
import { onLanguageChange, t } from '@/app/i18n.js';
import {
  downloadEditedWorkbook,
  downloadExcelTemplate,
  saveProjectFileAs,
  saveActiveWellProjectFile,
  saveProjectFile
} from '@/app/exportWorkflows.js';
import { showAlert } from '@/app/alerts.js';
import {
  appendSelectedWellsFromProjectPayload,
  importProjectJsonContent,
  importProjectJsonFile,
  parseProjectJsonContentToV3,
  parseProjectJsonFileToV3,
  resetData
} from '@/app/importWorkflows.js';
import { useProjectStore } from '@/stores/projectStore.js';

const EXCEL_EXPORT_SCOPE_ACTIVE_WELL = 'active-well';
const EXCEL_EXPORT_SCOPE_ALL_WELLS = 'all-wells';

const projectStore = useProjectStore();
const replaceProjectFileInput = ref(null);
const appendProjectFileInput = ref(null);
const isDataManagementVisible = ref(false);
const isProjectDetailsDialogVisible = ref(false);
const isNewWellDialogVisible = ref(false);
const isExcelExportDialogVisible = ref(false);
const isReplaceProjectConfirmVisible = ref(false);
const isAppendWellsDialogVisible = ref(false);
const isDeleteWellConfirmVisible = ref(false);
const languageTick = ref(0);
const newWellName = ref('');
const selectedExcelExportScope = ref(EXCEL_EXPORT_SCOPE_ACTIVE_WELL);
const createWellAttempted = ref(false);
const pendingReplaceProjectFile = ref(null);
const importedProjectPreview = ref(null);
const importedProjectFileName = ref('');
const selectedImportedWellIds = ref([]);
const projectDetailsProjectName = ref('');
const projectDetailsAuthorName = ref('');
const projectDetailsWellName = ref('');
const projectDetailsAttempted = ref(false);
const isSaveInProgress = ref(false);

let unsubscribeLanguageChange = null;

const labels = computed(() => {
  void languageTick.value;
  return {
    save: t('ui.project_save'),
    saveShortcut: t('ui.project_save_shortcut'),
    saveStatusSaved: t('ui.project_status_saved'),
    saveStatusDirty: t('ui.project_status_dirty'),
    dataManagement: t('ui.data_management'),
    projectDetails: t('ui.project_details'),
    projectDetailsTitle: t('ui.project_details_title'),
    projectNameLabel: t('ui.project_name_label'),
    authorNameLabel: t('ui.author_name_label'),
    activeWellNameLabel: t('ui.active_well_name_label'),
    activeWell: t('ui.well_selector'),
    newWell: t('ui.new_well'),
    newWellDialogTitle: t('ui.new_well_dialog_title'),
    newWellName: t('ui.new_well_name_label'),
    deleteWellConfirmTitle: t('ui.delete_well_confirm_title'),
    exportDialogTitle: t('ui.export_excel_scope_title'),
    exportDialogLabel: t('ui.export_excel_scope_label'),
    replaceConfirmTitle: t('ui.project_load_replace_confirm_title'),
    replaceConfirmMessage: t('ui.project_load_replace_confirm_body'),
    appendWellsTitle: t('ui.import_wells_dialog_title'),
    appendWellsLabel: t('ui.import_wells_dialog_label'),
    appendWellsSelection: t('ui.import_wells_selected_count', { count: selectedImportedWellIds.value.length }),
    confirm: t('ui.confirm'),
    cancel: t('ui.cancel')
  };
});

const projectActionItems = computed(() => {
  void languageTick.value;
  return [
    {
      label: t('ui.project_save_as'),
      icon: 'pi pi-save',
      command: handleSaveAs
    },
    { separator: true },
    {
      label: t('ui.project_details'),
      icon: 'pi pi-pencil',
      command: openProjectDetailsDialog
    },
    {
      label: t('ui.project_load_replace'),
      icon: 'pi pi-folder-open',
      command: triggerReplaceProjectLoad
    },
    {
      label: t('ui.project_import_wells'),
      icon: 'pi pi-file-import',
      command: triggerAppendWellsImport
    },
    {
      label: t('ui.export_active_well_project'),
      icon: 'pi pi-download',
      command: handleExportActiveWellProject
    },
    { separator: true },
    {
      label: t('ui.reset'),
      icon: 'pi pi-refresh',
      command: resetData
    }
  ];
});

const dataActionItems = computed(() => {
  void languageTick.value;
  return [
    {
      label: t('ui.export_excel'),
      icon: 'pi pi-file-excel',
      command: openExcelExportDialog
    },
    {
      label: t('ui.download_excel_template'),
      icon: 'pi pi-table',
      command: downloadExcelTemplate
    }
  ];
});

const excelExportScopeOptions = computed(() => {
  void languageTick.value;
  return [
    {
      value: EXCEL_EXPORT_SCOPE_ACTIVE_WELL,
      label: t('ui.export_excel_scope.active')
    },
    {
      value: EXCEL_EXPORT_SCOPE_ALL_WELLS,
      label: t('ui.export_excel_scope.all')
    }
  ];
});

const importedWellOptions = computed(() => {
  const wells = importedProjectPreview.value?.wells || [];
  return wells.map((well) => ({
    label: well.name,
    value: well.id
  }));
});

const canAppendSelectedWells = computed(() => selectedImportedWellIds.value.length > 0);
const wellOptions = computed(() => projectStore.wellOptions ?? []);
const activeWellName = computed(() => String(projectStore.activeWell?.name ?? '').trim());
const canDuplicateActiveWell = computed(() => Boolean(projectStore.activeWellId));
const canDeleteActiveWell = computed(() => (
  Boolean(projectStore.activeWellId) && wellOptions.value.length > 1
));
const wellActionItems = computed(() => {
  void languageTick.value;
  return [
    {
      label: t('ui.duplicate_well'),
      icon: 'pi pi-copy',
      disabled: !canDuplicateActiveWell.value,
      command: handleDuplicateActiveWell
    },
    {
      label: t('ui.delete_well'),
      icon: 'pi pi-trash',
      disabled: !canDeleteActiveWell.value,
      command: openDeleteWellConfirm
    }
  ];
});
const deleteWellConfirmMessage = computed(() => (
  t('ui.delete_well_confirm_body', { name: activeWellName.value || t('common.unnamed') })
));
const hasUnsavedChanges = computed(() => projectStore.hasUnsavedChanges === true);
const saveStatusText = computed(() => (
  hasUnsavedChanges.value ? labels.value.saveStatusDirty : labels.value.saveStatusSaved
));
const saveStatusClassName = computed(() => (
  hasUnsavedChanges.value
    ? 'workspace-project-actions__save-status workspace-project-actions__save-status--dirty'
    : 'workspace-project-actions__save-status workspace-project-actions__save-status--saved'
));

const activeWellIdModel = computed({
  get: () => projectStore.activeWellId ?? null,
  set: (wellId) => {
    if (!wellId) return;
    projectStore.setActiveWell(wellId);
  }
});

const trimmedNewWellName = computed(() => String(newWellName.value ?? '').trim());
const isNewWellNamePresent = computed(() => trimmedNewWellName.value.length > 0);
const isNewWellNameUnique = computed(() => {
  if (!isNewWellNamePresent.value) return false;
  return projectStore.isWellNameUnique(trimmedNewWellName.value);
});
const canCreateNewWell = computed(() => isNewWellNamePresent.value && isNewWellNameUnique.value);

const newWellValidationMessage = computed(() => {
  if (!createWellAttempted.value) return '';
  if (!isNewWellNamePresent.value) {
    return t('ui.new_well_error_required');
  }
  if (!isNewWellNameUnique.value) {
    return t('ui.new_well_error_duplicate');
  }
  return '';
});

const trimmedProjectDetailsWellName = computed(() => String(projectDetailsWellName.value ?? '').trim());
const projectDetailsWellNamePresent = computed(() => trimmedProjectDetailsWellName.value.length > 0);
const projectDetailsWellNameUnique = computed(() => {
  if (!projectDetailsWellNamePresent.value) return false;
  return projectStore.isWellNameUnique(
    trimmedProjectDetailsWellName.value,
    projectStore.activeWellId ?? null
  );
});
const canSaveProjectDetails = computed(() => (
  projectDetailsWellNamePresent.value && projectDetailsWellNameUnique.value
));
const projectDetailsWellNameError = computed(() => {
  if (!projectDetailsAttempted.value) return '';
  if (!projectDetailsWellNamePresent.value) {
    return t('ui.project_details_error_well_required');
  }
  if (!projectDetailsWellNameUnique.value) {
    return t('ui.project_details_error_well_duplicate');
  }
  return '';
});

function isTextInputLikeElement(element) {
  if (!(element instanceof HTMLElement)) return false;
  const tag = element.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return element.isContentEditable === true;
}

function getNativeProjectFileBridge() {
  if (typeof window === 'undefined') return null;
  const bridge = window.cxApp;
  if (!bridge || typeof bridge !== 'object') return null;
  if (typeof bridge.openProjectJsonFile !== 'function') return null;
  return bridge;
}

function hasNativeProjectSaveBridge() {
  if (typeof window === 'undefined') return false;
  const bridge = window.cxApp;
  if (!bridge || typeof bridge !== 'object') return false;
  return (
    typeof bridge.saveProjectAs === 'function'
    || typeof bridge.saveProjectToPath === 'function'
  );
}

function isMissingProjectOpenHandlerError(error) {
  const message = String(error?.message ?? '');
  if (!message) return false;
  return message.includes("No handler registered for 'cx:project:open-json'");
}

function normalizeNativeProjectSelection(selection = {}) {
  return {
    filePath: String(selection?.filePath ?? '').trim() || null,
    fileName: String(selection?.fileName ?? '').trim(),
    content: String(selection?.content ?? '')
  };
}

async function runSaveAction(action) {
  if (isSaveInProgress.value || typeof action !== 'function') return false;
  isSaveInProgress.value = true;
  try {
    return await action();
  } finally {
    isSaveInProgress.value = false;
  }
}

async function handleSave() {
  return runSaveAction(() => saveProjectFile());
}

async function handleSaveAs() {
  return runSaveAction(() => saveProjectFileAs());
}

function handleGlobalProjectShortcut(event) {
  const key = String(event?.key ?? '').trim().toLowerCase();
  const hasModifier = event?.ctrlKey === true || event?.metaKey === true;
  if (!hasModifier || event?.altKey === true) return;
  if (event?.repeat === true) return;
  if (isTextInputLikeElement(event?.target) || isTextInputLikeElement(document.activeElement)) return;

  if (key === 's') {
    event.preventDefault();
    handleSave();
    return;
  }

  if (key === 'i') {
    event.preventDefault();
    triggerReplaceProjectLoad();
  }
}

async function triggerReplaceProjectLoad() {
  const bridge = getNativeProjectFileBridge();
  if (!bridge) {
    if (hasNativeProjectSaveBridge()) {
      showAlert(t('alert.project_load_path_unavailable'), 'warn');
    }
    replaceProjectFileInput.value?.click();
    return;
  }

  try {
    const selection = await bridge.openProjectJsonFile();
    if (!selection || selection.canceled === true) return;
    pendingReplaceProjectFile.value = {
      kind: 'native',
      ...normalizeNativeProjectSelection(selection)
    };
    isReplaceProjectConfirmVisible.value = true;
  } catch (error) {
    if (isMissingProjectOpenHandlerError(error)) {
      showAlert(t('alert.project_load_path_unavailable'), 'warn');
      replaceProjectFileInput.value?.click();
      return;
    }
    showAlert(`${t('alert.project_load_failed')}: ${error.message}`, 'danger');
  }
}

function clearPendingReplaceProjectFile() {
  pendingReplaceProjectFile.value = null;
}

function handleReplaceProjectFileChange(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  const filePath = String(file?.path ?? '').trim();
  pendingReplaceProjectFile.value = {
    kind: 'file',
    file,
    hasNativePath: filePath.length > 0
  };
  isReplaceProjectConfirmVisible.value = true;
  event.target.value = '';
}

function cancelReplaceProjectLoad() {
  isReplaceProjectConfirmVisible.value = false;
  clearPendingReplaceProjectFile();
}

async function confirmReplaceProjectLoad() {
  const pendingLoad = pendingReplaceProjectFile.value;
  if (!pendingLoad) {
    cancelReplaceProjectLoad();
    return;
  }

  let imported = false;
  if (pendingLoad.kind === 'native') {
    imported = await importProjectJsonContent(pendingLoad.content, {
      filePath: pendingLoad.filePath,
      fileName: pendingLoad.fileName
    });
  } else {
    imported = await importProjectJsonFile(pendingLoad.file);
    if (imported && pendingLoad.hasNativePath !== true) {
      showAlert(t('alert.project_load_path_unavailable'), 'warn');
    }
  }
  cancelReplaceProjectLoad();
}

function openAppendWellsDialogFromProject(project, fileName = '') {
  importedProjectPreview.value = project;
  importedProjectFileName.value = String(fileName ?? '').trim();
  selectedImportedWellIds.value = (project.wells || []).map((well) => well.id);
  isAppendWellsDialogVisible.value = true;
}

async function triggerAppendWellsImport() {
  const bridge = getNativeProjectFileBridge();
  if (!bridge) {
    if (hasNativeProjectSaveBridge()) {
      showAlert(t('alert.project_load_path_unavailable'), 'warn');
    }
    appendProjectFileInput.value?.click();
    return;
  }

  try {
    const selection = await bridge.openProjectJsonFile();
    if (!selection || selection.canceled === true) return;
    const normalizedSelection = normalizeNativeProjectSelection(selection);
    const project = parseProjectJsonContentToV3(normalizedSelection.content);
    openAppendWellsDialogFromProject(project, normalizedSelection.fileName);
  } catch (error) {
    if (isMissingProjectOpenHandlerError(error)) {
      showAlert(t('alert.project_load_path_unavailable'), 'warn');
      appendProjectFileInput.value?.click();
      return;
    }
    showAlert(`${t('alert.project_load_failed')}: ${error.message}`, 'danger');
  }
}

function closeAppendWellsDialog() {
  isAppendWellsDialogVisible.value = false;
  importedProjectPreview.value = null;
  importedProjectFileName.value = '';
  selectedImportedWellIds.value = [];
}

async function handleAppendProjectFileChange(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  try {
    const project = await parseProjectJsonFileToV3(file);
    openAppendWellsDialogFromProject(project, file.name);
  } catch (error) {
    showAlert(`${t('alert.project_load_failed')}: ${error.message}`, 'danger');
  } finally {
    event.target.value = '';
  }
}

function confirmAppendSelectedWells() {
  if (!canAppendSelectedWells.value || !importedProjectPreview.value) return;
  appendSelectedWellsFromProjectPayload(importedProjectPreview.value, selectedImportedWellIds.value);
  closeAppendWellsDialog();
}

function openDataManagement() {
  isDataManagementVisible.value = true;
}

function openProjectDetailsDialog() {
  projectDetailsProjectName.value = String(projectStore.projectName ?? '');
  projectDetailsAuthorName.value = String(projectStore.projectAuthor ?? '');
  projectDetailsWellName.value = activeWellName.value;
  projectDetailsAttempted.value = false;
  isProjectDetailsDialogVisible.value = true;
}

function closeProjectDetailsDialog() {
  isProjectDetailsDialogVisible.value = false;
  projectDetailsAttempted.value = false;
}

function confirmProjectDetails() {
  projectDetailsAttempted.value = true;
  if (!canSaveProjectDetails.value) return;

  projectStore.setProjectName(projectDetailsProjectName.value);
  projectStore.setProjectAuthor(projectDetailsAuthorName.value);
  const renameResult = projectStore.renameWell(projectStore.activeWellId, trimmedProjectDetailsWellName.value);
  if (!renameResult?.ok) return;

  closeProjectDetailsDialog();
  showAlert(t('alert.project_details_saved'), 'success');
}

function openNewWellDialog() {
  newWellName.value = '';
  createWellAttempted.value = false;
  isNewWellDialogVisible.value = true;
}

function closeNewWellDialog() {
  isNewWellDialogVisible.value = false;
  createWellAttempted.value = false;
}

function confirmCreateNewWell() {
  createWellAttempted.value = true;
  if (!canCreateNewWell.value) return;

  const result = projectStore.createNewWell(trimmedNewWellName.value);
  if (!result?.ok) return;

  closeNewWellDialog();
  showAlert(t('alert.new_well_created'), 'success');
}

function handleDuplicateActiveWell() {
  if (!canDuplicateActiveWell.value) return;
  const result = projectStore.duplicateWell(projectStore.activeWellId, { activate: true });
  if (!result?.ok) {
    showAlert(t('alert.well_duplicate_failed'), 'danger');
    return;
  }
  showAlert(t('alert.well_duplicated', { name: result.name }), 'success');
}

function openDeleteWellConfirm() {
  if (!canDeleteActiveWell.value) return;
  isDeleteWellConfirmVisible.value = true;
}

function closeDeleteWellConfirm() {
  isDeleteWellConfirmVisible.value = false;
}

function confirmDeleteWell() {
  if (!canDeleteActiveWell.value) {
    closeDeleteWellConfirm();
    return;
  }
  const result = projectStore.deleteWell(projectStore.activeWellId);
  if (!result?.ok) {
    const messageKey = result?.error === 'last_well'
      ? 'alert.well_delete_last_well_blocked'
      : 'alert.well_delete_failed';
    showAlert(t(messageKey), 'danger');
    closeDeleteWellConfirm();
    return;
  }

  showAlert(t('alert.well_deleted', { name: result.deletedWellName || t('common.unnamed') }), 'success');
  closeDeleteWellConfirm();
}

function openExcelExportDialog() {
  selectedExcelExportScope.value = EXCEL_EXPORT_SCOPE_ACTIVE_WELL;
  isExcelExportDialogVisible.value = true;
}

function closeExcelExportDialog() {
  isExcelExportDialogVisible.value = false;
}

function confirmExcelExport() {
  downloadEditedWorkbook({ scope: selectedExcelExportScope.value });
  closeExcelExportDialog();
}

function handleExportActiveWellProject() {
  saveActiveWellProjectFile();
}

onMounted(() => {
  projectStore.ensureInitialized();
  unsubscribeLanguageChange = onLanguageChange(() => {
    languageTick.value += 1;
  });
  window.addEventListener('keydown', handleGlobalProjectShortcut);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalProjectShortcut);
  unsubscribeLanguageChange?.();
  unsubscribeLanguageChange = null;
});
</script>

<template>
  <div class="workspace-project-actions">
    <div class="workspace-project-actions__group workspace-project-actions__group--well">
      <div class="workspace-project-actions__well-switcher">
        <label class="workspace-project-actions__well-label">{{ labels.activeWell }}</label>
        <Select
          v-model="activeWellIdModel"
          :options="wellOptions"
          option-label="label"
          option-value="value"
          size="small"
          class="workspace-project-actions__well-select"
        />
      </div>

      <SplitButton
        type="button"
        size="small"
        severity="success"
        outlined
        icon="pi pi-plus"
        :label="labels.newWell"
        :model="wellActionItems"
        @click="openNewWellDialog"
      />
    </div>

    <div class="workspace-project-actions__group workspace-project-actions__group--project">
      <SplitButton
        type="button"
        size="small"
        severity="success"
        outlined
        icon="pi pi-save"
        :label="labels.save"
        :model="projectActionItems"
        :title="labels.saveShortcut"
        :disabled="isSaveInProgress"
        class="workspace-project-actions__save-control"
        @click="handleSave"
      />
      <span :class="saveStatusClassName">{{ saveStatusText }}</span>
    </div>

    <div class="workspace-project-actions__group workspace-project-actions__group--data">
      <SplitButton
        type="button"
        size="small"
        severity="info"
        outlined
        icon="pi pi-database"
        :label="labels.dataManagement"
        :model="dataActionItems"
        @click="openDataManagement"
      />
    </div>

    <input
      ref="replaceProjectFileInput"
      data-vue-owned="true"
      type="file"
      accept=".json"
      style="display: none;"
      @change="handleReplaceProjectFileChange"
    >

    <input
      ref="appendProjectFileInput"
      data-vue-owned="true"
      type="file"
      accept=".json"
      style="display: none;"
      @change="handleAppendProjectFileChange"
    >

    <Dialog
      v-model:visible="isDataManagementVisible"
      modal
      :draggable="false"
      :header="labels.dataManagement"
      :style="{ width: 'min(94vw, 34rem)' }"
      :content-style="{ paddingTop: '0.35rem' }"
    >
      <DataManagementControls />
    </Dialog>

    <Dialog
      v-model:visible="isProjectDetailsDialogVisible"
      modal
      :draggable="false"
      :header="labels.projectDetailsTitle"
      :style="{ width: 'min(92vw, 30rem)' }"
    >
      <div class="workspace-project-actions__dialog-body">
        <label class="workspace-project-actions__dialog-label">{{ labels.projectNameLabel }}</label>
        <InputText v-model="projectDetailsProjectName" class="w-100" />

        <label class="workspace-project-actions__dialog-label">{{ labels.authorNameLabel }}</label>
        <InputText v-model="projectDetailsAuthorName" class="w-100" />

        <label class="workspace-project-actions__dialog-label">{{ labels.activeWellNameLabel }}</label>
        <InputText
          v-model="projectDetailsWellName"
          class="w-100"
          :invalid="Boolean(projectDetailsWellNameError)"
          @keydown.enter.prevent="confirmProjectDetails"
        />
        <small
          v-if="projectDetailsWellNameError"
          class="workspace-project-actions__dialog-error"
        >
          {{ projectDetailsWellNameError }}
        </small>
      </div>

      <template #footer>
        <div class="workspace-project-actions__dialog-footer">
          <Button text :label="labels.cancel" @click="closeProjectDetailsDialog" />
          <Button :label="labels.confirm" :disabled="!canSaveProjectDetails" @click="confirmProjectDetails" />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="isReplaceProjectConfirmVisible"
      modal
      :draggable="false"
      :header="labels.replaceConfirmTitle"
      :style="{ width: 'min(92vw, 30rem)' }"
    >
      <div class="workspace-project-actions__dialog-body">
        <p class="workspace-project-actions__dialog-label">{{ labels.replaceConfirmMessage }}</p>
      </div>

      <template #footer>
        <div class="workspace-project-actions__dialog-footer">
          <Button text :label="labels.cancel" @click="cancelReplaceProjectLoad" />
          <Button :label="labels.confirm" @click="confirmReplaceProjectLoad" />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="isAppendWellsDialogVisible"
      modal
      :draggable="false"
      :header="labels.appendWellsTitle"
      :style="{ width: 'min(92vw, 34rem)' }"
    >
      <div class="workspace-project-actions__dialog-body">
        <p class="workspace-project-actions__dialog-label">{{ labels.appendWellsLabel }}</p>
        <small class="workspace-project-actions__dialog-meta">{{ importedProjectFileName }}</small>
        <MultiSelect
          v-model="selectedImportedWellIds"
          :options="importedWellOptions"
          option-label="label"
          option-value="value"
          :placeholder="labels.appendWellsLabel"
          display="chip"
          class="w-100"
        />
        <small class="workspace-project-actions__dialog-meta">{{ labels.appendWellsSelection }}</small>
      </div>

      <template #footer>
        <div class="workspace-project-actions__dialog-footer">
          <Button text :label="labels.cancel" @click="closeAppendWellsDialog" />
          <Button :label="labels.confirm" :disabled="!canAppendSelectedWells" @click="confirmAppendSelectedWells" />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="isNewWellDialogVisible"
      modal
      :draggable="false"
      :header="labels.newWellDialogTitle"
      :style="{ width: 'min(92vw, 26rem)' }"
    >
      <div class="workspace-project-actions__dialog-body">
        <label class="workspace-project-actions__dialog-label">{{ labels.newWellName }}</label>
        <InputText
          v-model="newWellName"
          class="w-100"
          :invalid="Boolean(newWellValidationMessage)"
          @keydown.enter.prevent="confirmCreateNewWell"
        />
        <small
          v-if="newWellValidationMessage"
          class="workspace-project-actions__dialog-error"
        >
          {{ newWellValidationMessage }}
        </small>
      </div>

      <template #footer>
        <div class="workspace-project-actions__dialog-footer">
          <Button text :label="labels.cancel" @click="closeNewWellDialog" />
          <Button :label="labels.confirm" :disabled="!canCreateNewWell" @click="confirmCreateNewWell" />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="isDeleteWellConfirmVisible"
      modal
      :draggable="false"
      :header="labels.deleteWellConfirmTitle"
      :style="{ width: 'min(92vw, 30rem)' }"
    >
      <div class="workspace-project-actions__dialog-body">
        <p class="workspace-project-actions__dialog-label">{{ deleteWellConfirmMessage }}</p>
      </div>

      <template #footer>
        <div class="workspace-project-actions__dialog-footer">
          <Button text :label="labels.cancel" @click="closeDeleteWellConfirm" />
          <Button severity="danger" :label="labels.confirm" @click="confirmDeleteWell" />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="isExcelExportDialogVisible"
      modal
      :draggable="false"
      :header="labels.exportDialogTitle"
      :style="{ width: 'min(92vw, 30rem)' }"
    >
      <div class="workspace-project-actions__dialog-body">
        <p class="workspace-project-actions__dialog-label">{{ labels.exportDialogLabel }}</p>
        <SelectButton
          v-model="selectedExcelExportScope"
          :options="excelExportScopeOptions"
          option-label="label"
          option-value="value"
          class="workspace-project-actions__scope-select"
        />
      </div>

      <template #footer>
        <div class="workspace-project-actions__dialog-footer">
          <Button text :label="labels.cancel" @click="closeExcelExportDialog" />
          <Button :label="labels.confirm" @click="confirmExcelExport" />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.workspace-project-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.workspace-project-actions__group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 4px 6px;
  border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--panel-bg, #f8fafc) 92%, transparent);
}

.workspace-project-actions__well-switcher {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.workspace-project-actions__well-label {
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
}

.workspace-project-actions__well-select {
  min-width: 13rem;
}

.workspace-project-actions__save-control {
  flex: 0 0 auto;
}

.workspace-project-actions__save-status {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 0.55rem;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  border: 1px solid transparent;
}

.workspace-project-actions__save-status--saved {
  color: var(--p-green-700, #047857);
  background: color-mix(in srgb, var(--p-green-100, #dcfce7) 85%, transparent);
  border-color: color-mix(in srgb, var(--p-green-400, #4ade80) 45%, transparent);
}

.workspace-project-actions__save-status--dirty {
  color: var(--p-orange-800, #9a3412);
  background: color-mix(in srgb, var(--p-orange-100, #ffedd5) 90%, transparent);
  border-color: color-mix(in srgb, var(--p-orange-400, #fb923c) 45%, transparent);
}

.workspace-project-actions__dialog-body {
  display: grid;
  gap: 0.5rem;
}

.workspace-project-actions__dialog-label {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
}

.workspace-project-actions__dialog-meta {
  color: var(--muted);
  font-size: 0.78rem;
}

.workspace-project-actions__dialog-error {
  color: var(--p-red-500, #b42318);
}

.workspace-project-actions__dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.workspace-project-actions__scope-select :deep(.p-togglebutton) {
  padding-inline: 0.85rem;
}

.workspace-project-actions :deep(.p-button-label) {
  white-space: nowrap;
}
</style>
