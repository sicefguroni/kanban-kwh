import { StorageService } from '../../services/storage-service.js';
import { COLUMN_STATUSES } from './constants.js';
import { DashboardDOM } from './dashboard-dom.js';

export class DashboardRender {
    constructor(columnInstances) {
        this.columnInstances = columnInstances;
    }

    renderTasks(onEdit, onDelete) {
        this.clearAllColumns();
        COLUMN_STATUSES.forEach(status => {
            this.renderTasksForStatus(status, onEdit, onDelete);
        });
    }

    clearAllColumns() {
        COLUMN_STATUSES.forEach(status => {
            const $container = this.columnInstances[status]?.getCardsContainer();
            DashboardDOM.clearColumn($container);
        });
    }

    renderTasksForStatus(status, onEdit, onDelete) {
        const tasks = StorageService.getTasksByStatus(status);
        const $container = this.columnInstances[status]?.getCardsContainer();
        if (!$container) return;

        tasks.forEach(taskData => {
            const $cardElement = DashboardDOM.createCardElement(taskData);
            if ($cardElement) {
                this.attachCardListeners($cardElement, taskData, onEdit, onDelete);
                $container.appendChild($cardElement);
            }
        });

        this.columnInstances[status]?.updateCounter(tasks.length);
    }

    attachCardListeners($cardClone, taskData, onEdit, onDelete) {
        const $cardElement = $cardClone.querySelector('.kanban-card');
        if (!$cardElement) return;

        this.attachCardEditListener($cardElement, taskData, onEdit);
        this.attachCardDeleteListener($cardElement, taskData.id, onDelete);
        this.attachCardDragListeners($cardElement, taskData.id);
    }

    attachCardEditListener($cardElement, taskData, onEdit) {
        const $editBtn = $cardElement.querySelector('.kanban-card__edit-btn');
        if ($editBtn) {
            $editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                onEdit(taskData);
            });
        }
    }

    attachCardDeleteListener($cardElement, taskId, onDelete) {
        const $deleteBtn = $cardElement.querySelector('.kanban-card__delete-btn');
        if ($deleteBtn) {
            $deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                onDelete(taskId);
            });
        }
    }

    attachCardDragListeners($cardElement, taskId) {
        $cardElement.addEventListener('dragstart', (e) => {
            this.handleDragStart(e, $cardElement, taskId);
        });

        $cardElement.addEventListener('dragend', () => {
            this.handleDragEnd($cardElement);
        });
    }

    handleDragStart(e, $cardElement, taskId) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', taskId);
        setTimeout(() => {
            $cardElement.classList.add('is-dragging');
        }, 0);
    }

    handleDragEnd($cardElement) {
        $cardElement.classList.remove('is-dragging');
        DashboardDOM.clearDragOverStates();
    }
}
