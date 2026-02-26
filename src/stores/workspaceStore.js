import { defineStore } from 'pinia';

const ACTIVITY_TO_VIEW = Object.freeze({
    design: 'DesignWorkspace',
    analysis: 'AnalysisWorkspace',
    settings: 'SettingsWorkspace'
});

const UI_STATE_STORAGE_KEY = 'workspaceUiStateV1';
const RIGHT_DOCK_MIN_WIDTH = 280;
const RIGHT_DOCK_MAX_WIDTH = 560;
const DEFAULT_RIGHT_DOCK_WIDTH = 340;
const DEFAULT_RIGHT_DOCK_VISIBLE = true;
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

function createDefaultUiState() {
    return {
        rightDockVisible: DEFAULT_RIGHT_DOCK_VISIBLE,
        rightDockWidth: DEFAULT_RIGHT_DOCK_WIDTH,
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
            rightDockVisible: normalizeRightDockVisibility(parsed?.rightDockVisible),
            rightDockWidth: normalizeRightDockWidth(parsed?.rightDockWidth, DEFAULT_RIGHT_DOCK_WIDTH),
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
                rightDockVisible: normalizeRightDockVisibility(state.rightDockVisible),
                rightDockWidth: normalizeRightDockWidth(state.rightDockWidth, DEFAULT_RIGHT_DOCK_WIDTH),
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
            rightDockVisible: persistedUiState.rightDockVisible,
            rightDockWidth: persistedUiState.rightDockWidth,
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

export { ACTIVITY_TO_VIEW, RIGHT_DOCK_MIN_WIDTH, BOTTOM_DOCK_MIN_HEIGHT, BOTTOM_DOCK_MODES };
