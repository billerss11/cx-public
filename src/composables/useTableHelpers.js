import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import { getHotTableHighlight } from '@/composables/useHotTableRegistry.js';
import { t, translateEnum } from '@/app/i18n.js';

let modulesRegistered = false;
const HOT_VIEWPORT_HEIGHT = Object.freeze({
    minVisibleRows: 8,
    maxVisibleRows: 10,
    rowHeight: 28,
    headerHeight: 34,
    framePadding: 18
});

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getAdaptiveTableHeight(rowCount) {
    const normalizedRowCount = Number.isFinite(rowCount)
        ? Math.max(0, Math.floor(rowCount))
        : 0;
    const visibleRows = clamp(
        normalizedRowCount,
        HOT_VIEWPORT_HEIGHT.minVisibleRows,
        HOT_VIEWPORT_HEIGHT.maxVisibleRows
    );

    return HOT_VIEWPORT_HEIGHT.headerHeight
        + (visibleRows * HOT_VIEWPORT_HEIGHT.rowHeight)
        + HOT_VIEWPORT_HEIGHT.framePadding;
}

export function ensureHandsontableModulesRegistered() {
    if (modulesRegistered) return;
    registerAllModules();
    modulesRegistered = true;
}

export function buildBaseHotSettings(rowCount = 0) {
    return {
        rowHeaders: true,
        stretchH: 'all',
        height: getAdaptiveTableHeight(rowCount),
        autoWrapRow: true,
        autoWrapCol: true,
        fillHandle: true,
        fragmentSelection: true,
        copyPaste: true,
        contextMenu: true,
        manualColumnResize: true,
        manualRowResize: true,
        selectionMode: 'multiple',
        licenseKey: 'non-commercial-and-evaluation'
    };
}

export function buildColorRenderer() {
    return function(instance, td, row, col, prop, value) {
        Handsontable.renderers.DropdownRenderer.apply(this, arguments);
        const colorValue = value ?? '';
        const arrow = td.querySelector('.htAutocompleteArrow');
        td.textContent = '';
        const wrapper = document.createElement('div');
        wrapper.style.display = 'inline-flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '6px';

        const swatch = document.createElement('span');
        swatch.style.width = '14px';
        swatch.style.height = '14px';
        swatch.style.borderRadius = '3px';
        swatch.style.border = '1px solid var(--color-swatch-border)';
        swatch.style.backgroundColor = colorValue || 'transparent';
        wrapper.appendChild(swatch);

        const text = document.createElement('span');
        text.textContent = colorValue;
        wrapper.appendChild(text);

        td.appendChild(wrapper);
        if (arrow) {
            td.appendChild(arrow);
        }
        return td;
    };
}

export function buildEnumRenderer(type) {
    return function(instance, td, row, col, prop, value) {
        const translatedValue = translateEnum(type, value);
        const args = Array.from(arguments);
        args[5] = translatedValue;
        Handsontable.renderers.DropdownRenderer.apply(this, args);
        return td;
    };
}

export function normalizeHotChanges(hot, changes, numericFields) {
    if (!hot || !Array.isArray(changes) || !numericFields) return;
    changes.forEach(([row, prop, oldValue, newValue]) => {
        if (!numericFields.has(prop)) return;
        if (newValue === '' || newValue === null || newValue === undefined) {
            if (oldValue !== null) {
                hot.setDataAtRowProp(row, prop, null, 'normalize');
            }
            return;
        }
        if (typeof newValue === 'number' && Number.isFinite(newValue)) return;
        const parsed = parseFloat(newValue);
        if (!Number.isFinite(parsed)) {
            hot.setDataAtRowProp(row, prop, null, 'normalize');
            return;
        }
        if (parsed !== newValue) {
            hot.setDataAtRowProp(row, prop, parsed, 'normalize');
        }
    });
}

export function syncLineFontColor(hot, changes) {
    if (!hot || !Array.isArray(changes)) return;
    changes.forEach(([row, prop, oldValue, newValue]) => {
        if (prop === 'color') {
            const currentFont = hot.getDataAtRowProp(row, 'fontColor');
            if (!currentFont || currentFont === oldValue) {
                hot.setDataAtRowProp(row, 'fontColor', newValue, 'colorSync');
            }
        }
        if (prop === 'fontColor' && (!newValue || newValue === '')) {
            const currentColor = hot.getDataAtRowProp(row, 'color');
            hot.setDataAtRowProp(row, 'fontColor', currentColor, 'colorSync');
        }
    });
}

export function syncBoxFontColor(hot, changes) {
    if (!hot || !Array.isArray(changes)) return;
    changes.forEach(([row, prop, oldValue, newValue]) => {
        if (prop === 'color') {
            const currentFont = hot.getDataAtRowProp(row, 'fontColor');
            if (!currentFont || currentFont === oldValue) {
                hot.setDataAtRowProp(row, 'fontColor', newValue, 'colorSync');
            }
        }
        if (prop === 'fontColor' && (!newValue || newValue === '')) {
            const currentColor = hot.getDataAtRowProp(row, 'color');
            hot.setDataAtRowProp(row, 'fontColor', currentColor, 'colorSync');
        }
    });
}

export function applyRowHeaderHighlight(type, row, TH) {
    if (!TH) return;
    if (getHotTableHighlight(type) === row) {
        TH.classList.add('table-row-highlight');
    } else {
        TH.classList.remove('table-row-highlight');
    }
}

export function focusHandsontableRow(instance, rowIndex) {
    if (!instance || !Number.isInteger(rowIndex) || rowIndex < 0) return false;

    const totalRows = Number(instance.countRows?.() ?? 0);
    if (!Number.isInteger(totalRows) || rowIndex >= totalRows) return false;

    if (typeof instance.scrollViewportTo === 'function') {
        instance.scrollViewportTo(rowIndex, 0);
    }

    const totalColumns = Number(instance.countCols?.() ?? 0);
    if (typeof instance.selectCell === 'function' && Number.isInteger(totalColumns) && totalColumns > 0) {
        const lastColumnIndex = totalColumns - 1;
        instance.selectCell(rowIndex, 0, rowIndex, lastColumnIndex, true, false);
    }

    instance.render?.();
    return true;
}

export function buildRequiredCells(requiredProps, extraHandler) {
    const requiredSet = new Set(requiredProps);
    return (row, col, prop) => {
        const cellProperties = extraHandler ? (extraHandler(row, col, prop) || {}) : {};
        const propName = typeof prop === 'string' ? prop : '';
        if (requiredSet.has(propName)) {
            cellProperties.className = cellProperties.className
                ? `${cellProperties.className} required-cell`
                : 'required-cell';
        }
        return cellProperties;
    };
}

export function cloneRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
        if (!row || typeof row !== 'object') return row;
        const next = { ...row };
        if (row.__i18n && typeof row.__i18n === 'object') {
            next.__i18n = { ...row.__i18n };
        }
        return next;
    });
}

function clearSampleKeyIfEdited(row, field, value) {
    if (!row || !row.__i18n || !row.__i18n[field]) return;
    const expected = t(row.__i18n[field]);
    if (String(value ?? '') !== String(expected ?? '')) {
        delete row.__i18n[field];
    }
}

export function applySampleKeyChanges(rows, changes, fields) {
    if (!Array.isArray(changes) || !Array.isArray(fields) || fields.length === 0) return;
    changes.forEach(([row, prop, oldValue, newValue]) => {
        if (!fields.includes(prop)) return;
        clearSampleKeyIfEdited(rows[row], prop, newValue);
    });
}
