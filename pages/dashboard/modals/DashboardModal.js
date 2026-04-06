import { DashboardDOM } from '../dom/DashboardDOM.js';
import { TASK_STATUS } from '../Constants.js';

export class DashboardModal {
    constructor() {
        this.modal = null;
        this.currentEditingTaskId = null;
    }

    init() {
        this.createModal();
    }

    createModal() {
        const $template = document.getElementById('MODAL_TEMPLATE');
        if (!$template?.content) return;

        const modalClone = $template.content.cloneNode(true);
        this.appendModalFields(modalClone);
        document.body.appendChild(modalClone);
        this.initializeModalElements();
        this.setupModalButtons();
        this.attachModalEventListeners();
    }

    appendModalFields(modalClone) {
        const $fieldsTemplate = document.getElementById('MODAL_FIELD_TEMPLATE');
        if (!$fieldsTemplate?.content) return;

        const $fieldsContainer = modalClone.querySelector('#MODAL_FORM_FIELDS');
        if ($fieldsContainer) {
            $fieldsContainer.appendChild($fieldsTemplate.content.cloneNode(true));
        }
    }

    initializeModalElements() {
        this.modal = {
            overlay: document.querySelector('.modal-overlay'),
            form: document.getElementById('ADD_TASK_FORM'),
            title: document.querySelector('.modal__title'),
            closeBtn: document.querySelector('.modal__close'),
            footer: document.querySelector('#MODAL_FOOTER_ACTIONS'),
        };
    }

    setupModalButtons() {
        if (!this.modal.footer) return;

        const $cancelBtn = DashboardDOM.createCancelButton();
        const $submitBtn = DashboardDOM.createSubmitButton(!!this.currentEditingTaskId);
        this.modal.footer.appendChild($cancelBtn);
        this.modal.footer.appendChild($submitBtn);
        $cancelBtn.addEventListener('click', () => this.closeModal());

        const footerEl = this.modal.footer.closest('.modal__footer');
        if (footerEl && !footerEl.querySelector('.modal__keyboard-hint')) {
            const hint = document.createElement('p');
            hint.className = 'modal__keyboard-hint';
            hint.textContent = 'Tab / Shift+↑↓ move · Enter save · Esc close';
            footerEl.appendChild(hint);
        }
    }

    attachModalEventListeners() {
        this.attachCloseButtonListener();
        this.attachOverlayClickListener();
        this.attachEscapeKeyListener();
        this.attachFormSubmitListener();
        this.attachFocusTrap();
    }

