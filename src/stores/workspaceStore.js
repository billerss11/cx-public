import { defineStore } from 'pinia';

const ACTIVITY_TO_VIEW = Object.freeze({
    design: 'DesignWorkspace',
    analysis: 'AnalysisWorkspace',
    settings: 'SettingsWorkspace'
});

const UI_STATE_STORAGE_KEY = 'workspaceUiStateV1';
const LEFT_DOCK_MIN_WIDTH = 240;
const LEFT_DOCK_MAX_WIDTH = 520;
const DEFAULT_LEFT_DOCK_WIDTH = 300;
const DEFAULT_LEFT_DOCK_VISIBLE = true;
const RIGHT_DOCK_MIN_WIDTH = 280;
const RIGHT_DOCK_MAX_WIDTH = 560;
const DEFAULT_RIGHT_DOCK_WIDTH = 340;
const DEFAULT_RIGHT_DOCK_VISIBLE = true;
const RIGHT_DOCK_EDITOR_MODES = Object.freeze({
    common: 'common',
    advanced: 'advanced'
});
const DEFAULT_RIGHT_DOCK_EDITOR_MODE = RIGHT_DOCK_EDITOR_MODES.common;
const BOTTOM_DOCK_MIN_HEIGHT = 120;
const DEFAULT_BOTTOM_DOCK_HEIGHT = 280;
const DEFAULT_BOTTOM_DOCK_VISIBLE = true;
const BOTTOM_DOCK_MODES = Object.freeze({
    docked: 'docked',
    floating: 'floating'
});
const DEFAULT_BOTTOM_DOCK_MODE = BOTTOM_DOCK_MODES.docked;

function normalizeActivityId(activityId) {
    if (typeof activityId !== 'string') return '';
    return activityId.trim().toLowerCase();
}

function resolveRightDockWidthBounds() {
    const dynamicMax = typeof window === 'undefined'
        ? RIGHT_DOCK_MAX_WIDTH
        : Math.max(RIGHT_DOCK_MIN_WIDTH, Math.round(window.innerWidth * 0.55));
    return {
        min: RIGHT_DOCK_MIN_WIDTH,
        max: Math.min(RIGHT_DOCK_MAX_WIDTH, dynamicMax)
    };
}

function resolveLeftDockWidthBounds() {
    const dynamicMax = typeof window === 'undefined'
        ? LEFT_DOCK_MAX_WIDTH
        : Math.max(LEFT_DOCK_MIN_WIDTH, Math.round(window.innerWidth * 0.45));
    return {
        min: LEFT_DOCK_MIN_WIDTH,
        max: Math.min(LEFT_DOCK_MAX_WIDTH, dynamicMax)
    };
}

function normalizeLeftDockWidth(value, fallback = DEFAULT_LEFT_DOCK_WIDTH) {
    const bounds = resolveLeftDockWidthBounds();
    const fallbackNumber = Number.isFinite(Number(fallback))
        ? Number(fallback)
        : DEFAULT_LEFT_DOCK_WIDTH;
    const safeFallback = Math.round(Math.max(bounds.min, Math.min(bounds.max, fallbackNumber)));

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return safeFallback;
    return Math.round(Math.max(bounds.min, Math.min(bounds.max, numeric)));
}

function normalizeLeftDockVisibility(value) {
    return value !== false;
}

function normalizeRightDockWidth(value, fallback = DEFAULT_RIGHT_DOCK_WIDTH) {
    const bounds = resolveRightDockWidthBounds();
    const fallbackNumber = Number.isFinite(Number(fallback))
        ? Number(fallback)
        : DEFAULT_RIGHT_DOCK_WIDTH;
    const safeFallback = Math.round(Math.max(bounds.min, Math.min(bounds.max, fallbackNumber)));

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return safeFallback;
    return Math.round(Math.max(bounds.min, Math.min(bounds.max, numeric)));
}

function normalizeRightDockVisibility(value) {
    return value !== false;
}

