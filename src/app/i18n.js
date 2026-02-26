import zh from '@/locales/zh.json';
import en from '@/locales/en.json';

const TRANSLATIONS = { zh, en };

const ENUM_TRANSLATIONS = {

    lineStyle: {

        solid: { zh: '\u5b9e\u7ebf', en: 'Solid' },

        dashed: { zh: '\u865a\u7ebf', en: 'Dashed' },

        dotted: { zh: '\u70b9\u7ebf', en: 'Dotted' },

        dashdot: { zh: '\u70b9\u5212\u7ebf', en: 'Dash-dot' }

    },

    hatchStyle: {

        none: { zh: '\u65e0', en: 'None' },

        diagonal: { zh: '\u659c\u7ebf', en: 'Diagonal' },

        cross: { zh: '\u4ea4\u53c9\u7ebf', en: 'Cross' },

        dots: { zh: '\u70b9\u72b6', en: 'Dots' },

        grid: { zh: '\u7f51\u683c', en: 'Grid' }

    },

    plugType: {

        cement: { zh: '\u6c34\u6ce5', en: 'Cement' },

        bridge: { zh: '\u6865\u585e', en: 'Bridge plug' }

    },

    markerType: {

        perforation: { zh: '\u5c04\u5b54', en: 'Perforation' },

        leak: { zh: '\u6f0f\u5931', en: 'Leak' }

    },

    targetMode: {

        inner: { zh: '\u81ea\u52a8\uff08\u6700\u5185\u5c42\uff09', en: 'Auto (innermost)' },

        outer: { zh: '\u81ea\u52a8\uff08\u6700\u5916\u5c42\uff09', en: 'Auto (outermost)' },

        by_od: { zh: '\u6309\u5916\u5f84', en: 'By OD' },

        open_hole: { zh: '\u88f8\u773c', en: 'Open hole' }

    },

    markerSide: {

        both: { zh: '\u4e24\u4fa7', en: 'Both sides' },

        left: { zh: '\u5de6\u4fa7', en: 'Left' },

        right: { zh: '\u53f3\u4fa7', en: 'Right' }

    },

    alignment: {

        left: { zh: '\u5de6\u5bf9\u9f50', en: 'Left' },

        center: { zh: '\u5c45\u4e2d', en: 'Center' },

        right: { zh: '\u53f3\u5bf9\u9f50', en: 'Right' }

    },

    linerMode: {

        auto: { zh: '\u81ea\u52a8', en: 'Auto' },

        yes: { zh: '\u662f', en: 'Yes' },

        no: { zh: '\u5426', en: 'No' }

    }

};



const ENUM_ORDER = {

    lineStyle: ['solid', 'dashed', 'dotted', 'dashdot'],

    hatchStyle: ['none', 'diagonal', 'cross', 'dots', 'grid'],

    plugType: ['cement', 'bridge'],

    markerType: ['perforation', 'leak'],

    targetMode: ['inner', 'outer', 'by_od', 'open_hole'],

    markerSide: ['both', 'left', 'right'],

    alignment: ['left', 'center', 'right'],

    linerMode: ['auto', 'yes', 'no']

};



const ENUM_ALIASES = {

    lineStyle: {

        solid: 'solid',

        '\u5b9e\u7ebf': 'solid',

        dashed: 'dashed',

        dash: 'dashed',

        '\u865a\u7ebf': 'dashed',

        dotted: 'dotted',

        dot: 'dotted',

        '\u70b9\u7ebf': 'dotted',

        'dash-dot': 'dashdot',

        'dash dot': 'dashdot',

        dashdot: 'dashdot',

        '\u70b9\u5212\u7ebf': 'dashdot'

    },

    hatchStyle: {

        none: 'none',

        '\u65e0': 'none',

        diagonal: 'diagonal',

        diag: 'diagonal',

        '\u659c\u7ebf': 'diagonal',

        cross: 'cross',

        '\u4ea4\u53c9\u7ebf': 'cross',

        dots: 'dots',

        dotted: 'dots',

        '\u70b9\u72b6': 'dots',

        grid: 'grid',

        '\u7f51\u683c': 'grid'

    },

    plugType: {

        cement: 'cement',

        '\u6c34\u6ce5': 'cement',

        bridge: 'bridge',

        'bridge plug': 'bridge',

        '\u6865\u585e': 'bridge'

    },

    markerType: {

        perforation: 'perforation',

        perf: 'perforation',

        '\u5c04\u5b54': 'perforation',

        leak: 'leak',

        '\u6f0f\u5931': 'leak'

    },

    targetMode: {

        inner: 'inner',

        'auto (innermost)': 'inner',

        '\u81ea\u52a8\uff08\u6700\u5185\u5c42\uff09': 'inner',

        outer: 'outer',

        'auto (outermost)': 'outer',

        '\u81ea\u52a8\uff08\u6700\u5916\u5c42\uff09': 'outer',

        by_od: 'by_od',

        'by od': 'by_od',

        od: 'by_od',

        '\u6309\u5916\u5f84': 'by_od',

        open_hole: 'open_hole',

        'open hole': 'open_hole',

        openhole: 'open_hole',

        '\u88f8\u773c': 'open_hole'

    },

    markerSide: {

        both: 'both',

        'both sides': 'both',

        '\u4e24\u4fa7': 'both',

        left: 'left',

        '\u5de6\u4fa7': 'left',

        right: 'right',

        '\u53f3\u4fa7': 'right'

    },

    alignment: {

        left: 'left',

        '\u5de6\u5bf9\u9f50': 'left',

        center: 'center',

        centre: 'center',

        '\u5c45\u4e2d': 'center',

        right: 'right',

        '\u53f3\u5bf9\u9f50': 'right'

    },

    linerMode: {

        auto: 'auto',

        '\u81ea\u52a8': 'auto',

        yes: 'yes',

        '\u662f': 'yes',

        no: 'no',

        '\u5426': 'no'

    }

};



