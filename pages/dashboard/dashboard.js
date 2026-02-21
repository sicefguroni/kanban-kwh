const COMPONENTS = [
    'pages/dashboard/dashboard.html',
    'components/card/card.html',
    'components/column/column.html',
    'components/button/button.html',
    'components/modal-field/modal-field.html',
    'components/modal/modal.html',
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

    moveTask(taskId, newStatus) {
        const tasks = this.getTasks();
        const taskIndex = tasks.findIndex(t => t.id === taskId);

        if (taskIndex > -1) {
            const task = tasks[taskIndex];

            // If moving to DONE, remember where we are right now
            if (newStatus === 'Done') {
                task.previousStatus = task.status;
            }

            task.status = newStatus;
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
        this.columns = {};
        this.columnInstances = {};
        this.modal = null;
        this.currentEditingTaskId = null;
        this.addTaskBtn = null;
    }

    async loadComponents() {
        try {
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
            console.log('Components loaded successfully');
        } catch (error) {
            console.error('Error loading components:', error);
            throw error;
        }
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
    }

    createModal() {
        const template = document.getElementById('modal-template');
        if (!template?.content) {
            console.error('Modal template not found');
            return;
        }

        const modalClone = template.content.cloneNode(true);
        const fieldsTemplate = document.getElementById('modal-field-template');
        if (fieldsTemplate?.content) {
            const fieldsContainer = modalClone.querySelector('#modal-form-fields');
            if (fieldsContainer) {
                fieldsContainer.appendChild(fieldsTemplate.content.cloneNode(true));
            }
        }

        document.body.appendChild(modalClone);

        this.modal = {
            overlay: document.querySelector('.modal-overlay'),
            form: document.getElementById('add-task-form'),
            title: document.querySelector('.modal__title'),
            closeBtn: document.querySelector('.modal__close'),
            footer: document.querySelector('#modal-footer-actions'),
        };

        this.setupModalButtons();
        this.attachModalEventListeners();
    }

    setupModalButtons() {
        if (!this.modal.footer) return;

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn--secondary modal__cancel';
        cancelBtn.textContent = 'Cancel';

        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'btn btn--primary';
        submitBtn.textContent = this.currentEditingTaskId ? 'Update Task' : 'Add Task';

        this.modal.footer.appendChild(cancelBtn);
        this.modal.footer.appendChild(submitBtn);

        cancelBtn.addEventListener('click', () => this.closeModal());
    }

    attachModalEventListeners() {
        if (this.modal.closeBtn) {
            this.modal.closeBtn.addEventListener('click', () => this.closeModal());
        }

        if (this.modal.overlay) {
            this.modal.overlay.addEventListener('click', (e) => {
                if (e.target === this.modal.overlay) this.closeModal();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.overlay?.classList.contains('is-open')) {
                this.closeModal();
            }
        });

        if (this.modal.form) {
            this.modal.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleModalSubmit();
            });
        }
    }

    openModalForCreate(status) {
        this.currentEditingTaskId = null;
        this.resetModalForm();
        if (this.modal.title) {
            this.modal.title.textContent = 'Add New Task';
        }
        const statusField = document.getElementById('task-status');
        if (statusField) {
            statusField.value = status;
        }
        this.updateModalButton();
        this.openModal();
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

        this.updateModalButton();
        this.openModal();
    }

    updateModalButton() {
        const submitBtn = this.modal.footer?.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = this.currentEditingTaskId ? 'Update Task' : 'Add Task';
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

        const formData = new FormData(this.modal.form);
        const taskData = {
            title: formData.get('title'),
            description: formData.get('description'),
            status: formData.get('status') || 'To Do',
            deadline: formData.get('deadline'),
        };

        if (!taskData.title.trim()) {
            alert('Please enter a task title');
            return;
        }

        if (this.currentEditingTaskId) {
            StorageManager.updateTask(this.currentEditingTaskId, taskData);
        } else {
            StorageManager.addTask(taskData);
        }

        this.closeModal();
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

                    // --- CHECKBOX LOGIC START ---
                    if (checkbox) {
                        checkbox.checked = taskData.status === 'Done';

                        checkbox.addEventListener('change', (e) => {
                            let newStatus;

                            if (e.target.checked) {
                                newStatus = 'Done';
                            } else {
                                newStatus = taskData.previousStatus || 'To Do';
                            }

                            StorageManager.moveTask(taskData.id, newStatus);

                            this.renderTasks();
                        });
                    }
                    // --- CHECKBOX LOGIC END ---

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
    }

    handleDeleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
            StorageManager.deleteTask(taskId);
            this.renderTasks();
        }
    }

    handleDropCard(newStatus, taskId) {
        const task = StorageManager.getTask(taskId);
        if (task && task.status !== newStatus) {
            StorageManager.moveTask(taskId, newStatus);
            this.renderTasks();
        }
    }

    addSampleTasks() {
        const samples = [
            { title: 'Design homepage', description: 'Create wireframes and mockups', status: 'To Do', deadline: '2026-02-25' },
            { title: 'Set up project structure', description: 'Initialize repository and folder structure', status: 'To Do', deadline: '2026-02-22' },
            { title: 'Implement drag and drop', description: 'Add drag and drop functionality for cards', status: 'In Progress', deadline: '2026-02-28' },
            { title: 'Create components', description: 'Build reusable UI components', status: 'Done', deadline: '2026-02-20' },
        ];

        samples.forEach(sample => StorageManager.addTask(sample));
    }

    async init() {
        try {
            console.log('Kanban dashboard initializing...');
            await this.loadComponents();
            this.initColumns();
            this.initAddTaskButton();
            this.initModal();

            // Load tasks or add samples
            if (StorageManager.getTasks().length === 0) {
                console.log('Adding sample tasks...');
                this.addSampleTasks();
            }

            this.renderTasks();
            console.log('Kanban dashboard initialized successfully');
        } catch (error) {
            console.error('Error initializing Kanban dashboard:', error);
        }
    }
}

// ============ Initialize Dashboard ============
async function initDashboard() {
    try {
        const { KanbanCard } = await import('../../components/card/card.js');
        const { KanbanColumn } = await import('../../components/column/column.js');

        const dashboard = new KanbanDashboard(KanbanCard, KanbanColumn);
        await dashboard.init();
    } catch (error) {
        console.error('Failed to initialize dashboard:', error);
    }
}

initDashboard();
