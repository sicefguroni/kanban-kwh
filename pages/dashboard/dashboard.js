import { StorageService } from '../../services/storage-service.js';
import authService from '../../services/auth-service.js';
import apiService from '../../services/api-service.js';
import SyncManager from '../../services/sync-manager.js';
import { COLUMN_STATUSES, TASK_STATUS } from './constants.js';
import { DashboardDOM } from './dom/dashboard-dom.js';
import { DashboardRender } from './dom/dashboard-render.js';
import { DashboardDeleteModal } from './modals/dashboard-delete-modal.js';
import { DashboardModal } from './modals/dashboard-modal.js';
import { setupKeyboard } from './interactions/dashboard-keyboard.js';
import { setupProximitySnapping } from './interactions/dashboard-proximity.js';
import { setupMobileDrop } from './interactions/mobile-drop.js';
import { setupWebSocketIntegration, connectWebSocket, disconnectWebSocket } from './interactions/websocket-integration.js';

// Check authentication on page load
if (!authService.isLoggedIn()) {
    window.location.href = '../../login.html';
}

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
        this.$syncBadge = null;
        this.keyboard = null;
        this.syncManager = null;
        this._mobileDropCleanup = null;
        this._visibilityTimer = null;
        this._pollTimer = null;
        this._onVisibilityChange = null;
        // Serialize operations that mutate tasks + re-render.
        // This prevents race conditions when multiple UI events happen quickly.
        this._opChain = Promise.resolve();

        // Stable handler references to avoid re-creating closures on every re-render.
        this._onEditTaskRendered = (taskData) => this.openModalForEdit(taskData);
        this._onDeleteTaskRendered = (taskId) => this.handleDeleteTask(taskId);
        this._onAfterStatusChangeRendered = (taskId) => this.pushTaskMoveToServer(taskId);
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

    initAuthActions() {
        const container = document.getElementById('AUTH_ACTIONS_CONTAINER');
        if (!container) return;

        const user = authService.getUser();
        const userEmail = user ? user.email : 'User';

        container.innerHTML = `
            <div class="auth-actions">
                <span class="auth-actions__user">${userEmail}</span>
                <button class="auth-actions__logout-btn" id="logout-btn">Logout</button>
            </div>
        `;

        this.$syncBadge = document.getElementById('SYNC_STATUS_BADGE');

        const logoutBtn = document.getElementById('logout-btn');
        logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            clearTimeout(this._visibilityTimer);
            this._visibilityTimer = null;
            clearInterval(this._pollTimer);
            this._pollTimer = null;
            if (this._onVisibilityChange) {
                document.removeEventListener('visibilitychange', this._onVisibilityChange);
            }
            this.wsCleanup?.();
            this.syncManager?.destroy();
            disconnectWebSocket();
            apiService.logout();
            authService.clearAuth();
            window.location.href = '../../login.html';
        }
    }

    setSyncBadge({ online, syncing, queueSize, lastError }) {
        if (!this.$syncBadge) return;

        this.$syncBadge.classList.remove('is-online', 'is-offline', 'is-syncing', 'is-error');

        if (lastError) {
            this.$syncBadge.textContent = 'Sync error';
            this.$syncBadge.classList.add('is-error');
            return;
        }

        if (!online) {
            this.$syncBadge.textContent = queueSize > 0 ? `Offline (${queueSize} pending)` : 'Offline';
            this.$syncBadge.classList.add('is-offline');
            return;
        }

        if (syncing) {
            this.$syncBadge.textContent = queueSize > 0 ? `Syncing ${queueSize}...` : 'Syncing...';
            this.$syncBadge.classList.add('is-syncing');
            return;
        }

        if (queueSize > 0) {
            this.$syncBadge.textContent = `Pending sync (${queueSize})`;
            this.$syncBadge.classList.add('is-syncing');
            return;
        }

        this.$syncBadge.textContent = 'Online';
        this.$syncBadge.classList.add('is-online');
    }

    async queueAction(action) {
        await StorageService.addToSyncQueue(action);
    }

    /** Push local move (status/order) to the API or offline queue; used by drag-drop and checkbox. */
    async pushTaskMoveToServer(taskId) {
        const moved = await StorageService.getTask(taskId);
        if (!moved) return;
        try {
            if (!navigator.onLine) throw new Error('offline');
            const serverTask = await apiService.updateTask(taskId, {
                status: moved.status,
                position: moved.order || 0,
                updated_at: moved.updated_at,
            });
            await StorageService.upsertTaskFromServer(serverTask);
        } catch (error) {
            await this.queueAction({
                action: 'move',
                taskId,
                task: moved,
                updated_at: moved.updated_at,
            });
        }
        await this.syncManager?.syncNow?.();
    }

    async syncFromServerIfOnline() {
        if (!navigator.onLine) return;
        try {
            const serverTasks = await apiService.getTasks();
            await StorageService.replaceLocalTasks(serverTasks || []);
        } catch (error) {
            console.warn('Failed to refresh tasks from server:', error?.message || error);
        }
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
        // Separated to `interactions/mobile-drop.js`
        this._mobileDropCleanup?.();
        this._mobileDropCleanup = setupMobileDrop({
            onDrop: (status, taskId) => this.handleDropCard(status, taskId, undefined),
        });
    }

    attachAddTaskButtonListener() {
        if (!this.$addTaskBtn) return;
        this.$addTaskBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.openModalForCreate(TASK_STATUS.TODO);
        });
    }

    initModal() {
        this.modal.init();
    }

    attachColumnListeners(columnInstance, status) {
        columnInstance.setAddTaskListener(() => this.openModalForCreate(status));
        columnInstance.setDropZoneListeners(
            () => { },
            () => { },
            (newStatus, taskId, insertIndex) => this.handleDropCard(newStatus, taskId, insertIndex)
        );
    }

    openModalForCreate(status) {
        this.modal.openModalForCreate(status, (taskData, taskId) => this.saveTask(taskData, taskId));
    }

    openModalForEdit(taskData) {
        this.modal.openModalForEdit(taskData, (taskData, taskId) => this.saveTask(taskData, taskId));
    }

    async saveTask(taskData, taskId) {
        const userId = authService.getUserId() || null;
        let selectedId = null;

        if (taskId) {
            const updatedTask = await StorageService.updateTask(taskId, {
                ...taskData,
                updated_at: new Date().toISOString(),
            });
            if (!updatedTask) return;
            selectedId = taskId;

            try {
                if (!navigator.onLine) throw new Error('offline');
                const serverTask = await apiService.updateTask(taskId, {
                    title: updatedTask.title,
                    description: updatedTask.description,
                    status: updatedTask.status,
                    position: updatedTask.order || 0,
                    updated_at: updatedTask.updated_at,
                });
                await StorageService.upsertTaskFromServer(serverTask);
            } catch (error) {
                await this.queueAction({
                    action: 'update',
                    taskId,
                    task: updatedTask,
                    updated_at: updatedTask.updated_at,
                });
            }
            await this.syncManager?.syncNow?.();
        } else {
            const newTask = await StorageService.addTask({
                ...taskData,
                user_id: userId,
                updated_at: new Date().toISOString(),
            });
            if (newTask) selectedId = newTask.id;

            try {
                if (!navigator.onLine) throw new Error('offline');
                const serverTask = await apiService.createTask({
                    id: newTask.id,
                    userId,
                    title: newTask.title,
                    description: newTask.description,
                    status: newTask.status,
                    position: newTask.order || 0,
                    updated_at: newTask.updated_at,
                });
                await StorageService.upsertTaskFromServer(serverTask);
            } catch (error) {
                await this.queueAction({
                    action: 'create',
                    taskId: newTask.id,
                    task: newTask,
                    updated_at: newTask.updated_at,
                });
            }
            await this.syncManager?.syncNow?.();
        }

        await this.renderTasks();
        if (selectedId) this.keyboard?.selectTaskId(selectedId);
    }

    async renderTasks() {
        if (!this.renderer) this.renderer = new DashboardRender(this.columnInstances);
        await this.renderer.renderTasks(
            this._onEditTaskRendered,
            this._onDeleteTaskRendered,
            this._onAfterStatusChangeRendered
        );
    }

    handleDeleteTask(taskId) {
        this.deleteModal.open(taskId);
    }

    async handleDropCard(newStatus, taskId, insertIndex) {
        const task = await StorageService.getTask(taskId);
        if (task) {
            const movedTask = await StorageService.moveTask(taskId, newStatus, insertIndex);
            if (!movedTask) return;
            await this.renderTasks();
            this.keyboard?.selectTaskId(taskId);
            await this.pushTaskMoveToServer(taskId);
        }
    }

    handleProximityDrop(columnInstance, taskId) {
        if (!columnInstance?.onDropCallback || !taskId) return;
        // Just trigger the same move logic as a normal drop.
        columnInstance.onDropCallback(columnInstance.title, taskId, undefined);
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
        await StorageService.init();
        this.initAuthActions();
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
            onConfirmDelete: async (taskId) => {
                const task = await StorageService.getTask(taskId);
                await StorageService.deleteTask(taskId);
                await this.renderTasks();

                try {
                    if (!navigator.onLine) throw new Error('offline');
                    await apiService.deleteTask(taskId);
                } catch (error) {
                    await this.queueAction({
                        action: 'delete',
                        taskId,
                        task,
                        updated_at: new Date().toISOString(),
                    });
                }
                await this.syncManager?.syncNow?.();
            },
        });

        this.keyboard = setupKeyboard({
            columnInstances: this.columnInstances,
            onEditTask: (taskId) => {
                this._opChain = this._opChain.then(async () => {
                    const task = await StorageService.getTask(taskId);
                    if (task) this.openModalForEdit(task);
                }).catch((err) => {
                    // eslint-disable-next-line no-console
                    console.error(err);
                });
            },
            onDeleteTask: (taskId) => this.handleDeleteTask(taskId),
            onCreateTask: (status) => this.openModalForCreate(status),
            onMoveTask: (taskId, newStatus, insertIndex) => this.handleDropCard(newStatus, taskId, insertIndex),
            isModalOpen: () => document.querySelector('.modal-overlay.is-open') != null,
        });

        // Re-apply keyboard focus after we re-render the board.
        this.renderer._afterRender = () => this.keyboard?.syncFocus();

        this.syncManager = new SyncManager({
            onStatusChange: (status) => this.setSyncBadge(status),
            onAfterSync: async () => {
                await this.syncFromServerIfOnline();
                await this.renderTasks();
            },
        });
        await this.syncManager.init();

        await this.syncFromServerIfOnline();

        const userId = authService.getUserId();
        if (userId) {
            localStorage.setItem('userId', userId);
        }

        // Realtime: WebSocket pushes task events; polling covers WS down / missed events
        this.wsCleanup = setupWebSocketIntegration({
            userId,
            onRefresh: async () => {
                await this.renderTasks();
            },
        });

        if (userId) {
            connectWebSocket(userId).catch(() => {});
        } else {
            console.warn('No user id — skipping WebSocket (login user.id must be set)');
        }

        this._onVisibilityChange = () => {
            if (document.visibilityState !== 'visible' || !navigator.onLine) return;
            clearTimeout(this._visibilityTimer);
            this._visibilityTimer = setTimeout(async () => {
                await this.syncFromServerIfOnline();
                await this.renderTasks();
                await this.syncManager?.syncNow?.();
                if (userId) {
                    connectWebSocket(userId).catch(() => {});
                }
            }, 300);
        };
        document.addEventListener('visibilitychange', this._onVisibilityChange);

        this._pollTimer = setInterval(() => {
            if (document.visibilityState !== 'visible' || !navigator.onLine) return;
            this.syncFromServerIfOnline()
                .then(() => this.renderTasks())
                .catch(() => {});
        }, 10000);

        await this.renderTasks();
    }
}


async function initDashboard() {
    const { KanbanCard } = await import('../../components/card/card.js');
    const { KanbanColumn } = await import('../../components/column/column.js');

    const dashboard = new KanbanDashboard(KanbanCard, KanbanColumn);
    await dashboard.init();
}

initDashboard();
