import { DEFAULT_CEMENT_COLOR } from '@/constants/index.js';
import {
    applyTranslations,
    getLanguage,
    getTranslation,
    t,
    translateEnum
} from '@/app/i18n.js';
import { requestSchematicRender } from '@/composables/useSchematicRenderer.js';
import { syncSelectionIndicators } from '@/app/selection.js';
import { runtimeState, setData, setConfigValue } from './runtime/context.js';

function syncPlotTitleForLanguage() {
    const zhDefault = getTranslation('app.plot_title_default', 'zh');
    const enDefault = getTranslation('app.plot_title_default', 'en');
    const currentTitle = String(runtimeState.config.plotTitle || '').trim();
    if (!currentTitle || currentTitle === zhDefault || currentTitle === enDefault) {
        setConfigValue('plotTitle', t('app.plot_title_default'));
    }
}

function translateEnumValuesInState() {
    setData('horizontalLines', runtimeState.horizontalLines.map((row) => ({
        ...row,
        lineStyle: row.lineStyle ? translateEnum('lineStyle', row.lineStyle) : row.lineStyle
    })), { source: 'i18n', silent: true });

    setData('cementPlugs', runtimeState.cementPlugs.map((row) => ({
        ...row,
        type: row.type ? translateEnum('plugType', row.type) : row.type,
        hatchStyle: row.hatchStyle ? translateEnum('hatchStyle', row.hatchStyle) : row.hatchStyle
    })), { source: 'i18n', silent: true });

    setData('markers', runtimeState.markers.map((row) => ({
        ...row,
        type: row.type ? translateEnum('markerType', row.type) : row.type,
        side: row.side ? translateEnum('markerSide', row.side) : row.side
    })), { source: 'i18n', silent: true });

    setData('annulusFluids', runtimeState.annulusFluids.map((row) => ({
        ...row,
        hatchStyle: row.hatchStyle ? translateEnum('hatchStyle', row.hatchStyle) : row.hatchStyle
    })), { source: 'i18n', silent: true });
}

function applySampleTranslations() {
    const updateTextField = (row, field, key) => {
        if (!row || !row.__i18n || !row.__i18n[key]) return;
        row[field] = t(row.__i18n[key]);
    };

    runtimeState.casingData.forEach((row) => updateTextField(row, 'label', 'label'));
    runtimeState.horizontalLines.forEach((row) => updateTextField(row, 'label', 'label'));
    runtimeState.cementPlugs.forEach((row) => updateTextField(row, 'label', 'label'));
    runtimeState.markers.forEach((row) => updateTextField(row, 'label', 'label'));
    runtimeState.annotationBoxes.forEach((row) => {
        updateTextField(row, 'label', 'label');
        updateTextField(row, 'detail', 'detail');
    });
}

function initializeCementColorSelect() {
    const initialColor = runtimeState.config.cementColor || DEFAULT_CEMENT_COLOR;
    setConfigValue('cementColor', initialColor);
}

function applyLanguageUI() {
    applyTranslations();
    document.querySelectorAll('input[name="language"]').forEach((radio) => {
        radio.checked = radio.value === getLanguage();
    });
    initializeCementColorSelect();
    syncPlotTitleForLanguage();
    translateEnumValuesInState();
    applySampleTranslations();

    syncSelectionIndicators();
    requestSchematicRender({ immediate: true });
}

export {
    applyLanguageUI,
    applySampleTranslations,
    initializeCementColorSelect,
    syncPlotTitleForLanguage,
    translateEnumValuesInState
};
