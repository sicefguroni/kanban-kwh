const DB_NAME = 'kanban_offline_db';
const DB_VERSION = 1;
const TASKS_STORE = 'tasks';
const SYNC_QUEUE_STORE = 'sync_queue';

function nowIso() {
    return new Date().toISOString();
}

/** Map API / DB status strings to UI column labels (COLUMN_STATUSES). */
function normalizeTaskStatusForUi(status) {
    const raw = String(status ?? '').trim();
    if (!raw) return 'To Do';
    const lower = raw.toLowerCase();
    const map = {
        todo: 'To Do',
        'to do': 'To Do',
        'in-progress': 'In Progress',
        'in progress': 'In Progress',
        inprogress: 'In Progress',
        done: 'Done',
    };
    if (map[lower]) return map[lower];
    if (raw === 'To Do' || raw === 'In Progress' || raw === 'Done') return raw;
    return raw;
}

function createUuidV4() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.floor(Math.random() * 16);
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function dispatchQueueChanged() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sync-queue:changed'));
    }
}

class StorageServiceClass {
    constructor() {
        this.dbPromise = null;
    }

    async init() {
        await this._getDb();
    }

    async _getDb() {
        if (this.dbPromise) return this.dbPromise;

        this.dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(TASKS_STORE)) {
                    const tasksStore = db.createObjectStore(TASKS_STORE, { keyPath: 'id' });
                    tasksStore.createIndex('status', 'status', { unique: false });
                    tasksStore.createIndex('updated_at', 'updated_at', { unique: false });
                }

                if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
                    const queueStore = db.createObjectStore(SYNC_QUEUE_STORE, {
                        keyPath: 'queue_id',
                        autoIncrement: true,
                    });
                    queueStore.createIndex('queued_at', 'queued_at', { unique: false });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
        });

        return this.dbPromise;
    }

    async _withStore(storeName, mode, operation) {
        const db = await this._getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            const request = operation(store);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error(`IndexedDB operation failed for ${storeName}`));
        });
    }

    async saveTaskLocal(task) {
        const normalizedTask = {
            id: task.id || createUuidV4(),
            title: task.title || '',
            description: task.description || '',
            status: normalizeTaskStatusForUi(task.status),
            order: Number.isFinite(task.order) ? task.order : 0,
            deadline: task.deadline || '',
            user_id: task.user_id || null,
            created_at: task.created_at || task.createdAt || nowIso(),
            updated_at: task.updated_at || nowIso(),
        };

        return this._withStore(TASKS_STORE, 'readwrite', (store) => store.put(normalizedTask));
    }

    async getTasksLocal() {
        const rows = await this._withStore(TASKS_STORE, 'readonly', (store) => store.getAll());
        return rows.sort((a, b) => {
            if (a.status !== b.status) return String(a.status).localeCompare(String(b.status));
            return (a.order ?? 0) - (b.order ?? 0);
        });
    }

    async getTask(id) {
        return this._withStore(TASKS_STORE, 'readonly', (store) => store.get(id));
    }

    async addToSyncQueue(action) {
        const queueItem = {
            action: action.action,
            taskId: action.taskId || action.task?.id || null,
            task: action.task || null,
            updates: action.updates || null,
            updated_at: action.updated_at || action.task?.updated_at || nowIso(),
            queued_at: nowIso(),
        };

        const db = await this._getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
            const store = tx.objectStore(SYNC_QUEUE_STORE);
            const addReq = store.add(queueItem);
            addReq.onsuccess = () => {
                const id = addReq.result;
                const withId = { ...queueItem, queue_id: id };
                const putReq = store.put(withId);
                putReq.onsuccess = () => {
                    dispatchQueueChanged();
                    resolve(id);
                };
                putReq.onerror = () => reject(putReq.error || new Error('sync queue put failed'));
            };
            addReq.onerror = () => reject(addReq.error || new Error('sync queue add failed'));
            tx.onerror = () => reject(tx.error || new Error('sync queue transaction failed'));
        });
    }

    async getSyncQueue() {
        const rows = await this._withStore(SYNC_QUEUE_STORE, 'readonly', (store) => store.getAll());
        return rows.sort((a, b) => (a.queue_id ?? 0) - (b.queue_id ?? 0));
    }

    async removeSyncQueueItem(queueId) {
        await this._withStore(SYNC_QUEUE_STORE, 'readwrite', (store) => store.delete(queueId));
        dispatchQueueChanged();
    }

    async getPendingQueueCount() {
        const queue = await this.getSyncQueue();
        return queue.length;
    }

    async clearSyncQueue() {
        await this._withStore(SYNC_QUEUE_STORE, 'readwrite', (store) => store.clear());
        dispatchQueueChanged();
    }

    async addTask(taskData = {}) {
        const localTask = {
            id: taskData.id || createUuidV4(),
            title: taskData.title || '',
            description: taskData.description || '',
            status: taskData.status || 'To Do',
            order: Number.isFinite(taskData.order) ? taskData.order : 0,
            deadline: taskData.deadline || '',
            user_id: taskData.user_id || taskData.userId || null,
            created_at: taskData.created_at || nowIso(),
            updated_at: taskData.updated_at || nowIso(),
        };

        await this.saveTaskLocal(localTask);
        return localTask;
    }

    async updateTask(taskId, updates = {}) {
        const existing = await this.getTask(taskId);
        if (!existing) return null;

        const updatedTask = {
            ...existing,
            ...updates,
            id: taskId,
            updated_at: updates.updated_at || nowIso(),
        };

        await this.saveTaskLocal(updatedTask);
        return updatedTask;
    }

    async deleteTask(taskId) {
        await this._withStore(TASKS_STORE, 'readwrite', (store) => store.delete(taskId));
    }

    async moveTask(taskId, newStatus, insertIndex = undefined) {
        const existing = await this.getTask(taskId);
        if (!existing) return null;

        const nextOrder = Number.isFinite(insertIndex) ? insertIndex : existing.order ?? 0;
        const movedTask = {
            ...existing,
            status: newStatus,
            order: nextOrder,
            updated_at: nowIso(),
        };

        await this.saveTaskLocal(movedTask);
        return movedTask;
    }

    async getTasks() {
        return this.getTasksLocal();
    }

    async saveTasks(tasks) {
        for (const task of tasks) {
            await this.saveTaskLocal(task);
        }
        return tasks;
    }

    async getTasksByStatus(status) {
        const rows = await this.getTasksLocal();
        return rows
            .filter((task) => task.status === status)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    async upsertTaskFromServer(serverTask) {
        const normalized = {
            id: serverTask.id,
            title: serverTask.title || '',
            description: serverTask.description || '',
            status: normalizeTaskStatusForUi(serverTask.status),
            order: Number.isFinite(serverTask.position) ? serverTask.position : (serverTask.order ?? 0),
            deadline: serverTask.deadline || '',
            user_id: serverTask.user_id || null,
            created_at: serverTask.created_at || nowIso(),
            updated_at: serverTask.updated_at || nowIso(),
        };

        await this.saveTaskLocal(normalized);
        return normalized;
    }

    async removeTaskLocal(taskId) {
        await this.deleteTask(taskId);
    }

    async replaceLocalTasks(tasks) {
        await this._withStore(TASKS_STORE, 'readwrite', (store) => store.clear());
        for (const task of tasks) {
            await this.upsertTaskFromServer(task);
        }
    }
}

export const StorageService = new StorageServiceClass();
export default StorageService;
