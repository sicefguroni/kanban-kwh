const TEMPLATE_ID = 'card-template';
const DEFAULT_CONTAINER = '.app';

export class KanbanCard {
    constructor({ id = '', title = '', status = '', description = '', deadline = '' } = {}) {
        this.id = id;
        this.title = title;
        this.status = status;
        this.description = description;
        this.deadline = deadline;
        this.element = null;
    }

    render(container = DEFAULT_CONTAINER) {
        const template = document.getElementById(TEMPLATE_ID);
        if (!template?.content) {
            console.error(`[KanbanCard] Template "${TEMPLATE_ID}" not found. Load components first.`);
            return null;
        }

        const card = template.content.cloneNode(true);
        this._populateCard(card);

        const cardElement = card.querySelector('.kanban-card');
        if (this.id) {
            cardElement.dataset.taskId = this.id;
        }

        const target = document.querySelector(container);
        if (target) {
            target.appendChild(card);
            this.element = target.querySelector(`[data-task-id="${this.id}"]`);
        }
        return this.element || cardElement;
    }

    _populateCard(card) {
        const titleEl = card.querySelector('.kanban-card__title');
        const descEl = card.querySelector('.kanban-card__description');
        const deadlineEl = card.querySelector('.kanban-card__deadline');
        const checkbox = card.querySelector('.kanban-card__checkbox');

        if (titleEl) titleEl.textContent = this.title;
        if (descEl) descEl.textContent = this.description || '';
        if (deadlineEl) deadlineEl.textContent = this.deadline ? `📅 ${this.deadline}` : '';
        if (checkbox) {
            checkbox.checked = this.status === 'done';
        }
    }

    setEditListener(callback) {
        if (!this.element) return;
        const editBtn = this.element.querySelector('.kanban-card__edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                callback({
                    id: this.id,
                    title: this.title,
                    description: this.description,
                    status: this.status,
                    deadline: this.deadline,
                });
            });
        }
    }

    setCheckboxListener(onStatusChange) {
        if (!this.element) return;

        const checkbox = this.element.querySelector('.kanban-card__checkbox');
        if (!checkbox) return;

        checkbox.checked = this.status === 'Done';

        checkbox.addEventListener('change', (e) => {
            const newStatus = e.target.checked ? 'Done' : 'To Do';

            this.status = newStatus;

            const targetColumn = document.querySelector(`.kanban-column[data-id="${newStatus}"] .kanban-column__cards`);
            if (targetColumn) {
                targetColumn.appendChild(this.element);
            }

            if (onStatusChange) {
                onStatusChange(this.id, newStatus);
            }
        });
    }

    setDeleteListener(callback) {
        if (!this.element) return;
        const deleteBtn = this.element.querySelector('.kanban-card__delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                callback(this.id);
            });
        }
    }

    setDragListeners(onDragStart, onDragEnd) {
        if (!this.element) return;
        const dragHandle = this.element.querySelector('.kanban-card__drag-handle');
        if (!dragHandle) return;

        // Make the entire card draggable
        this.element.draggable = true;

        this.element.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.id);
            // Add visual feedback
            setTimeout(() => {
                this.element.classList.add('is-dragging');
            }, 0);
            onDragStart?.(this.id);
        });

        this.element.addEventListener('dragend', () => {
            this.element.classList.remove('is-dragging');
            onDragEnd?.();
        });
    }

    remove() {
        if (this.element) {
            this.element.remove();
        }
    }
}
