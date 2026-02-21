import { COLUMN_STATUSES } from './constants.js';

function distanceToColumn(x, columnInstance) {
    if (!columnInstance?.element) return Infinity;
    const rect = columnInstance.element.getBoundingClientRect();
    return Math.abs(x - (rect.left + rect.width / 2));
}

function findNearestColumn(x, columnInstances) {
    let nearest = null;
    let minDist = Infinity;
    COLUMN_STATUSES.forEach(status => {
        const col = columnInstances[status];
        if (!col) return;
        if (col.isInsideColumn(x)) {
            nearest = col;
            minDist = 0;
        } else if (col.isNearColumn(x)) {
            const d = distanceToColumn(x, col);
            if (d < minDist) {
                minDist = d;
                nearest = col;
            }
        }
    });
    return nearest;
}

function updateSnapState(nearestColumn, columnInstances, clearSnapEffects) {
    if (!nearestColumn) {
        clearSnapEffects();
        return;
    }
    COLUMN_STATUSES.forEach(status => {
        const col = columnInstances[status];
        if (col === nearestColumn) col.triggerSnapEffect();
        else col.clearSnapEffect();
    });
}

/**
 * @param {{ columnInstances: Record<string, object>, onProximityDrop: (col: object, taskId: string) => void, clearSnapEffects: () => void }} ctx
 */
export function setupProximitySnapping(ctx) {
    const { columnInstances, onProximityDrop, clearSnapEffects } = ctx;
    let isDragging = false;
    let draggedCardId = null;
    let currentSnappingColumn = null;
    let droppedOnColumn = false;

    document.addEventListener('dragstart', (e) => {
        const $card = e.target.closest('.kanban-card');
        if ($card?.dataset?.taskId) {
            isDragging = true;
            draggedCardId = $card.dataset.taskId;
            droppedOnColumn = false;
        }
    }, true);

    document.addEventListener('drop', (e) => {
        if (e.target.closest('.kanban-column')) droppedOnColumn = true;
    }, true);

    document.addEventListener('dragend', () => {
        if (isDragging && currentSnappingColumn && draggedCardId && !droppedOnColumn) {
            setTimeout(() => onProximityDrop(currentSnappingColumn, draggedCardId), 50);
        }
        setTimeout(() => {
            isDragging = false;
            draggedCardId = null;
            currentSnappingColumn = null;
            droppedOnColumn = false;
            clearSnapEffects();
        }, 100);
    });

    document.addEventListener('dragover', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        currentSnappingColumn = findNearestColumn(e.clientX, columnInstances);
        updateSnapState(currentSnappingColumn, columnInstances, clearSnapEffects);
    });
}
