import { StorageService } from '../../services/storage-service.js';
import { COLUMN_STATUSES } from './constants.js';
import { DashboardDOM } from './dashboard-dom.js';
import { DashboardModal } from './dashboard-modal.js';
import { setupProximitySnapping } from './dashboard-proximity.js';
import { DashboardRender } from './dashboard-render.js';
import { DashboardDeleteModal } from './dashboard-delete-modal.js';

const COMPONENTS = [
    'pages/dashboard/dashboard.html',
    'components/card/card.html',
    'components/column/column.html',
    'components/button/button.html',
    'components/modal-field/modal-field.html',
    'components/modal/modal.html',
    'components/delete-modal/delete-modal.html'
];

class KanbanDashboard {
    constructor(KanbanCard, KanbanColumn) {
        this.KanbanCard = KanbanCard;
        this.KanbanColumn = KanbanColumn;
        this.columnInstances = {};
        this.modal = new DashboardModal();
        this.deleteModal = new DashboardDeleteModal();
        this.renderer = null;
        this.$addTaskBtn = null;
    }

    async loadComponents() {
        const requests = COMPONENTS.map(url =>
            fetch(url)
                .then(r => {
                    if (!r.ok) throw new Error(`Failed to load ${url}`);
                    return r.text();
                })
        );
        const htmls = await Promise.all(requests);
        htmls.forEach(html => {
            document.body.insertAdjacentHTML('beforeend', html);
        });
    }

    initColumns() {
        COLUMN_STATUSES.forEach(status => {
            const columnInstance = new this.KanbanColumn({
                title: status,
                count: 0,
            });
            columnInstance.render('#dashboard-grid .app');
            this.columnInstances[status] = columnInstance;
            this.attachColumnListeners(columnInstance, status);
        });
        this.renderer = new DashboardRender(this.columnInstances);
        setupProximitySnapping({
            columnInstances: this.columnInstances,
            onProximityDrop: (col, taskId) => this.handleProximityDrop(col, taskId),
            clearSnapEffects: () => this.clearAllSnapEffects(),
        });
    }

    handleProximityDrop(columnInstance, taskId) {
        if (!columnInstance.onDropCallback || !taskId) return;
        const task = StorageService.getTask(taskId);
        if (task) {
            columnInstance.onDropCallback(columnInstance.title, taskId, undefined);
        }
    }

    clearAllSnapEffects() {
        COLUMN_STATUSES.forEach(status => {
            const columnInstance = this.columnInstances[status];
            if (columnInstance) {
                columnInstance.clearSnapEffect();
            }
        });
    }

    attachColumnListeners(columnInstance, status) {
        columnInstance.setAddTaskListener(() => this.openModalForCreate(status));
        columnInstance.setDropZoneListeners(
            () => {},
            () => {},
            (newStatus, taskId, insertIndex) => this.handleDropCard(newStatus, taskId, insertIndex)
        );
    }

    initAddTaskButton() {
        const $container = document.getElementById('add-task-btn-container');
        if (!$container) return;

        const $btn = DashboardDOM.createAddTaskButton();
        $container.appendChild($btn);
        this.$addTaskBtn = $btn;
        this.attachAddTaskButtonListener();
    }

    attachAddTaskButtonListener() {
        this.$addTaskBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.openModalForCreate('To Do');
        });
    }

    initModal() {
        this.modal.init();
    }

    openModalForCreate(status) {
        this.modal.openModalForCreate(status, (taskData, taskId) => {
            this.saveTask(taskData, taskId);
        });
    }

    openModalForEdit(taskData) {
        this.modal.openModalForEdit(taskData, (taskData, taskId) => {
            this.saveTask(taskData, taskId);
        });
    }

    saveTask(taskData, taskId) {
        if (taskId) {
            StorageService.updateTask(taskId, taskData);
        } else {
            StorageService.addTask(taskData);
        }
        this.renderTasks();
    }

    renderTasks() {
        this.renderer.renderTasks(
            (taskData) => this.openModalForEdit(taskData),
            (taskId) => this.handleDeleteTask(taskId)
        );
    }

    handleDeleteTask(taskId) {
       this.deleteModal.open(taskId);
        }
    

    handleDropCard(newStatus, taskId, insertIndex) {
        const task = StorageService.getTask(taskId);
        if (task) {
            StorageService.moveTask(taskId, newStatus, insertIndex);
            this.renderTasks();
        }
    }

    async init() {
        await this.loadComponents();
        this.initColumns();
        this.initAddTaskButton();
        this.initModal();

        this.deleteModal.init({
            onConfirmDelete: (taskId) => {
                StorageService.deleteTask(taskId);
                this.renderTasks();
    },
});
        this.renderTasks();    
}
}       


async function initDashboard() {
    const { KanbanCard } = await import('../../components/card/card.js');
    const { KanbanColumn } = await import('../../components/column/column.js');

    const dashboard = new KanbanDashboard(KanbanCard, KanbanColumn);
    await dashboard.init();
}

initDashboard();
