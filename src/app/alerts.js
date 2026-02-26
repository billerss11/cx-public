const ALERT_TIMEOUT_MS = 5000;
const ALERT_EXIT_MS = 180;

const ALERT_TYPE_CLASS = Object.freeze({
    success: 'is-success',
    info: 'is-info',
    warning: 'is-warning',
    danger: 'is-danger'
});

function removeAlert(alertEl) {
    if (!alertEl || !alertEl.isConnected) return;
    alertEl.classList.add('is-leaving');
    window.setTimeout(() => {
        alertEl.remove();
    }, ALERT_EXIT_MS);
}

export function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;

    const alert = document.createElement('div');
    alert.className = `app-alert ${ALERT_TYPE_CLASS[type] || ALERT_TYPE_CLASS.info}`;
    alert.setAttribute('role', 'status');

    const content = document.createElement('div');
    content.className = 'app-alert__message';
    content.textContent = String(message ?? '');

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'app-alert__close';
    closeButton.setAttribute('aria-label', 'Dismiss alert');
    closeButton.textContent = 'x';
    closeButton.addEventListener('click', () => removeAlert(alert));

    alert.appendChild(content);
    alert.appendChild(closeButton);
    alertContainer.appendChild(alert);

    window.setTimeout(() => {
        removeAlert(alert);
    }, ALERT_TIMEOUT_MS);
}
