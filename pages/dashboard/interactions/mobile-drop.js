import { COLUMN_STATUSES } from '../constants.js';

const MOBILE_BREAKPOINT = '(max-width: 767px)';

function createElement(tag, { id, className, attrs } = {}) {
    const el = document.createElement(tag);
    if (id) el.id = id;
    if (className) el.className = className;
    if (attrs) {
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    }
    return el;
}

function statusFromClientX(clientX, statuses) {
    const w = document.documentElement.clientWidth || 1;
    if (clientX == null || Number.isNaN(clientX) || clientX <= 0) {
        clientX = w / 2;
    }
    const x = Math.max(0, Math.min(clientX, w - 1));
    const i = Math.floor((x / w) * statuses.length);
    return statuses[Math.max(0, Math.min(i, statuses.length - 1))];
}

/**
 * Mobile drag targets (bottom bar + overlay). Returns a cleanup function.
 * @param {{
 *   statuses?: string[],
 *   onDrop: (status: string, taskId: string) => void,
 * }} ctx
 */
export function setupMobileDrop(ctx) {
    const { onDrop, statuses = COLUMN_STATUSES } = ctx;
    const dashboard = document.querySelector('.dashboard');
    if (!dashboard || document.getElementById('MOBILE_DROP_BAR')) return () => {};

    const mobileMediaQueryList = window.matchMedia(MOBILE_BREAKPOINT);
    let lastDragoverClientX = null;
    let overlay = null;

    const bar = createElement('div', {
        id: 'MOBILE_DROP_BAR',
        className: 'mobile-drop-bar',
        attrs: { 'aria-label': 'Drop zone for moving tasks' },
    });
    bar.innerHTML = statuses
        .map((status) => `<div class="mobile-drop-bar__zone" data-status="${status}">${status}</div>`)
        .join('');
    dashboard.appendChild(bar);

    const clearZoneHighlights = () => {
        bar.querySelectorAll('.mobile-drop-bar__zone').forEach((z) => z.classList.remove('is-drag-over'));
    };

    const hideDropUI = () => {
        bar.classList.remove('is-visible');
        lastDragoverClientX = null;
        clearZoneHighlights();
        overlay?.remove?.();
        overlay = null;
    };

    const performDrop = (taskId, status) => {
        if (!taskId || !status) return;
        hideDropUI();
        onDrop(status, taskId);
    };

    bar.querySelectorAll('.mobile-drop-bar__zone').forEach((zone) => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            zone.classList.add('is-drag-over');
        });
        zone.addEventListener('dragleave', (e) => {
            if (!zone.contains(e.relatedTarget)) zone.classList.remove('is-drag-over');
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const taskId = e.dataTransfer.getData('text/plain');
            const status = zone.dataset.status;
            performDrop(taskId, status);
        });
    });

    const showOverlay = () => {
        if (overlay) return;
        overlay = createElement('div', {
            id: 'MOBILE_DROP_OVERLAY',
            className: 'mobile-drop-overlay is-visible',
            attrs: { 'aria-hidden': 'true' },
        });

        overlay.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            lastDragoverClientX = e.clientX;
            const status = statusFromClientX(e.clientX, statuses);
            bar.querySelectorAll('.mobile-drop-bar__zone').forEach((z) => {
                z.classList.toggle('is-drag-over', z.dataset.status === status);
            });
        });
        overlay.addEventListener('dragleave', (e) => {
            if (!overlay?.contains(e.relatedTarget)) {
                lastDragoverClientX = null;
                clearZoneHighlights();
            }
        });
        overlay.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const taskId = e.dataTransfer.getData('text/plain');
            const x = lastDragoverClientX ?? e.clientX;
            const status = statusFromClientX(x, statuses);
            performDrop(taskId, status);
        });

        dashboard.appendChild(overlay);
    };

    const onDragStart = (e) => {
        if (!e.target.closest('.kanban-card[data-task-id]')) return;
        if (!mobileMediaQueryList.matches) return;
        lastDragoverClientX = null;
        bar.classList.add('is-visible');
        requestAnimationFrame(showOverlay);
    };

    const onDragEnd = () => {
        setTimeout(hideDropUI, 0);
    };

    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('dragend', onDragEnd);

    return () => {
        document.removeEventListener('dragstart', onDragStart);
        document.removeEventListener('dragend', onDragEnd);
        hideDropUI();
        bar.remove();
    };
}

