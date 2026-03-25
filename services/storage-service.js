// REST-backed storage service (replaces the old localStorage version).
//
// Configure the API base URL by setting:
//   window.KANBAN_API_BASE_URL = "http://127.0.0.1:3001" (or your backend URL)
//
// If unset, defaults to http://127.0.0.1:3001.
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3001';

function getApiBaseUrl() {
    if (typeof window !== 'undefined' && window.KANBAN_API_BASE_URL) {
        return String(window.KANBAN_API_BASE_URL);
    }
    return DEFAULT_API_BASE_URL;
}

async function apiRequest(method, path, body) {
    const baseUrl = getApiBaseUrl().replace(/\/$/, '');
    const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

    const headers = { 'Content-Type': 'application/json' };
    const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

    if (!res.ok) {
        const message =
            payload?.message ||
            payload?.error ||
            (typeof payload === 'string' && payload.length ? payload : null) ||
            res.statusText ||
            'Request failed';
        throw new Error(message);
    }

    return payload;
}

export const StorageService = {
    async getTasksByStatus(status) {
        return apiRequest('GET', `/tasks?status=${encodeURIComponent(status)}`);
    },

    async getTask(id) {
        return apiRequest('GET', `/tasks/${encodeURIComponent(id)}`);
    },

    async addTask(task) {
        const payload = {
            title: task.title,
            description: task.description || '',
            status: task.status,
            deadline: task.deadline || '',
        };
        return apiRequest('POST', '/tasks', payload);
    },

    async updateTask(id, updates) {
        const payload = {
            title: updates.title,
            description: updates.description || '',
            deadline: updates.deadline || '',
        };
        return apiRequest('PATCH', `/tasks/${encodeURIComponent(id)}`, payload);
    },

    async deleteTask(id) {
        return apiRequest('DELETE', `/tasks/${encodeURIComponent(id)}`);
    },

    async moveTask(taskId, newStatus, insertIndex = undefined) {
        const payload = { newStatus };
        if (insertIndex !== undefined) payload.insertIndex = insertIndex;
        return apiRequest('POST', `/tasks/${encodeURIComponent(taskId)}/move`, payload);
    },
};
