const fs = require('fs/promises');
const path = require('path');

const STATUSES = ['To Do', 'In Progress', 'Done'];

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function normalizeStatus(status) {
    if (typeof status !== 'string') return null;
    return STATUSES.includes(status) ? status : null;
}

function validateDeadline(deadline) {
    // UI uses `<input type="date">` so we expect `YYYY-MM-DD` or empty string.
    if (deadline === undefined || deadline === null) return '';
    if (typeof deadline !== 'string') return null;
    const d = deadline.trim();
    if (d === '') return '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    return d;
}

function normalizeTaskShape(task) {
    return {
        id: String(task.id),
        title: String(task.title),
        description: String(task.description ?? ''),
        status: normalizeStatus(task.status) ?? 'To Do',
        deadline: validateDeadline(task.deadline) ?? '',
        createdAt: String(task.createdAt ?? new Date().toISOString()),
        order: Number.isInteger(task.order) ? task.order : Number(task.order ?? 0),
    };
}

class TasksStore {
    /**
     * @param {{dbPath: string}} opts
     */
    constructor({ dbPath }) {
        this.dbPath = dbPath;
        this.tasks = [];
        this._writeChain = Promise.resolve();
        this._loaded = false;
    }

    async load() {
        if (this._loaded) return;
        const dir = path.dirname(this.dbPath);
        await fs.mkdir(dir, { recursive: true });
        try {
            const raw = await fs.readFile(this.dbPath, 'utf8');
            const parsed = JSON.parse(raw || '[]');
            this.tasks = Array.isArray(parsed) ? parsed.map(normalizeTaskShape) : [];
        } catch (err) {
            if (err && err.code === 'ENOENT') {
                this.tasks = [];
                await this.persist();
            } else {
                throw err;
            }
        }

        // Normalize order within each status on startup.
        STATUSES.forEach((status) => {
            const list = this.tasks
                .filter((t) => t.status === status)
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            list.forEach((t, i) => {
                const idx = this.tasks.findIndex((x) => x.id === t.id);
                if (idx >= 0) this.tasks[idx].order = i;
            });
        });

        this._loaded = true;
    }

    async persist() {
        const data = JSON.stringify(this.tasks, null, 2);
        this._writeChain = this._writeChain.then(() => fs.writeFile(this.dbPath, data, 'utf8'));
        await this._writeChain;
    }

    getStatuses() {
        return STATUSES.slice();
    }

    getAll({ status } = {}) {
        const filtered = typeof status === 'string'
            ? this.tasks.filter((t) => t.status === status)
            : this.tasks.slice();
        return filtered.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    getById(id) {
        const taskId = String(id);
        return this.tasks.find((t) => t.id === taskId) || null;
    }

    async create({ title, description, status, deadline }) {
        if (!isNonEmptyString(title)) return null;
        const normalizedStatus = normalizeStatus(status);
        if (!normalizedStatus) return null;

        const safeDeadline = validateDeadline(deadline);
        if (safeDeadline === null) return null;

        const sameStatus = this.tasks
            .filter((t) => t.status === normalizedStatus)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const newOrder = sameStatus.length;

        const now = new Date().toISOString();
        const newTask = {
            id: String(Date.now()) + Math.random().toString(36).slice(2),
            title: String(title).trim(),
            description: typeof description === 'string' ? description : '',
            status: normalizedStatus,
            deadline: safeDeadline,
            createdAt: now,
            order: newOrder,
        };

        this.tasks.push(newTask);
        await this.persist();
        return newTask;
    }

    async update(id, { title, description, deadline }) {
        const task = this.getById(id);
        if (!task) return null;

        if (title !== undefined) {
            if (!isNonEmptyString(title)) return null;
            task.title = String(title).trim();
        }
        if (description !== undefined) {
            task.description = typeof description === 'string' ? description : '';
        }
        if (deadline !== undefined) {
            const safeDeadline = validateDeadline(deadline);
            if (safeDeadline === null) return null;
            task.deadline = safeDeadline;
        }

        await this.persist();
        return task;
    }

    async delete(id) {
        const task = this.getById(id);
        if (!task) return null;

        const status = task.status;
        this.tasks = this.tasks.filter((t) => t.id !== String(id));

        // Re-number order for the affected status.
        const list = this.tasks
            .filter((t) => t.status === status)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        list.forEach((t, i) => {
            const idx = this.tasks.findIndex((x) => x.id === t.id);
            if (idx >= 0) this.tasks[idx].order = i;
        });

        await this.persist();
        return task;
    }

    async move(id, { newStatus, insertIndex } = {}) {
        const task = this.getById(id);
        if (!task) return null;

        const normalizedStatus = normalizeStatus(newStatus);
        if (!normalizedStatus) return null;

        const oldStatus = task.status;
        task.status = normalizedStatus;

        // Normalize ordering by rebuilding the two affected status lists.
        const withoutTask = this.tasks.filter((t) => t.id !== String(id));

        const oldList = withoutTask
            .filter((t) => t.status === oldStatus)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        oldList.forEach((t, i) => {
            t.order = i;
        });

        const newList = withoutTask
            .filter((t) => t.status === normalizedStatus)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        let idx = insertIndex;
        if (idx === undefined) idx = newList.length;
        if (!Number.isInteger(idx)) return null;
        if (idx < 0) idx = 0;
        if (idx > newList.length) idx = newList.length;

        // Insert moved task at idx.
        newList.splice(idx, 0, task);
        newList.forEach((t, i) => {
            t.order = i;
        });

        // Replace tasks with normalized arrays.
        this.tasks = [
            ...withoutTask.filter((t) => t.status !== oldStatus && t.status !== normalizedStatus),
            ...oldList,
            ...newList,
        ];

        await this.persist();
        return task;
    }
}

module.exports = { TasksStore, STATUSES };

