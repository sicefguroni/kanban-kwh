const TEMPLATE_ID = 'column-template';
const DEFAULT_CONTAINER = '.app';
const CARD_CLASS = 'kanban-card';

function getCardElements(container) {
    return Array.from(container.children).filter(el => el.classList.contains(CARD_CLASS));
}

function getInsertIndexForY(cardElements, y) {
    for (let i = 0; i < cardElements.length; i++) {
        const rect = cardElements[i].getBoundingClientRect();
        if (y < rect.top + rect.height / 2) return i;
    }
    return cardElements.length;
}

export class KanbanColumn {
    constructor({ title = '', count = 0 } = {}) {
        this.title = title;
        this.count = count;
        this.element = null;
    }

    render(container = DEFAULT_CONTAINER) {
        const template = document.getElementById(TEMPLATE_ID);
        if (!template?.content) {
            console.error(`[KanbanColumn] Template "${TEMPLATE_ID}" not found. Load components first.`);
            return null;
        }

        const column = template.content.cloneNode(true);
        this._populateColumn(column);

        const target = document.querySelector(container);
        if (!target) return null;
        target.appendChild(column);
        this.element = target.lastElementChild;
        return this.element;
    }

    _populateColumn(column) {
        const $title = column.querySelector('.kanban-column__title');
        const $count = column.querySelector('.kanban-column__counter-label');
        if ($title) $title.textContent = this.title;
        if ($count) $count.textContent = this.count;
    }

    getCardsContainer() {
        return this.element?.querySelector('.kanban-column__cards') ?? null;
    }

    getCardCount() {
        const container = this.getCardsContainer();
        return container ? container.children.length : 0;
    }

    updateCounter(count) {
        const $count = this.element?.querySelector('.kanban-column__counter-label');
        if ($count) $count.textContent = count;
    }

    setAddTaskListener(callback) {
        const $header = this.element?.querySelector('.kanban-column__header');
        if ($header) $header.addEventListener('click', () => callback(this.title));
    }

    setDropZoneListeners(onDragOver, onDragLeave, onDrop) {
        const container = this.getCardsContainer();
        if (!container) return;
        const contentElement = this.element?.querySelector('.kanban-column__content');
        this.onDropCallback = onDrop;

        const bindDropTarget = ($el) => {
            $el.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                this.handleDragOver(e, container, contentElement);
                onDragOver?.(this.title);
            });
            $el.addEventListener('dragleave', (e) => {
                this.handleDragLeave(e, container, contentElement);
                onDragLeave?.();
            });
            $el.addEventListener('drop', (e) => {
                e.preventDefault();
                this.handleDrop(e, container, contentElement, onDrop);
            });
        };
        bindDropTarget(this.element);
        bindDropTarget(container);
        if (contentElement) {
            contentElement.addEventListener('dragleave', (e) => {
                this.handleContentDragLeave(e, container, contentElement);
            });
        }
    }

    setDropZoneActive(container, contentElement, active) {
        container.classList.toggle('is-drag-over', active);
        container.classList.toggle('is-snapping', active);
        if (contentElement) contentElement.classList.toggle('is-drag-active', active);
    }

    handleDragOver(e, container, contentElement) {
        if (!container.classList.contains('is-drag-over')) {
            this.setDropZoneActive(container, contentElement, true);
        }
    }

    handleDragLeave(e, container, contentElement) {
        const { relatedTarget } = e;
        if (container.contains(relatedTarget) || relatedTarget === container) return;
        this.setDropZoneActive(container, contentElement, false);
    }

    handleDrop(e, container, contentElement, onDrop) {
        this.setDropZoneActive(container, contentElement, false);
        const insertIndex = this.getInsertIndex(container, e.clientY);
        const taskId = e.dataTransfer.getData('text/plain');
        const callback = onDrop ?? this.onDropCallback;
        callback?.(this.title, taskId, insertIndex);
    }

    handleContentDragLeave(e, container, contentElement) {
        const { relatedTarget } = e;
        if (contentElement.contains(relatedTarget) || relatedTarget === contentElement) return;
        this.setDropZoneActive(container, contentElement, false);
    }

    getInsertIndex(container, y) {
        return getInsertIndexForY(getCardElements(container), y);
    }

    triggerSnapEffect() {
        const container = this.getCardsContainer();
        if (!container) return;
        const contentElement = this.element?.querySelector('.kanban-column__content');
        this.setDropZoneActive(container, contentElement, true);
    }

    clearSnapEffect() {
        const container = this.getCardsContainer();
        if (!container) return;
        const contentElement = this.element?.querySelector('.kanban-column__content');
        this.setDropZoneActive(container, contentElement, false);
    }

    isNearColumn(x, threshold = 200) {
        if (!this.element) return false;
        const rect = this.element.getBoundingClientRect();
        return x >= rect.left - threshold && x <= rect.right + threshold;
    }

    isInsideColumn(x) {
        if (!this.element) return false;
        const rect = this.element.getBoundingClientRect();
        return x >= rect.left && x <= rect.right;
    }

    getColumnCenterX() {
        if (!this.element) return null;
        const rect = this.element.getBoundingClientRect();
        return rect.left + rect.width / 2;
    }
}
