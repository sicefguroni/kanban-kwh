import { StorageService } from '../../../services/storage-service.js';
import { COLUMN_STATUSES } from '../constants.js';
import { DashboardDOM } from './dashboard-dom.js';

export class DashboardRender {
    constructor(columnInstances) {
        this.columnInstances = columnInstances;
        this._onEdit = null;
        this._onDelete = null;
        this._onAfterStatusChange = null;
        this._afterRender = null;
        this._renderChain = Promise.resolve();
    }

    async renderTasks(onEdit, onDelete, onAfterStatusChange) {
        this._renderChain = this._renderChain.then(async () => {
            this._onEdit = onEdit;
            this._onDelete = onDelete;
            if (onAfterStatusChange !== undefined) {
                this._onAfterStatusChange = onAfterStatusChange;
            }
            this.clearAllColumns();
            for (const status of COLUMN_STATUSES) {
                // Sequential rendering keeps DOM updates deterministic when the API is slow.
                await this.renderTasksForStatus(status, onEdit, onDelete);
            }
            // Optional hook (used by the dashboard to re-apply keyboard focus).
            this._afterRender?.();
        });

        return this._renderChain;
    }

    clearAllColumns() {
        COLUMN_STATUSES.forEach(status => {
            const $container = this.columnInstances[status]?.getCardsContainer();
            DashboardDOM.clearColumn($container);
        });
    }

    async renderTasksForStatus(status, onEdit, onDelete) {
        const tasks = await StorageService.getTasksByStatus(status);
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
        // Checkbox handling
        const $checkbox = $cardElement.querySelector('.kanban-card__checkbox');
        if ($checkbox) {
            $checkbox.checked = taskData.status === 'Done';

            $checkbox.addEventListener('change', async (e) => {
                try {
                    if (e.target.checked) {
                        // advance status: To Do -> In Progress -> Done
                        if (taskData.status === 'To Do') {
                            await StorageService.moveTask(taskData.id, 'In Progress');
                        } else if (taskData.status === 'In Progress') {
                            await StorageService.moveTask(taskData.id, 'Done');
                        } else {
                            return;
                        }
                    } else {
                        // unchecked from Done -> move back to To Do
                        if (taskData.status === 'Done') {
                            await StorageService.moveTask(taskData.id, 'To Do');
                        } else {
                            return;
                        }
                    }

                    await this.renderTasks(this._onEdit, this._onDelete);
                    if (this._onAfterStatusChange) {
                        await this._onAfterStatusChange(taskData.id);
                    }
                } catch (err) {
                    // eslint-disable-next-line no-alert
                    alert(err?.message || 'Failed to update task');
                }
            });
        }
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