function resolveBottomDockHeightBounds() {
    const dynamicMax = typeof window === 'undefined'
        ? 560
        : Math.max(BOTTOM_DOCK_MIN_HEIGHT, Math.round(window.innerHeight * 0.8));
    return {
        min: BOTTOM_DOCK_MIN_HEIGHT,
        max: dynamicMax
    };
}

function normalizeBottomDockHeight(value, fallback = DEFAULT_BOTTOM_DOCK_HEIGHT) {
    const bounds = resolveBottomDockHeightBounds();
    const fallbackNumber = Number.isFinite(Number(fallback))
        ? Number(fallback)
        : DEFAULT_BOTTOM_DOCK_HEIGHT;
    const safeFallback = Math.round(Math.max(bounds.min, Math.min(bounds.max, fallbackNumber)));

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return safeFallback;
    return Math.round(Math.max(bounds.min, Math.min(bounds.max, numeric)));
}

function normalizeBottomDockVisibility(value) {
    return value !== false;
}

function normalizeBottomDockMode(value) {
    return value === BOTTOM_DOCK_MODES.floating
        ? BOTTOM_DOCK_MODES.floating
        : BOTTOM_DOCK_MODES.docked;
}

function normalizeRightDockEditorMode(value) {
    return value === RIGHT_DOCK_EDITOR_MODES.advanced
        ? RIGHT_DOCK_EDITOR_MODES.advanced
        : RIGHT_DOCK_EDITOR_MODES.common;
}

function normalizeLeftTreeExpandedKeys(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.entries(value).reduce((next, [key, isExpanded]) => {
        const normalizedKey = String(key ?? '').trim();
        if (!normalizedKey || isExpanded !== true) return next;
        next[normalizedKey] = true;
        return next;
    }, {});
}

function normalizeHierarchySelectionRef(value) {
    if (!value || typeof value !== 'object') return null;
    const wellId = String(value.wellId ?? '').trim();
    const entityType = String(value.entityType ?? '').trim();
    const rowId = String(value.rowId ?? '').trim();
    if (!wellId || !entityType || !rowId) return null;
    return {
        wellId,
        entityType,
        rowId
    };
}

function createDefaultUiState() {
    return {
        leftDockVisible: DEFAULT_LEFT_DOCK_VISIBLE,
        leftDockWidth: DEFAULT_LEFT_DOCK_WIDTH,
        leftTreeExpandedKeys: {},
        rightDockVisible: DEFAULT_RIGHT_DOCK_VISIBLE,
        rightDockWidth: DEFAULT_RIGHT_DOCK_WIDTH,
        rightDockEditorMode: DEFAULT_RIGHT_DOCK_EDITOR_MODE,
        bottomDockVisible: DEFAULT_BOTTOM_DOCK_VISIBLE,
        bottomDockHeight: DEFAULT_BOTTOM_DOCK_HEIGHT,
        bottomDockMode: DEFAULT_BOTTOM_DOCK_MODE
    };
}

function readPersistedUiState() {
    if (typeof localStorage === 'undefined') {
        return createDefaultUiState();
    }

    try {
        const raw = localStorage.getItem(UI_STATE_STORAGE_KEY);
        if (!raw) {
            return createDefaultUiState();
        }

        const parsed = JSON.parse(raw);
        return {
            leftDockVisible: normalizeLeftDockVisibility(parsed?.leftDockVisible),
            leftDockWidth: normalizeLeftDockWidth(parsed?.leftDockWidth, DEFAULT_LEFT_DOCK_WIDTH),
            leftTreeExpandedKeys: normalizeLeftTreeExpandedKeys(parsed?.leftTreeExpandedKeys),
            rightDockVisible: normalizeRightDockVisibility(parsed?.rightDockVisible),
            rightDockWidth: normalizeRightDockWidth(parsed?.rightDockWidth, DEFAULT_RIGHT_DOCK_WIDTH),
            rightDockEditorMode: normalizeRightDockEditorMode(parsed?.rightDockEditorMode),
            bottomDockVisible: normalizeBottomDockVisibility(parsed?.bottomDockVisible),
            bottomDockHeight: normalizeBottomDockHeight(parsed?.bottomDockHeight, DEFAULT_BOTTOM_DOCK_HEIGHT),
            bottomDockMode: normalizeBottomDockMode(parsed?.bottomDockMode)
        };
    } catch (_error) {
        return createDefaultUiState();
    }
}