let currentLang = 'zh';

const listeners = new Set();
const I18N_SELECTOR = '[data-i18n], [data-i18n-html], [data-i18n-title]';
let translationObserver = null;



export function getLanguage() {

    return currentLang;

}



export function setLanguage(lang) {

    if (!TRANSLATIONS[lang]) return;

    currentLang = lang;

    try {

        localStorage.setItem('language', lang);

    } catch (error) {

        // Ignore storage errors.

    }

    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';

    applyTranslations();

    listeners.forEach(listener => listener(lang));

}



export function loadLanguagePreference() {

    try {

        const stored = localStorage.getItem('language');

        if (stored && TRANSLATIONS[stored]) {

            currentLang = stored;

        }

    } catch (error) {

        // Ignore storage errors.

    }

    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';

    return currentLang;

}



export function onLanguageChange(callback) {

    if (typeof callback !== 'function') return () => {};

    listeners.add(callback);

    return () => listeners.delete(callback);

}



export function t(key, vars = {}) {

    const langDict = TRANSLATIONS[currentLang] || TRANSLATIONS.zh;

    const fallbackDict = TRANSLATIONS.zh;

    let value = langDict[key] ?? fallbackDict[key] ?? key;

    if (typeof value !== 'string') {

        return String(value);

    }

    return value.replace(/\{(\w+)\}/g, (match, name) => {

        const replacement = vars[name];

        return replacement === undefined || replacement === null ? match : String(replacement);

    });

}



export function getTranslation(key, lang = 'zh') {

    const dict = TRANSLATIONS[lang] || TRANSLATIONS.zh;

    return dict[key] ?? TRANSLATIONS.zh[key] ?? key;

}



export function applyTranslations(root = document) {

    if (!root) return;

    const elements = [];
    if (root instanceof Element && root.matches(I18N_SELECTOR)) {
        elements.push(root);
    }
    if (typeof root.querySelectorAll === 'function') {
        root.querySelectorAll(I18N_SELECTOR).forEach((el) => {
            elements.push(el);
        });
    }

    elements.forEach((el) => {
        if (el.hasAttribute('data-i18n')) {
            const key = el.getAttribute('data-i18n');
            if (key) {
                const nextText = t(key);
                if (el.textContent !== nextText) {
                    el.textContent = nextText;
                }
            }
        }

        if (el.hasAttribute('data-i18n-html')) {
            const key = el.getAttribute('data-i18n-html');
            if (key) {
                const nextHtml = t(key);
                if (el.innerHTML !== nextHtml) {
                    el.innerHTML = nextHtml;
                }
            }
        }

        if (el.hasAttribute('data-i18n-title')) {
            const key = el.getAttribute('data-i18n-title');
            if (key) {
                const nextTitle = t(key);
                if (el.title !== nextTitle) {
                    el.title = nextTitle;
                }
            }
        }
    });

    const nextDocumentTitle = t('app.title');
    if (document.title !== nextDocumentTitle) {
        document.title = nextDocumentTitle;
    }

}

export function ensureTranslationObserver(root = document.body) {
    if (translationObserver || !root || typeof MutationObserver === 'undefined') {
        return;
    }

    translationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (!(node instanceof Element)) return;
                if (!node.matches(I18N_SELECTOR) && !node.querySelector(I18N_SELECTOR)) return;
                applyTranslations(node);
            });
        });
    });

    translationObserver.observe(root, { childList: true, subtree: true });
}

export function disconnectTranslationObserver() {
    if (!translationObserver) return;
    translationObserver.disconnect();
    translationObserver = null;
}



export function translateEnum(type, value) {

    if (!type) return value ?? '';

    const mapping = ENUM_TRANSLATIONS[type];

    if (!mapping) return value ?? '';

    const normalized = normalizeEnumInput(type, value);

    const entry = mapping[normalized];

    if (!entry) return value ?? '';

    return entry[currentLang] ?? value ?? '';

}



export function getEnumOptions(type) {

    const mapping = ENUM_TRANSLATIONS[type];

    if (!mapping) return [];

    const order = ENUM_ORDER[type] || Object.keys(mapping);

    return order.map(key => mapping[key]?.[currentLang] ?? key);

}



export function normalizeEnumInput(type, value) {

    if (!type) return value;

    const mapping = ENUM_TRANSLATIONS[type];

    if (!mapping) return value;

    const text = String(value ?? '').trim();

    if (mapping[text]) return text;

    const order = ENUM_ORDER[type] || Object.keys(mapping);

    for (const key of order) {

        const entry = mapping[key];

        if (!entry) continue;

        if (entry.zh === text || entry.en === text) return key;

    }

    const lower = text.toLowerCase();

    const alias = ENUM_ALIASES[type]?.[lower];

    return alias || value;

}

