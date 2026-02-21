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

const STORAGE_KEY = 'kanban_tasks';
const COLUMN_STATUSES = ['To Do', 'In Progress', 'Done'];

// ============ LocalStorage Manager ============
const StorageManager = {
    getTasks() {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    },

    saveTasks(tasks) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    },

    addTask(task) {
        const tasks = this.getTasks();
        const newTask = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            title: task.title,
            description: task.description || '',
            status: task.status,
            deadline: task.deadline || '',
            createdAt: new Date().toISOString(),
        };
        tasks.push(newTask);
        this.saveTasks(tasks);
        return newTask;
    },

    updateTask(id, updates) {
        let tasks = this.getTasks();
        tasks = tasks.map(task => (task.id === id ? { ...task, ...updates } : task));
        this.saveTasks(tasks);
    },

    deleteTask(id) {
        let tasks = this.getTasks();
        tasks = tasks.filter(task => task.id !== id);
        this.saveTasks(tasks);
    },

    getTasksByStatus(status) {
        return this.getTasks().filter(task => task.status === status);
    },

    moveTask(taskId, newStatus, isCheckbox = false) {
        const tasks = this.getTasks();
        const taskIndex = tasks.findIndex(t => t.id === taskId);

        if (taskIndex > -1) {
            const task = tasks[taskIndex];

            if (isCheckbox) {
                if (task.status === 'To Do') {
                    task.status = 'In Progress';
                } else if (task.status === 'In Progress') {
                    task.status = 'Done';
                } else if (task.status === 'Done') {
                    task.status = 'To Do';
                }
            } else {
                task.status = newStatus;
            }

            this.saveTasks(tasks);
        }
    },

    getTask(id) {
        return this.getTasks().find(task => task.id === id);
    },
};

// ============ Kanban Dashboard Manager ============
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

            // Attach listeners for column header (future: add task button)
            columnInstance.setAddTaskListener(() => this.openModalForCreate(status));
            columnInstance.setDropZoneListeners(
                () => { }, // onDragOver
                () => { }, // onDragLeave
                (newStatus, taskId) => this.handleDropCard(newStatus, taskId)
            );
        });
        console.log('Columns initialized:', Object.keys(this.columnInstances));
    }

    initAddTaskButton() {
        const { renderButton } = { renderButton: null };

        // Create button manually without external dependency
        const container = document.getElementById('add-task-btn-container');
        if (container) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = 'add-task-btn';
            btn.className = 'btn btn--primary';
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" /></svg><span>Add Task</span>';
            container.appendChild(btn);

            this.addTaskBtn = btn;
            this.addTaskBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openModalForCreate('To Do');
            });
        }
    }

    initModal() {
        this.createModal();
        console.log('Modal initialized');
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

    openModalForEdit(taskData) {
        this.currentEditingTaskId = taskData.id;
        this.resetModalForm();
        if (this.modal.title) {
            this.modal.title.textContent = 'Edit Task';
        }

        // Populate form with task data
        const titleField = document.getElementById('task-title');
        const descField = document.getElementById('task-description');
        const statusField = document.getElementById('task-status');
        const deadlineField = document.getElementById('task-deadline');

        if (titleField) titleField.value = taskData.title || '';
        if (descField) descField.value = taskData.description || '';
        if (statusField) statusField.value = taskData.status || 'To Do';
        if (deadlineField) deadlineField.value = taskData.deadline || '';
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
        // Clear existing cards
        COLUMN_STATUSES.forEach(status => {
            const container = this.columnInstances[status]?.getCardsContainer();
            if (container) {
                container.innerHTML = '';
            }
        });

        // Render tasks from storage
        COLUMN_STATUSES.forEach((status, index) => {
            const tasks = StorageManager.getTasksByStatus(status);
            const container = this.columnInstances[status]?.getCardsContainer();

            if (!container) return;

            tasks.forEach(taskData => {
                const card = new this.KanbanCard({
                    id: taskData.id,
                    title: taskData.title,
                    status: taskData.status,
                    description: taskData.description,
                    deadline: taskData.deadline,
                });

                // Render using column's container
                const template = document.getElementById('card-template');
                if (template) {
                    const cardClone = template.content.cloneNode(true);
                    const cardElement = cardClone.querySelector('.kanban-card');
                    cardElement.dataset.taskId = taskData.id;
                    cardElement.draggable = true;

                    // Populate card
                    const titleEl = cardElement.querySelector('.kanban-card__title');
                    const descEl = cardElement.querySelector('.kanban-card__description');
                    const deadlineEl = cardElement.querySelector('.kanban-card__deadline');
                    const checkbox = cardElement.querySelector('.kanban-card__checkbox');

                    if (titleEl) titleEl.textContent = taskData.title;
                    if (descEl) descEl.textContent = taskData.description || '';
                    if (deadlineEl) deadlineEl.textContent = taskData.deadline ? `📅 ${taskData.deadline}` : '';

                    // --- CHECKBOX LOGIC ---
                    if (checkbox) {
                        checkbox.checked = taskData.status === 'Done';

                        checkbox.addEventListener('change', () => {
                            StorageManager.moveTask(taskData.id, null, true);

                            this.renderTasks();
                        });
                    }

                    // Add event listeners
                    const editBtn = cardElement.querySelector('.kanban-card__edit-btn');
                    const deleteBtn = cardElement.querySelector('.kanban-card__delete-btn');

                    if (editBtn) {
                        editBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.openModalForEdit(taskData);
                        });
                    }

                    if (deleteBtn) {
                        deleteBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.handleDeleteTask(taskData.id);
                        });
                    }

                    // Set up drag listeners with visual feedback
                    cardElement.addEventListener('dragstart', (e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', taskData.id);

                        // Add visual feedback with delay to ensure it takes effect
                        setTimeout(() => {
                            cardElement.classList.add('is-dragging');
                        }, 0);
                    });

                    cardElement.addEventListener('dragend', () => {
                        cardElement.classList.remove('is-dragging');

                        // Clear all drag-over states
                        document.querySelectorAll('.kanban-column__cards').forEach(c => {
                            c.classList.remove('is-drag-over');
                        });
                        document.querySelectorAll('.kanban-column__content').forEach(c => {
                            c.classList.remove('is-drag-active');
                        });
                    });

                    container.appendChild(cardClone);
                }
            });

            // Update column counter
            this.columnInstances[status]?.updateCounter(tasks.length);
        });
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
