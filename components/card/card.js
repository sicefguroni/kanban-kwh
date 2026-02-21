import { formatDateString } from '../../utils/format-date.js';

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
        const deadlineTextEl = card.querySelector('.kanban-card__deadline-date');
        const deadlineIconEl = card.querySelector('.kanban-card__deadline-icon');

        if (titleEl) titleEl.textContent = this.title;
        if (descEl) descEl.textContent = this.description || '';
        if (deadlineEl) {
            if (this.deadline) {
                deadlineTextEl.textContent = formatDateString(this.deadline);
                if (deadlineIconEl) deadlineIconEl.classList.remove('is-hidden');
            } else {
                deadlineTextEl.textContent = '';
                if (deadlineIconEl) deadlineIconEl.classList.add('is-hidden');
            }
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

        this.element.draggable = true;
        this.element.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.id);
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