    getFocusableElements() {
        if (!this.modal?.overlay) return [];
        const ids = ['TASK_TITLE', 'TASK_DESCRIPTION', 'TASK_STATUS', 'TASK_DEADLINE'];
        const list = [];
        const closeBtn = this.modal.overlay.querySelector('.modal__close');
        if (closeBtn && !closeBtn.disabled) list.push(closeBtn);
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el && !el.disabled) list.push(el);
        });
        const cancelBtn = this.modal.overlay.querySelector('.modal__cancel');
        const submitBtn = this.modal.overlay.querySelector('button[type="submit"]');
        if (cancelBtn && !cancelBtn.disabled) list.push(cancelBtn);
        if (submitBtn && !submitBtn.disabled) list.push(submitBtn);
        return list;
    }

    attachFocusTrap() {
        if (!this.modal?.overlay) return;
        this.modal.overlay.addEventListener('keydown', (e) => {
            if (!this.modal.overlay.classList.contains('is-open')) return;
            const focusable = this.getFocusableElements();
            if (focusable.length === 0) return;

            const move = (direction) => {
                e.preventDefault();
                const i = focusable.indexOf(document.activeElement);
                const next = direction === 1
                    ? (i >= focusable.length - 1 ? 0 : i + 1)
                    : (i <= 0 ? focusable.length - 1 : i - 1);
                focusable[next].focus();
            };

            if (e.key === 'Tab') {
                move(e.shiftKey ? -1 : 1);
                return;
            }
            if (e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
                e.preventDefault();
                move(e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1);
            }
        }, true);
    }

    attachCloseButtonListener() {
        if (this.modal.closeBtn) {
            this.modal.closeBtn.addEventListener('click', () => this.closeModal());
        }
    }

    attachOverlayClickListener() {
        if (this.modal.overlay) {
            this.modal.overlay.addEventListener('click', (e) => {
                if (e.target === this.modal.overlay) this.closeModal();
            });
        }
    }

    attachEscapeKeyListener() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.overlay?.classList.contains('is-open')) {
                this.closeModal();
            }
        });
    }

    attachFormSubmitListener() {
        if (this.modal.form) {
            this.modal.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleModalSubmit();
            });
        }
    }

    openModalForCreate(status, onSave) {
        this.currentEditingTaskId = null;
        this.onSave = onSave;
        this.resetModalForm();
        this.setModalTitle('Add New Task');
        this.setStatusField(status);
        this.updateModalButton();
        this.openModal();
    }

    openModalForEdit(taskData, onSave) {
        this.currentEditingTaskId = taskData.id;
        this.onSave = onSave;
        this.resetModalForm();
        this.setModalTitle('Edit Task');
        this.populateFormFields(taskData);
        this.updateModalButton();
        this.openModal();
    }

    setModalTitle(title) {
        if (this.modal.title) {
            this.modal.title.textContent = title;
        }
    }

    setStatusField(status) {
        const $statusField = document.getElementById('TASK_STATUS');
        if ($statusField) {
            $statusField.value = status;
        }
    }

    populateFormFields(taskData) {
        const $titleField = document.getElementById('TASK_TITLE');
        const $descField = document.getElementById('TASK_DESCRIPTION');
        const $statusField = document.getElementById('TASK_STATUS');
        const $deadlineField = document.getElementById('TASK_DEADLINE');

        if ($titleField) $titleField.value = taskData.title || '';
        if ($descField) $descField.value = taskData.description || '';
        if ($statusField) $statusField.value = taskData.status || TASK_STATUS.TODO;
        if ($deadlineField) $deadlineField.value = taskData.deadline || '';
    }

    updateModalButton() {
        const $submitBtn = this.modal.footer?.querySelector('button[type="submit"]');
        if ($submitBtn) {
            $submitBtn.textContent = this.currentEditingTaskId ? 'Update Task' : 'Add Task';
        }
    }

    openModal() {
        if (this.modal.overlay) {
            this.modal.overlay.classList.add('is-open');
            this.modal.overlay.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }
        this.focusFirstField();
    }

    focusFirstField() {
        const focusable = this.getFocusableElements();
        const firstInput = focusable.find((el) => {
            const id = el.id;
            return id === 'TASK_TITLE' || id === 'TASK_DESCRIPTION' || id === 'TASK_STATUS' || id === 'TASK_DEADLINE';
        }) || focusable[0];
        if (firstInput) {
            requestAnimationFrame(() => {
                firstInput.focus();
            });
        }
    }

    closeModal() {
        if (this.modal.overlay) {
            this.modal.overlay.classList.remove('is-open');
            this.modal.overlay.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }
        this.resetModalForm();
    }

    resetModalForm() {
        if (this.modal.form) {
            this.modal.form.reset();
        }
    }

    handleModalSubmit() {
        if (!this.modal.form) return;

        const taskData = this.extractFormData();
        if (!this.validateTaskData(taskData)) return;

        if (this.onSave) {
            this.onSave(taskData, this.currentEditingTaskId);
        }

        this.closeModal();
    }

    extractFormData() {
        const formData = new FormData(this.modal.form);
        return {
            title: formData.get('title'),
            description: formData.get('description'),
            status: formData.get('status') || TASK_STATUS.TODO,
            deadline: formData.get('deadline'),
        };
    }

    validateTaskData(taskData) {
        if (!taskData.title.trim()) {
            alert('Please enter a task title');
            return false;
        }
        return true;
    }
}
