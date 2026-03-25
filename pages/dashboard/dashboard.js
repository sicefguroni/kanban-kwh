import { StorageService } from '../../services/storage-service.js';
import authService from '../../services/auth-service.js';
import apiService from '../../services/api-service.js';
import { COLUMN_STATUSES } from './constants.js';
import { DashboardDOM } from './dom/dashboard-dom.js';
import { DashboardRender } from './dom/dashboard-render.js';
import { DashboardDeleteModal } from './modals/dashboard-delete-modal.js';
import { DashboardModal } from './modals/dashboard-modal.js';
import { setupKeyboard } from './interactions/dashboard-keyboard.js';
import { setupProximitySnapping } from './interactions/dashboard-proximity.js';

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

        const logoutBtn = document.getElementById('logout-btn');
        logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            apiService.logout();
            authService.clearAuth();
            window.location.href = '../../login.html';
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
            StorageService.moveTask(taskId, newStatus, insertIndex);
            this.renderTasks();
            this.keyboard?.selectTaskId(taskId);
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
            onConfirmDelete: (taskId) => {
                StorageService.deleteTask(taskId);
                this.renderTasks();
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
