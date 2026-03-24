export const PROJECT_DATA_CONTENT_ARRAY_KEYS = Object.freeze([
    'casingData',
    'tubingData',
    'drillStringData',
    'equipmentData',
    'horizontalLines',
    'annotationBoxes',
    'userAnnotations',
    'cementPlugs',
    'annulusFluids',
    'markers',
    'topologySources',
    'surfaceComponents',
    'surfacePaths',
    'surfaceTransfers',
    'surfaceOutlets',
    'trajectory'
]);

export const PROJECT_DATA_CONTENT_OBJECT_KEYS = Object.freeze([
    'surfaceTemplate'
]);

export function hasProjectDataContent(projectData) {
    const source = projectData && typeof projectData === 'object' && !Array.isArray(projectData)
        ? projectData
        : null;
    if (!source) return false;

    if (PROJECT_DATA_CONTENT_ARRAY_KEYS.some((key) => {
        const rows = source[key];
        return Array.isArray(rows) && rows.length > 0;
    })) {
        return true;
    }

    return PROJECT_DATA_CONTENT_OBJECT_KEYS.some((key) => {
        const value = source[key];
        return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
    });
}
