import { createApp, h } from 'vue';
import { pinia } from '@/stores/pinia.js';
import ReportFigureHost from '@/components/report/ReportFigureHost.vue';

function createHostElement() {
  const element = document.createElement('div');
  element.className = 'report-figure-render-host';
  return element;
}

export function renderReportFigures(options = {}) {
  if (typeof document === 'undefined' || !document.body) {
    return Promise.reject(new Error('Report figure rendering requires a browser document.'));
  }

  const mountTarget = createHostElement();
  document.body.appendChild(mountTarget);

  return new Promise((resolve, reject) => {
    let app = null;

    function cleanup() {
      try {
        app?.unmount?.();
      } catch {
        // Ignore Vue unmount cleanup errors.
      }
      mountTarget.remove();
    }

    app = createApp({
      render() {
        return h(ReportFigureHost, {
          ...options,
          onReady: (payload) => {
            cleanup();
            resolve(payload);
          },
          onError: (error) => {
            cleanup();
            reject(error instanceof Error ? error : new Error(String(error ?? 'Figure rendering failed.')));
          }
        });
      }
    });

    app.use(pinia);

    try {
      app.mount(mountTarget);
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error ?? 'Figure rendering failed.')));
    }
  });
}
