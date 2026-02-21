import { formatDateString } from '../../utils/format-date.js';

export const DashboardDOM = {
    createAddTaskButton() {
        const $btn = document.createElement('button');
        $btn.type = 'button';
        $btn.id = 'add-task-btn';
        $btn.className = 'btn btn--primary';
        $btn.innerHTML = '<span class="btn__icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" /></svg></span><span class="btn__label">Add Task</span>';
        return $btn;
    },

    createCancelButton() {
        const $btn = document.createElement('button');
        $btn.type = 'button';
        $btn.className = 'btn btn--secondary modal__cancel';
        $btn.textContent = 'Cancel';
        return $btn;
    },

    createSubmitButton(isEditing) {
        const $btn = document.createElement('button');
        $btn.type = 'submit';
        $btn.className = 'btn btn--primary';
        $btn.textContent = isEditing ? 'Update Task' : 'Add Task';
        return $btn;
    },

    createCardElement(taskData) {
        const $template = document.getElementById('card-template');
        if (!$template) return null;

        const cardClone = $template.content.cloneNode(true);
        const $cardElement = cardClone.querySelector('.kanban-card');
        $cardElement.dataset.taskId = taskData.id;
        $cardElement.draggable = true;
        this.populateCardContent($cardElement, taskData);
        return cardClone;
    },

    populateCardContent($cardElement, taskData) {
        const $titleEl = $cardElement.querySelector('.kanban-card__title');
        const $descEl = $cardElement.querySelector('.kanban-card__description');
        const $deadlineTextEl = $cardElement.querySelector('.kanban-card__deadline-date');
        const $deadlineIconEl = $cardElement.querySelector('.kanban-card__deadline-icon');


        if ($titleEl) $titleEl.textContent = taskData.title;
        if ($descEl) $descEl.textContent = taskData.description || '';

        if ($deadlineTextEl) {
            if (taskData.deadline) {
                $deadlineTextEl.textContent = formatDateString(taskData.deadline);
                if ($deadlineIconEl) $deadlineIconEl.classList.remove('is-hidden');
            } else {
                $deadlineTextEl.textContent = '';
                if ($deadlineIconEl) $deadlineIconEl.classList.add('is-hidden');
            }
        }

    },

    clearColumn($container) {
        if ($container) {
            $container.innerHTML = '';
        }
    },

    clearDragOverStates() {
        document.querySelectorAll('.kanban-column__cards').forEach($c => {
            $c.classList.remove('is-drag-over', 'is-snapping');
        });
        document.querySelectorAll('.kanban-column__content').forEach($c => {
            $c.classList.remove('is-drag-active');
        });
    },
};
