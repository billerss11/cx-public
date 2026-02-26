<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import Dialog from 'primevue/dialog';
import Select from 'primevue/select';
import SelectButton from 'primevue/selectbutton';
import { getLanguage, onLanguageChange, t } from '@/app/i18n.js';
import {
  IMPORT_MODE_APPEND_NEW_WELL,
  IMPORT_MODE_REPLACE_ACTIVE,
  importExcelWorkbookFile,
  importTrajectoryCsvFile,
  loadSampleData
} from '@/app/importWorkflows.js';

const IMPORT_KIND_EXCEL = 'excel';
const IMPORT_KIND_TRAJECTORY_CSV = 'trajectory-csv';

const selectedDataSource = ref('sample');
const currentLang = ref(getLanguage());
const isImportScopeDialogVisible = ref(false);
const selectedImportMode = ref(IMPORT_MODE_REPLACE_ACTIVE);
const pendingImportFile = ref(null);
const pendingImportKind = ref(null);
let unsubscribeLanguageChange = null;

const isSampleDataSource = computed(() => selectedDataSource.value === 'sample');
const isExcelDataSource = computed(() => selectedDataSource.value === 'excel');
const isCsvDataSource = computed(() => selectedDataSource.value === 'csv');

const dataSourceOptions = Object.freeze([
  { value: 'sample', i18nKey: 'ui.data_source.sample' },
  { value: 'excel', i18nKey: 'ui.data_source.excel' },
  { value: 'csv', i18nKey: 'ui.data_source.csv' }
]);

const localizedDataSourceOptions = computed(() => {
  // Touch currentLang so PrimeVue overlay options recompute on locale switch.
  void currentLang.value;
  return dataSourceOptions.map((option) => ({
    ...option,
    label: t(option.i18nKey)
  }));
});

const excelChooseLabel = computed(() => (currentLang.value === 'zh' ? 'Select Excel' : 'Select Excel'));
const csvChooseLabel = computed(() => (currentLang.value === 'zh' ? 'Select CSV' : 'Select CSV'));
const selectedDataSourceOption = computed(() => (
  localizedDataSourceOptions.value.find((option) => option.value === selectedDataSource.value) ?? null
));
const importScopeOptions = computed(() => ([
  { value: IMPORT_MODE_REPLACE_ACTIVE, label: t('ui.import_scope.replace_active') },
  { value: IMPORT_MODE_APPEND_NEW_WELL, label: t('ui.import_scope.append_new_well') }
]));

function handleLoadSampleData() {
  loadSampleData();
}

function queueImportWithScope(file, kind) {
  pendingImportFile.value = file;
  pendingImportKind.value = kind;
  selectedImportMode.value = IMPORT_MODE_REPLACE_ACTIVE;
  isImportScopeDialogVisible.value = true;
}

async function handleExcelFileChange(eventOrFiles) {
  const file = eventOrFiles?.files?.[0] ?? eventOrFiles?.target?.files?.[0];
  if (!file) return;
  queueImportWithScope(file, IMPORT_KIND_EXCEL);
}

async function handleTrajectoryCsvChange(eventOrFiles) {
  const file = eventOrFiles?.files?.[0] ?? eventOrFiles?.target?.files?.[0];
  if (!file) return;
  queueImportWithScope(file, IMPORT_KIND_TRAJECTORY_CSV);
}

function closeImportScopeDialog() {
  isImportScopeDialogVisible.value = false;
  pendingImportFile.value = null;
  pendingImportKind.value = null;
}

async function confirmImportScopeSelection() {
  const file = pendingImportFile.value;
  const kind = pendingImportKind.value;
  const mode = selectedImportMode.value;

  if (!file || !kind) {
    closeImportScopeDialog();
    return;
  }

  if (kind === IMPORT_KIND_EXCEL) {
    await importExcelWorkbookFile(file, { mode });
  } else {
    await importTrajectoryCsvFile(file, { mode });
  }

  closeImportScopeDialog();
}

onMounted(() => {
  currentLang.value = getLanguage();
  unsubscribeLanguageChange = onLanguageChange((lang) => {
    currentLang.value = lang;
  });
});

onBeforeUnmount(() => {
  unsubscribeLanguageChange?.();
  unsubscribeLanguageChange = null;
});
</script>

<template>
  <Card class="control-group">
    <template #content>
      <div class="section-title" data-i18n="ui.data_management">Data Inputs</div>
      <small class="control-helper" data-i18n="ui.data_management_helper">Load a project baseline, then refine assumptions in the next section.</small>

      <div class="mb-3 mt-2">
        <label class="form-label" data-i18n="ui.select_data_source">Select Data Source:</label>
        <Select
          input-id="dataSource"
          v-model="selectedDataSource"
          :options="localizedDataSourceOptions"
          option-label="label"
          option-value="value"
          class="w-100"
        >
          <template #value="slotProps">
            <span v-if="selectedDataSourceOption">{{ selectedDataSourceOption.label }}</span>
            <span v-else>{{ slotProps.placeholder }}</span>
          </template>
          <template #option="slotProps">
            <span>{{ slotProps.option.label }}</span>
          </template>
        </Select>
      </div>

      <div class="mb-3" v-show="isSampleDataSource">
        <Button class="w-100" @click="handleLoadSampleData">
          <i class="pi pi-file-check me-1"></i>
          <span data-i18n="ui.load_sample">Load Sample Data</span>
        </Button>
      </div>

      <div class="mb-3" v-show="isExcelDataSource">
        <label class="form-label" data-i18n="ui.upload_excel">Upload Excel File:</label>
        <FileUpload
          mode="basic"
          name="excelFile"
          data-vue-owned="true"
          accept=".xlsx,.xls"
          :choose-label="excelChooseLabel"
          class="w-100"
          @select="handleExcelFileChange"
        />
        <small class="text-muted" data-i18n="ui.excel_help">Excel workbook with casing-related sheets.</small>
      </div>

      <div class="mb-3" v-show="isCsvDataSource">
        <label class="form-label" data-i18n="ui.trajectory_csv_label">Trajectory CSV:</label>
        <FileUpload
          mode="basic"
          name="trajectoryCsv"
          data-vue-owned="true"
          accept=".csv"
          :choose-label="csvChooseLabel"
          class="w-100"
          @select="handleTrajectoryCsvChange"
        />
      </div>

      <Dialog
        v-model:visible="isImportScopeDialogVisible"
        modal
        :draggable="false"
        :header="t('ui.import_scope.title')"
        :style="{ width: 'min(92vw, 30rem)' }"
      >
        <div class="d-grid gap-2">
          <p class="mb-0 fw-semibold">{{ t('ui.import_scope.label') }}</p>
          <SelectButton
            v-model="selectedImportMode"
            :options="importScopeOptions"
            option-label="label"
            option-value="value"
          />
        </div>

        <template #footer>
          <div class="d-flex justify-content-end gap-2">
            <Button text :label="t('ui.cancel')" @click="closeImportScopeDialog" />
            <Button :label="t('ui.confirm')" @click="confirmImportScopeSelection" />
          </div>
        </template>
      </Dialog>
    </template>
  </Card>
</template>
