import { DashboardDOM } from './dashboard-dom.js';

export class DashboardModal {
    constructor() {
        this.modal = null;
        this.currentEditingTaskId = null;
    }

    init() {
        this.createModal();
    }

    createModal() {
        const $template = document.getElementById('modal-template');
        if (!$template?.content) return;

        const modalClone = $template.content.cloneNode(true);
        this.appendModalFields(modalClone);
        document.body.appendChild(modalClone);
        this.initializeModalElements();
        this.setupModalButtons();
        this.attachModalEventListeners();
    }

    appendModalFields(modalClone) {
        const $fieldsTemplate = document.getElementById('modal-field-template');
        if (!$fieldsTemplate?.content) return;

        const $fieldsContainer = modalClone.querySelector('#modal-form-fields');
        if ($fieldsContainer) {
            $fieldsContainer.appendChild($fieldsTemplate.content.cloneNode(true));
        }
    }

    initializeModalElements() {
        this.modal = {
            overlay: document.querySelector('.modal-overlay'),
            form: document.getElementById('add-task-form'),
            title: document.querySelector('.modal__title'),
            closeBtn: document.querySelector('.modal__close'),
            footer: document.querySelector('#modal-footer-actions'),
        };
    }

    setupModalButtons() {
        if (!this.modal.footer) return;

        const $cancelBtn = DashboardDOM.createCancelButton();
        const $submitBtn = DashboardDOM.createSubmitButton(!!this.currentEditingTaskId);
        this.modal.footer.appendChild($cancelBtn);
        this.modal.footer.appendChild($submitBtn);
        $cancelBtn.addEventListener('click', () => this.closeModal());
    }

    attachModalEventListeners() {
        this.attachCloseButtonListener();
        this.attachOverlayClickListener();
        this.attachEscapeKeyListener();
        this.attachFormSubmitListener();
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
        const $statusField = document.getElementById('task-status');
        if ($statusField) {
            $statusField.value = status;
        }
    }

    populateFormFields(taskData) {
        const $titleField = document.getElementById('task-title');
        const $descField = document.getElementById('task-description');
        const $statusField = document.getElementById('task-status');
        const $deadlineField = document.getElementById('task-deadline');

        if ($titleField) $titleField.value = taskData.title || '';
        if ($descField) $descField.value = taskData.description || '';
        if ($statusField) $statusField.value = taskData.status || 'To Do';
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
            status: formData.get('status') || 'To Do',
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