function persistUiState(state) {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(
            UI_STATE_STORAGE_KEY,
            JSON.stringify({
                leftDockVisible: normalizeLeftDockVisibility(state.leftDockVisible),
                leftDockWidth: normalizeLeftDockWidth(state.leftDockWidth, DEFAULT_LEFT_DOCK_WIDTH),
                leftTreeExpandedKeys: normalizeLeftTreeExpandedKeys(state.leftTreeExpandedKeys),
                rightDockVisible: normalizeRightDockVisibility(state.rightDockVisible),
                rightDockWidth: normalizeRightDockWidth(state.rightDockWidth, DEFAULT_RIGHT_DOCK_WIDTH),
                rightDockEditorMode: normalizeRightDockEditorMode(state.rightDockEditorMode),
                bottomDockVisible: normalizeBottomDockVisibility(state.bottomDockVisible),
                bottomDockHeight: normalizeBottomDockHeight(state.bottomDockHeight, DEFAULT_BOTTOM_DOCK_HEIGHT),
                bottomDockMode: normalizeBottomDockMode(state.bottomDockMode)
            })
        );
    } catch (_error) {
        // Ignore storage write failures (private mode or policy restrictions).
    }
}

export const useWorkspaceStore = defineStore('workspace', {
    state: () => {
        const persistedUiState = readPersistedUiState();
        return {
            currentActivity: 'design',
            activePanelId: 'workflow',
            cachedViews: ['DesignWorkspace'],
            leftDockVisible: persistedUiState.leftDockVisible,
            leftDockWidth: persistedUiState.leftDockWidth,
            leftTreeExpandedKeys: persistedUiState.leftTreeExpandedKeys,
            rightDockVisible: persistedUiState.rightDockVisible,
            rightDockWidth: persistedUiState.rightDockWidth,
            rightDockEditorMode: persistedUiState.rightDockEditorMode,
            selectedHierarchyRef: null,
            bottomDockVisible: persistedUiState.bottomDockVisible,
            bottomDockHeight: persistedUiState.bottomDockHeight,
            bottomDockMode: persistedUiState.bottomDockMode
        };
    },
    actions: {
        switchActivity(activityId) {
            const normalized = normalizeActivityId(activityId);
            if (!normalized || !(normalized in ACTIVITY_TO_VIEW)) return false;
            if (this.currentActivity === normalized) return false;

            this.currentActivity = normalized;
            this.activePanelId = normalized === 'analysis'
                ? 'analysis-overview'
                : normalized === 'settings'
                    ? 'settings-general'
                    : 'workflow';
            const viewName = ACTIVITY_TO_VIEW[normalized];
            if (viewName && !this.cachedViews.includes(viewName)) {
                this.cachedViews = [...this.cachedViews, viewName];
            }
            return true;
        },
        setLeftDockVisibility(visible) {
            const nextVisible = visible === true;
            if (this.leftDockVisible === nextVisible) return false;
            this.leftDockVisible = nextVisible;
            persistUiState(this);
            return true;
        },
        toggleLeftDock(forceVisible = null) {
            const nextVisible = typeof forceVisible === 'boolean'
                ? forceVisible
                : !this.leftDockVisible;
            return this.setLeftDockVisibility(nextVisible);
        },
        setLeftDockWidth(width) {
            const nextWidth = normalizeLeftDockWidth(width, this.leftDockWidth);
            if (this.leftDockWidth === nextWidth) return false;
            this.leftDockWidth = nextWidth;
            persistUiState(this);
            return true;
        },
        reconcileLeftDockWidth() {
            return this.setLeftDockWidth(this.leftDockWidth);
        },
        setLeftTreeExpandedKeys(expandedKeys) {
            const nextExpandedKeys = normalizeLeftTreeExpandedKeys(expandedKeys);
            const currentEntries = Object.keys(this.leftTreeExpandedKeys ?? {});
            const nextEntries = Object.keys(nextExpandedKeys);
            const hasSameShape = currentEntries.length === nextEntries.length
                && currentEntries.every((key) => nextExpandedKeys[key] === true);
            if (hasSameShape) return false;
            this.leftTreeExpandedKeys = nextExpandedKeys;
            persistUiState(this);
            return true;
        },
        setRightDockVisibility(visible) {
            const nextVisible = visible === true;
            if (this.rightDockVisible === nextVisible) return false;
            this.rightDockVisible = nextVisible;
            persistUiState(this);
            return true;
        },
        toggleRightDock(forceVisible = null) {
            const nextVisible = typeof forceVisible === 'boolean'
                ? forceVisible
                : !this.rightDockVisible;
            return this.setRightDockVisibility(nextVisible);
        },
        setRightDockWidth(width) {
            const nextWidth = normalizeRightDockWidth(width, this.rightDockWidth);
            if (this.rightDockWidth === nextWidth) return false;
            this.rightDockWidth = nextWidth;
            persistUiState(this);
            return true;
        },
        reconcileRightDockWidth() {
            return this.setRightDockWidth(this.rightDockWidth);
        },
        setRightDockEditorMode(mode) {
            const nextMode = normalizeRightDockEditorMode(mode);
            if (this.rightDockEditorMode === nextMode) return false;
            this.rightDockEditorMode = nextMode;
            persistUiState(this);
            return true;
        },
        setSelectedHierarchyRef(selectionRef) {
            const nextRef = normalizeHierarchySelectionRef(selectionRef);
            const currentRef = this.selectedHierarchyRef;
            if (
                currentRef?.wellId === nextRef?.wellId
                && currentRef?.entityType === nextRef?.entityType
                && currentRef?.rowId === nextRef?.rowId
            ) {
                return false;
            }
            this.selectedHierarchyRef = nextRef;
            return true;
        },
        clearSelectedHierarchyRef() {
            if (!this.selectedHierarchyRef) return false;
            this.selectedHierarchyRef = null;
            return true;
        },
        setBottomDockVisibility(visible) {
            const nextVisible = visible === true;
            if (this.bottomDockVisible === nextVisible) return false;
            this.bottomDockVisible = nextVisible;
            persistUiState(this);
            return true;
        },
        toggleBottomDock(forceVisible = null) {
            const nextVisible = typeof forceVisible === 'boolean'
                ? forceVisible
                : !this.bottomDockVisible;
            return this.setBottomDockVisibility(nextVisible);
        },
        setBottomDockHeight(height) {
            const nextHeight = normalizeBottomDockHeight(height, this.bottomDockHeight);
            if (this.bottomDockHeight === nextHeight) return false;
            this.bottomDockHeight = nextHeight;
            persistUiState(this);
            return true;
        },
        reconcileBottomDockHeight() {
            return this.setBottomDockHeight(this.bottomDockHeight);
        },
        setBottomDockMode(mode) {
            const nextMode = normalizeBottomDockMode(mode);
            if (this.bottomDockMode === nextMode) return false;
            this.bottomDockMode = nextMode;
            persistUiState(this);
            return true;
        },
        setActivePanelId(panelId) {
            const next = typeof panelId === 'string' ? panelId : null;
            if (this.activePanelId === next) return false;
            this.activePanelId = next;
            return true;
        },
        setCachedViews(viewNames) {
            if (!Array.isArray(viewNames)) return false;
            const normalized = Array.from(new Set(viewNames.filter((name) => typeof name === 'string' && name.trim())));
            const hasDesign = normalized.includes('DesignWorkspace');
            const next = hasDesign ? normalized : ['DesignWorkspace', ...normalized];
            if (next.length === this.cachedViews.length && next.every((name, index) => name === this.cachedViews[index])) {
                return false;
            }
            this.cachedViews = next;
            return true;
        }
    }
});

export {
    ACTIVITY_TO_VIEW,
    LEFT_DOCK_MIN_WIDTH,
    RIGHT_DOCK_MIN_WIDTH,
    RIGHT_DOCK_EDITOR_MODES,
    BOTTOM_DOCK_MIN_HEIGHT,
    BOTTOM_DOCK_MODES
};
