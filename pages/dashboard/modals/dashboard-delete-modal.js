import { initDeleteModal, openDeleteModal, closeDeleteModal } from '../../../components/delete-modal/delete-modal.js';

export class DashboardDeleteModal {
    constructor() {
        this.pendingTaskId = null;
        this.onConfirmDelete = null;
        this.initialized = false;
    }

    init({ onConfirmDelete } = {}) {
        this.onConfirmDelete = onConfirmDelete;

        initDeleteModal({
            onSubmit: () => {
                if (!this.pendingTaskId) return;
                if (this.onConfirmDelete) this.onConfirmDelete(this.pendingTaskId);
                this.pendingTaskId = null;
                closeDeleteModal();
            },
        });

        this.initialized = true;
    }

    open(taskId) {
        if (!this.initialized) return;
        this.pendingTaskId = taskId;
        openDeleteModal();
    }

    close() {
        closeDeleteModal();
    }
}
