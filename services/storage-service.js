const STORAGE_KEY = 'kanban_tasks';

export const StorageService = {
    getTasks() {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    },

    saveTasks(tasks) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    },

    addTask(task) {
        const tasks = this.getTasks();
        const sameStatus = tasks.filter(t => t.status === task.status);
        const maxOrder = sameStatus.length === 0
            ? -1
            : Math.max(...sameStatus.map(t => (t.order ?? 0)));
        const newTask = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            title: task.title,
            description: task.description || '',
            status: task.status,
            deadline: task.deadline || '',
            createdAt: new Date().toISOString(),
            order: maxOrder + 1,
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
        const tasks = this.getTasks().filter(task => task.status === status);
        const sorted = tasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const needsOrder = sorted.some(t => t.order == null);
        if (needsOrder) {
            sorted.forEach((t, i) => {
                if (t.order == null) t.order = i;
            });
            this.saveTasks(this.getTasks());
        }
        return sorted;
    },

    moveTask(taskId, newStatus, insertIndex = undefined) {
        const tasks = this.getTasks();
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const sameStatusBefore = task.status === newStatus;
        const list = tasks
            .filter(t => t.status === newStatus && t.id !== taskId)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        const index = insertIndex !== undefined && insertIndex >= 0 && insertIndex <= list.length
            ? insertIndex
            : list.length;
        list.splice(index, 0, { ...task, status: newStatus });
        list.forEach((t, i) => {
            const existing = tasks.find(x => x.id === t.id);
            if (existing) {
                existing.status = newStatus;
                existing.order = i;
            }
        });
        this.saveTasks(tasks);
    },

    getTask(id) {
        return this.getTasks().find(task => task.id === id);
    },
};
