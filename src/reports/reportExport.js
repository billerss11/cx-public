import { useProjectStore } from '@/stores/projectStore.js';
import { pinia } from '@/stores/pinia.js';
import { finishEditingAllHotTables } from '@/composables/useHotTableRegistry.js';
import { getLanguage } from '@/app/i18n.js';
import { buildTopologyModelInWorker } from '@/composables/useTopologyWorker.js';
import { buildTopologyDebugGraph } from '@/topology/topologyGraphDebug.js';
import { buildActiveWellReportSnapshot, buildReportModel } from '@/reports/reportSnapshot.js';
import { buildReportDocumentHtml } from '@/reports/reportDocument.js';
import { renderReportFigures } from '@/reports/reportFigureRenderer.js';

const projectStore = useProjectStore(pinia);

function openPrintWindow() {
  if (typeof window === 'undefined' || typeof window.open !== 'function') {
    return null;
  }
  return window.open('about:blank', '_blank');
}

export function openReportPrintWindow(html) {
  const printWindow = openPrintWindow();
  if (!printWindow) return false;

  printWindow.document.write(html);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus?.();
    printWindow.print?.();
  }, 0);

  return true;
}

async function buildTopologyExportModel(snapshot, options = {}) {
  try {
    const topologyResult = await buildTopologyModelInWorker(snapshot.stateSnapshot, {
      wellId: snapshot?.well?.id ?? null,
      supersedeInFlight: false
    });
    const topologyGraph = options.includeTopologyGraph === false
      ? null
      : buildTopologyDebugGraph(topologyResult, {
        scope: 'all',
        depthUnitsLabel: snapshot?.config?.units || 'ft'
      });

    return {
      status: 'ready',
      result: topologyResult,
      graph: topologyGraph
    };
  } catch (error) {
    return {
      status: 'error',
      error: error?.message || String(error ?? 'Topology export failed.'),
      result: null,
      graph: null
    };
  }
}

export async function exportReportPdf(options = {}) {
  projectStore.ensureInitialized();
  finishEditingAllHotTables();
  projectStore.syncActiveWellData();

  const projectPayload = projectStore.serializeProjectPayload();
  const snapshot = buildActiveWellReportSnapshot(projectPayload, {
    language: getLanguage()
  });
  const topology = await buildTopologyExportModel(snapshot, options);
  const figures = await renderReportFigures({
    snapshot,
    topologyResult: topology.result,
    topologyGraph: topology.graph,
    includeTopologyGraph: options.includeTopologyGraph !== false
  });
  const model = buildReportModel(snapshot, { topology, figures });
  const html = buildReportDocumentHtml(model);
  return openReportPrintWindow(html);
}
