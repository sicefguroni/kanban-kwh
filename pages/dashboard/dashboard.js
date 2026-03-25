import { StorageService } from '../../services/storage-service.js';
import APIService from '../../services/api-service.js';
import { COLUMN_STATUSES } from './constants.js';
import { DashboardDOM } from './dom/dashboard-dom.js';
import { DashboardRender } from './dom/dashboard-render.js';
import { DashboardDeleteModal } from './modals/dashboard-delete-modal.js';
import { DashboardModal } from './modals/dashboard-modal.js';
import { setupKeyboard } from './interactions/dashboard-keyboard.js';
import { setupProximitySnapping } from './interactions/dashboard-proximity.js';
import { setupWebSocketIntegration, connectWebSocket, disconnectWebSocket } from './interactions/webSocketIntegration.js';

const COMPONENTS = [
    'pages/dashboard/dashboard.html',
    'components/card/card.html',
    'components/column/column.html',
    'components/button/button.html',
    'components/modal-field/modal-field.html',
    'components/modal/modal.html',
    'components/delete-modal/delete-modal.html'
];

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
        this.keyboard = null;
    }

    async loadComponents() {
        const requests = COMPONENTS.map(url =>
            fetch(url).then(r => {
                if (!r.ok) throw new Error(`Failed to load ${url}`);
                return r.text();
            })
        );
        const htmls = await Promise.all(requests);
        htmls.forEach(html => document.body.insertAdjacentHTML('beforeend', html));
    }

    initColumns() {
        COLUMN_STATUSES.forEach((status, index) => {
            const columnInstance = new this.KanbanColumn({
                title: status,
                count: 0,
                shortcutKey: String(index + 1),
            });
            columnInstance.render('#DASHBOARD_GRID .app');
            this.columnInstances[status] = columnInstance;
            this.attachColumnListeners(columnInstance, status);
        });
    }

    initAddTaskButton() {
        const $container = document.getElementById('ADD_TASK_BTN_CONTAINER');
        if (!$container) return;
        const $btn = DashboardDOM.createAddTaskButton();
        $container.appendChild($btn);
        this.$addTaskBtn = $btn;
        this.attachAddTaskButtonListener();
    }

    initMobileDropBar() {
        const dashboard = document.querySelector('.dashboard');
        if (!dashboard || document.getElementById('MOBILE_DROP_BAR')) return;

        const self = this;
        const mobileMql = window.matchMedia('(max-width: 767px)');
        let lastDragoverClientX = null;
        let overlay = null;

        const bar = document.createElement('div');
        bar.id = 'MOBILE_DROP_BAR';
        bar.className = 'mobile-drop-bar';
        bar.setAttribute('aria-label', 'Drop zone for moving tasks');
        bar.innerHTML = COLUMN_STATUSES.map(
            (status) =>
                `<div class="mobile-drop-bar__zone" data-status="${status}">${status}</div>`
        ).join('');
        dashboard.appendChild(bar);

        function statusFromClientX(clientX) {
            const w = document.documentElement.clientWidth || 1;
            if (clientX == null || Number.isNaN(clientX) || clientX <= 0) {
                const mid = w / 2;
                clientX = mid;
            }
            const x = Math.max(0, Math.min(clientX, w - 1));
            const i = Math.floor((x / w) * COLUMN_STATUSES.length);
            return COLUMN_STATUSES[Math.max(0, Math.min(i, COLUMN_STATUSES.length - 1))];
        }

        function hideDropUI() {
            bar.classList.remove('is-visible');
            lastDragoverClientX = null;
            bar.querySelectorAll('.mobile-drop-bar__zone').forEach((z) => z.classList.remove('is-drag-over'));
            if (overlay && overlay.parentNode) {
                overlay.remove();
                overlay = null;
            }
        }

        function performDrop(taskId, status) {
            if (!taskId || !status) return;
            hideDropUI();
            self.handleDropCard(status, taskId, undefined);
        }

        bar.querySelectorAll('.mobile-drop-bar__zone').forEach((zone) => {
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                zone.classList.add('is-drag-over');
            });
            zone.addEventListener('dragleave', (e) => {
                if (!zone.contains(e.relatedTarget)) zone.classList.remove('is-drag-over');
            });
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const taskId = e.dataTransfer.getData('text/plain');
                const status = zone.dataset.status;
                performDrop(taskId, status);
            });
        });

        function showOverlay() {
            if (overlay) return;
            overlay = document.createElement('div');
            overlay.id = 'MOBILE_DROP_OVERLAY';
            overlay.className = 'mobile-drop-overlay is-visible';
            overlay.setAttribute('aria-hidden', 'true');

            overlay.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                lastDragoverClientX = e.clientX;
                const status = statusFromClientX(e.clientX);
                bar.querySelectorAll('.mobile-drop-bar__zone').forEach((z) => {
                    z.classList.toggle('is-drag-over', z.dataset.status === status);
                });
            });
            overlay.addEventListener('dragleave', (e) => {
                if (!overlay?.contains(e.relatedTarget)) {
                    lastDragoverClientX = null;
                    bar.querySelectorAll('.mobile-drop-bar__zone').forEach((z) => z.classList.remove('is-drag-over'));
                }
            });
            overlay.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const taskId = e.dataTransfer.getData('text/plain');
                const x = lastDragoverClientX ?? e.clientX;
                const status = statusFromClientX(x);
                performDrop(taskId, status);
            });

            dashboard.appendChild(overlay);
        }

        document.addEventListener('dragstart', (e) => {
            if (!e.target.closest('.kanban-card[data-task-id]')) return;
            if (!mobileMql.matches) return;
            lastDragoverClientX = null;
            bar.classList.add('is-visible');
            requestAnimationFrame(() => {
                showOverlay();
            });
        });

        document.addEventListener('dragend', () => {
            setTimeout(hideDropUI, 0);
        });
    }

    attachAddTaskButtonListener() {
        if (!this.$addTaskBtn) return;
        this.$addTaskBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.openModalForCreate('To Do');
        });
    }

    initModal() {
        this.modal.init();
    }

    attachColumnListeners(columnInstance, status) {
        columnInstance.setAddTaskListener(() => this.openModalForCreate(status));
        columnInstance.setDropZoneListeners(
            () => {},
            () => {},
            (newStatus, taskId, insertIndex) => this.handleDropCard(newStatus, taskId, insertIndex)
        );
    }

    openModalForCreate(status) {
        this.modal.openModalForCreate(status, (taskData, taskId) => this.saveTask(taskData, taskId));
    }

    openModalForEdit(taskData) {
        this.modal.openModalForEdit(taskData, (taskData, taskId) => this.saveTask(taskData, taskId));
    }

    saveTask(taskData, taskId) {
        let selectedId = null;
        const userId = localStorage.getItem('userId') || 'demo-user-123';

        try {
            if (taskId) {
                // Update existing task via API
                APIService.updateTask(taskId, {
                    title: taskData.title,
                    description: taskData.description,
                    status: taskData.status
                }).then(updatedTask => {
                    // Convert server response to client format and save to localStorage
                    const clientTask = {
                        id: updatedTask.id,
                        title: updatedTask.title,
                        description: updatedTask.description || '',
                        status: updatedTask.status,
                        order: updatedTask.position || 0,
                        createdAt: updatedTask.created_at,
                        deadline: ''
                    };
                    StorageService.updateTask(taskId, clientTask);
                    this.renderTasks();
                    selectedId = taskId;
                    if (selectedId) this.keyboard?.selectTaskId(selectedId);
                }).catch(err => {
                    console.error('Failed to update task via API, saving to localStorage only:', err);
                    // Fallback to localStorage if API fails
                    StorageService.updateTask(taskId, taskData);
                    this.renderTasks();
                    selectedId = taskId;
                    if (selectedId) this.keyboard?.selectTaskId(selectedId);
                });
            } else {
                // Create new task via API
                APIService.createTask({
                    userId,
                    title: taskData.title,
                    description: taskData.description,
                    status: taskData.status || 'todo',
                    position: 0
                }).then(newTaskFromAPI => {
                    // Convert server response to client format
                    const clientTask = {
                        id: newTaskFromAPI.id,
                        title: newTaskFromAPI.title,
                        description: newTaskFromAPI.description || '',
                        status: newTaskFromAPI.status,
                        order: newTaskFromAPI.position || 0,
                        createdAt: newTaskFromAPI.created_at,
                        deadline: ''
                    };
                    // Save to localStorage
                    const tasks = StorageService.getTasks();
                    if (!tasks.find(t => t.id === clientTask.id)) {
                        tasks.push(clientTask);
                        StorageService.saveTasks(tasks);
                    }
                    this.renderTasks();
                    selectedId = newTaskFromAPI.id;
                    if (selectedId) this.keyboard?.selectTaskId(selectedId);
                }).catch(err => {
                    console.error('Failed to create task via API, saving to localStorage only:', err);
                    // Fallback to localStorage if API fails
                    const newTask = StorageService.addTask(taskData);
                    if (newTask) selectedId = newTask.id;
                    this.renderTasks();
                    if (selectedId) this.keyboard?.selectTaskId(selectedId);
                });
            }
        } catch (error) {
            console.error('Error in saveTask:', error);
            // Fallback to localStorage
            if (taskId) {
                StorageService.updateTask(taskId, taskData);
                selectedId = taskId;
            } else {
                const newTask = StorageService.addTask(taskData);
                if (newTask) selectedId = newTask.id;
            }
            this.renderTasks();
            if (selectedId) this.keyboard?.selectTaskId(selectedId);
        }
    }

    renderTasks() {
        if (!this.renderer) this.renderer = new DashboardRender(this.columnInstances);
        this.renderer.renderTasks(
            (taskData) => this.openModalForEdit(taskData),
            (taskId) => this.handleDeleteTask(taskId)
        );
        this.keyboard?.syncFocus();
    }

    handleDeleteTask(taskId) {
        this.deleteModal.open(taskId);
    }

    handleDropCard(newStatus, taskId, insertIndex) {
        const task = StorageService.getTask(taskId);
        if (task) {
            // Calculate new position for the task
            const tasksInNewStatus = StorageService.getTasksByStatus(newStatus);
            const position = insertIndex !== undefined && insertIndex >= 0 && insertIndex <= tasksInNewStatus.length
                ? insertIndex
                : tasksInNewStatus.length;

            // Update via API
            APIService.updateTask(taskId, {
                status: newStatus,
                position: position
            })
                .then(updatedTask => {
                    // Convert and save to localStorage
                    const clientTask = {
                        ...task,
                        status: newStatus,
                        order: position
                    };
                    StorageService.moveTask(taskId, newStatus, insertIndex);
                    this.renderTasks();
                    this.keyboard?.selectTaskId(taskId);
                })
                .catch(err => {
                    console.error('Failed to move task via API, falling back to localStorage:', err);
                    // Fallback to localStorage if API fails
                    StorageService.moveTask(taskId, newStatus, insertIndex);
                    this.renderTasks();
                    this.keyboard?.selectTaskId(taskId);
                });
        }
    }

    handleProximityDrop(columnInstance, taskId) {
        if (!columnInstance?.onDropCallback || !taskId) return;
        const task = StorageService.getTask(taskId);
        if (task) columnInstance.onDropCallback(columnInstance.title, taskId, undefined);
    }

    clearAllSnapEffects() {
        COLUMN_STATUSES.forEach(status => {
            const columnInstance = this.columnInstances[status];
            if (columnInstance && typeof columnInstance.clearSnapEffect === 'function') {
                columnInstance.clearSnapEffect();
            }
        });
    }

    async init() {
        await this.loadComponents();
        this.initColumns();
        this.initAddTaskButton();
        this.initModal();
        this.initMobileDropBar();

        this.renderer = new DashboardRender(this.columnInstances);

        setupProximitySnapping({
            columnInstances: this.columnInstances,
            onProximityDrop: (col, taskId) => this.handleProximityDrop(col, taskId),
            clearSnapEffects: () => this.clearAllSnapEffects(),
        });

        this.deleteModal.init({
            onConfirmDelete: (taskId) => {
                // Delete via API (which will broadcast via WebSocket)
                APIService.deleteTask(taskId)
                    .then(() => {
                        StorageService.deleteTask(taskId);
                        this.renderTasks();
                    })
                    .catch(err => {
                        console.error('Failed to delete task via API, falling back to localStorage:', err);
                        // Fallback to localStorage if API fails
                        StorageService.deleteTask(taskId);
                        this.renderTasks();
                    });
            },
        });

        this.keyboard = setupKeyboard({
            columnInstances: this.columnInstances,
            onEditTask: (taskId) => {
                const task = StorageService.getTask(taskId);
                if (task) this.openModalForEdit(task);
            },
            onDeleteTask: (taskId) => this.handleDeleteTask(taskId),
            onCreateTask: (status) => this.openModalForCreate(status),
            onMoveTask: (taskId, newStatus, insertIndex) => this.handleDropCard(newStatus, taskId, insertIndex),
            isModalOpen: () => document.querySelector('.modal-overlay.is-open') != null,
        });

        // Initialize user and WebSocket - use shared demo user so both browsers sync
        const DEMO_EMAIL = 'demo@kanban.local';
        const DEMO_USER_NAME = 'Demo User';
        let userId = null;

        // Try to get existing demo user by email or create one
        try {
            try {
                // Try to get existing user by email
                const existingUser = await fetch(`http://localhost:3002/api/users/email/${encodeURIComponent(DEMO_EMAIL)}`)
                    .then(r => {
                        if (!r.ok) throw new Error('User not found');
                        return r.json();
                    });
                userId = existingUser.id;
                console.log('✓ Using existing demo user:', userId);
            } catch (err) {
                // User doesn't exist, create it
                const newUser = await APIService.createUser({
                    email: DEMO_EMAIL,
                    name: DEMO_USER_NAME
                });
                userId = newUser.id;
                console.log('✓ Created demo user:', userId);
            }
            localStorage.setItem('userId', userId);
        } catch (error) {
            console.error('Failed to initialize user:', error);
            // Fallback - generate a temporary ID (won't sync across browsers but won't crash)
            userId = `demo-${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('userId', userId);
        }

        // Setup WebSocket listeners
        this.wsCleanup = setupWebSocketIntegration({
            userId,
            onTaskCreated: (task) => this.renderTasks(),
            onTaskUpdated: (task) => this.renderTasks(),
            onTaskDeleted: (taskId) => this.renderTasks(),
        });

        // Connect to WebSocket
        connectWebSocket(userId);

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
