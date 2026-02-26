const DEFAULT_PIPE_COMPONENT_TYPE = 'pipe';

export function withDefaultPipeComponentType(rows = []) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
        if (!row || typeof row !== 'object') return row;
        const componentType = String(row.componentType ?? '').trim();
        return {
            ...row,
            componentType: componentType || DEFAULT_PIPE_COMPONENT_TYPE
        };
    });
}
