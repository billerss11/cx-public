import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';
import { useInteractionStore } from '@/stores/interactionStore.js';
import { usePlotElementsStore } from '@/stores/plotElementsStore.js';
import { pinia } from '@/stores/pinia.js';

const projectDataStore = useProjectDataStore(pinia);
const viewConfigStore = useViewConfigStore(pinia);
const interactionStore = useInteractionStore(pinia);
const plotElementsStore = usePlotElementsStore(pinia);
const runtimeState = {
    get casingData() {
        return projectDataStore.casingData ?? [];
    },
    get tubingData() {
        return projectDataStore.tubingData ?? [];
    },
    get drillStringData() {
        return projectDataStore.drillStringData ?? [];
    },
    get equipmentData() {
        return projectDataStore.equipmentData ?? [];
    },
    get horizontalLines() {
        return projectDataStore.horizontalLines ?? [];
    },
    get annotationBoxes() {
        return projectDataStore.annotationBoxes ?? [];
    },
    get userAnnotations() {
        return projectDataStore.userAnnotations ?? [];
    },
    get cementPlugs() {
        return projectDataStore.cementPlugs ?? [];
    },
    get annulusFluids() {
        return projectDataStore.annulusFluids ?? [];
    },
    get markers() {
        return projectDataStore.markers ?? [];
    },
    get topologySources() {
        return projectDataStore.topologySources ?? [];
    },
    get trajectory() {
        return projectDataStore.trajectory ?? [];
    },
    get physicsIntervals() {
        return projectDataStore.physicsIntervals ?? [];
    },
    get config() {
        return viewConfigStore.config ?? {};
    },
    get interaction() {
        return interactionStore.interaction ?? {};
    }
};

let importerModulePromise = null;
let importerWorkerModulePromise = null;
let exportsModulePromise = null;

function getImporterModule() {
    if (!importerModulePromise) {
        importerModulePromise = import('@/composables/useImporter.js');
    }
    return importerModulePromise;
}

function getImporterWorkerModule() {
    if (!importerWorkerModulePromise) {
        importerWorkerModulePromise = import('@/composables/useImporterWorker.js');
    }
    return importerWorkerModulePromise;
}

function getExportsModule() {
    if (!exportsModulePromise) {
        exportsModulePromise = import('@/app/exports.js');
    }
    return exportsModulePromise;
}

function getPlotElement(...args) {
    return plotElementsStore.getPlotElement(...args);
}

function setData(key, value, options = {}) {
    void options;
    return projectDataStore.setProjectData(key, value);
}

function setConfigValue(key, value, options = {}) {
    void options;
    viewConfigStore.setConfigValue(key, value);
    return value;
}

function updateConfig(patch, options = {}) {
    void options;
    viewConfigStore.updateConfig(patch);
}

function setInteractionValue(key, value, options = {}) {
    void options;
    interactionStore.setInteractionValue(key, value);
    return value;
}

function setAutoGenerate(value, options = {}) {
    void options;
    interactionStore.setAutoGenerate(value);
    return value;
}

export {
    runtimeState,
    getExportsModule,
    getImporterModule,
    getImporterWorkerModule,
    getPlotElement,
    setData,
    setAutoGenerate,
    setConfigValue,
    setInteractionValue,
    updateConfig
};
