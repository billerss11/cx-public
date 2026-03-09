#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');

const MAX_INITIAL_JS_KB = Number.parseFloat(process.env.PERF_MAX_INITIAL_JS_KB ?? '900');
const MAX_ENTRY_CHUNK_KB = Number.parseFloat(process.env.PERF_MAX_ENTRY_CHUNK_KB ?? '600');
const MAX_SINGLE_CHUNK_KB = Number.parseFloat(process.env.PERF_MAX_SINGLE_CHUNK_KB ?? '900');

function toKb(bytes = 0) {
    return Math.round((Number(bytes) / 1024) * 10) / 10;
}

function readFile(relPath) {
    const absPath = path.join(repoRoot, relPath);
    return fs.readFileSync(absPath, 'utf8');
}

function fileExists(relPath) {
    return fs.existsSync(path.join(repoRoot, relPath));
}

function unique(items = []) {
    return Array.from(new Set(items));
}

function parseDistIndexHtml(indexHtml) {
    const entryMatch = indexHtml.match(/<script[^>]+src="\.\/*assets\/([^"]+\.js)"/i);
    const entryChunk = entryMatch?.[1] ?? null;
    const preloadMatches = Array.from(
        indexHtml.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\.\/*assets\/([^"]+\.js)"/gi)
    );
    const preloadedChunks = preloadMatches.map((match) => match[1]).filter(Boolean);
    return {
        entryChunk,
        preloadedChunks
    };
}

function getAssetSizeInfo(assetFileName) {
    const relPath = path.join('dist', 'assets', assetFileName);
    const absPath = path.join(repoRoot, relPath);
    if (!fs.existsSync(absPath)) {
        return {
            file: assetFileName,
            bytes: null,
            kb: null,
            missing: true
        };
    }

    const bytes = fs.statSync(absPath).size;
    return {
        file: assetFileName,
        bytes,
        kb: toKb(bytes),
        missing: false
    };
}

function collectBundleDiagnostics() {
    const indexRelPath = path.join('dist', 'index.html');
    if (!fileExists(indexRelPath)) {
        return {
            ok: false,
            reason: 'Missing dist/index.html. Run `npm run build` first.'
        };
    }

    const indexHtml = readFile(indexRelPath);
    const { entryChunk, preloadedChunks } = parseDistIndexHtml(indexHtml);
    const initialChunkFiles = unique([entryChunk, ...preloadedChunks].filter(Boolean));
    const initialChunks = initialChunkFiles.map(getAssetSizeInfo);
    const totalInitialBytes = initialChunks.reduce(
        (sum, item) => sum + (Number.isFinite(item.bytes) ? item.bytes : 0),
        0
    );

    const distAssetsDir = path.join(repoRoot, 'dist', 'assets');
    const allJsAssets = fs.readdirSync(distAssetsDir)
        .filter((name) => name.endsWith('.js'))
        .map(getAssetSizeInfo)
        .sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0));

    const warnings = [];
    const failures = [];

    if (toKb(totalInitialBytes) > MAX_INITIAL_JS_KB) {
        failures.push(
            `Initial JS payload ${toKb(totalInitialBytes)} kB exceeds budget ${MAX_INITIAL_JS_KB} kB`
        );
    }

    if (entryChunk) {
        const entrySize = initialChunks.find((item) => item.file === entryChunk);
        if (entrySize && Number.isFinite(entrySize.kb) && entrySize.kb > MAX_ENTRY_CHUNK_KB) {
            failures.push(
                `Entry chunk ${entryChunk} is ${entrySize.kb} kB and exceeds budget ${MAX_ENTRY_CHUNK_KB} kB`
            );
        }
    }

    const oversizedChunks = allJsAssets.filter((item) => Number.isFinite(item.kb) && item.kb > MAX_SINGLE_CHUNK_KB);
    oversizedChunks.forEach((item) => {
        warnings.push(
            `Chunk ${item.file} is ${item.kb} kB (single-chunk budget ${MAX_SINGLE_CHUNK_KB} kB)`
        );
    });

    if (preloadedChunks.some((name) => name.includes('vendor-table'))) {
        warnings.push('`vendor-table` is preloaded on startup (Handsontable cost paid before user opens data tables).');
    }
    if (preloadedChunks.some((name) => name.includes('vendor-d3'))) {
        warnings.push('`vendor-d3` is preloaded on startup (analysis/LAS charting cost paid before those workspaces open).');
    }

    return {
        ok: true,
        entryChunk,
        preloadedChunks,
        initialChunks,
        totalInitialBytes,
        allJsAssets,
        warnings,
        failures
    };
}

function collectStaticDiagnostics() {
    const warnings = [];

    const mainLayout = readFile(path.join('src', 'layouts', 'MainLayout.vue'));
    if (
        /import\s+AnalysisWorkspace\s+from\s+['"]@\/views\/AnalysisWorkspace\.vue['"]/.test(mainLayout) &&
        /import\s+LasWorkspace\s+from\s+['"]@\/views\/LasWorkspace\.vue['"]/.test(mainLayout)
    ) {
        warnings.push(
            'Main layout statically imports Analysis/LAS workspaces; they are bundled into startup path instead of route/activity lazy chunks.'
        );
    }

    const tablesTabsPanel = readFile(path.join('src', 'components', 'tables', 'TablesTabsPanel.vue'));
    if (/<Tabs[^>]*:lazy="false"/.test(tablesTabsPanel)) {
        warnings.push('`TablesTabsPanel` uses `:lazy=\"false\"`, which mounts every table pane eagerly.');
    }

    const workspaceShell = readFile(path.join('src', 'components', 'workspace', 'WorkspaceActivityShell.vue'));
    if (/v-show="isLeftDockVisible"/.test(workspaceShell) && /<LeftHierarchyDock\s*\/>/.test(workspaceShell)) {
        warnings.push('Hierarchy dock uses `v-show`; heavy dock subtree remains mounted while hidden.');
    }
    if (/v-show="isInlineBottomDockVisible"/.test(workspaceShell) && /<ResizableBottomDock/.test(workspaceShell)) {
        warnings.push('Bottom data-table dock uses `v-show`; Handsontable subtree remains mounted while hidden.');
    }

    const bootstrap = readFile(path.join('src', 'app', 'bootstrap.js'));
    if (/loadSampleData\(\{\s*silent:\s*true\s*\}\)/.test(bootstrap)) {
        warnings.push('App bootstrap always loads sample data at startup, adding avoidable initialization work.');
    }

    const schematicViewport = readFile(path.join('src', 'components', 'schematic', 'SchematicViewport.vue'));
    if (/watchEffect\(\s*\(\)\s*=>\s*\{[\s\S]*getIntervalsWithBoundaryReasons/.test(schematicViewport)) {
        warnings.push('Schematic viewport recomputes physics intervals in a broad `watchEffect`, which can be expensive on frequent edits.');
    }

    const analysisWorkspace = readFile(path.join('src', 'views', 'AnalysisWorkspace.vue'));
    if (
        /\[topologyStateSnapshot,\s*activeWellId,\s*isAnalysisWorkspaceActive\]/.test(analysisWorkspace) &&
        /\{\s*immediate:\s*true,\s*deep:\s*true\s*\}/.test(analysisWorkspace)
    ) {
        warnings.push('Analysis workspace uses deep watch on full topology snapshot, which can add overhead after workspace is visited.');
    }

    return { warnings };
}

function printSection(title) {
    console.log('');
    console.log(title);
    console.log('-'.repeat(title.length));
}

function printList(items = []) {
    items.forEach((item) => {
        console.log(`- ${item}`);
    });
}

function run() {
    console.log('Performance Audit Report');
    console.log(`Repo: ${repoRoot}`);
    console.log(`Mode: ${strict ? 'strict' : 'report-only'}`);

    const bundleDiagnostics = collectBundleDiagnostics();
    if (!bundleDiagnostics.ok) {
        printSection('Bundle Diagnostics');
        console.log(bundleDiagnostics.reason);
        process.exitCode = strict ? 1 : 0;
        return;
    }

    printSection('Bundle Diagnostics');
    console.log(`Entry chunk: ${bundleDiagnostics.entryChunk ?? 'n/a'}`);
    console.log(`Initial JS payload: ${toKb(bundleDiagnostics.totalInitialBytes)} kB`);
    console.log('Initial chunks:');
    bundleDiagnostics.initialChunks.forEach((item) => {
        const label = Number.isFinite(item.kb) ? `${item.kb} kB` : 'missing';
        console.log(`- ${item.file}: ${label}`);
    });
    console.log('Top JS chunks:');
    bundleDiagnostics.allJsAssets.slice(0, 8).forEach((item) => {
        const label = Number.isFinite(item.kb) ? `${item.kb} kB` : 'missing';
        console.log(`- ${item.file}: ${label}`);
    });

    const staticDiagnostics = collectStaticDiagnostics();

    printSection('Static Pattern Diagnostics');
    if (staticDiagnostics.warnings.length === 0) {
        console.log('No known startup/runtime performance risk patterns found.');
    } else {
        printList(staticDiagnostics.warnings);
    }

    const allWarnings = [...bundleDiagnostics.warnings, ...staticDiagnostics.warnings];
    const allFailures = [...bundleDiagnostics.failures];

    printSection('Summary');
    console.log(`Warnings: ${allWarnings.length}`);
    console.log(`Failures: ${allFailures.length}`);
    if (allWarnings.length > 0) {
        printList(allWarnings);
    }
    if (allFailures.length > 0) {
        printList(allFailures);
    }

    if (strict && allFailures.length > 0) {
        process.exitCode = 1;
    } else {
        process.exitCode = 0;
    }
}

run();
