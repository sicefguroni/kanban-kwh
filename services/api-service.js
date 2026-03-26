/**
 * API Service for interacting with the KWH Kanban backend
 * This service handles all communication with the Node.js/Express API
 */

const DEFAULT_API_BASE_URL = 'http://localhost:3001/api';
const API_BASE_STORAGE_KEY = 'kanban_api_base_url';

function normalizeApiBaseUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const noTrailingSlash = raw.replace(/\/$/, '');
  return /\/api$/i.test(noTrailingSlash)
    ? noTrailingSlash
    : `${noTrailingSlash}/api`;
}

function readStoredApiBaseUrl() {
  if (typeof window === 'undefined') return '';
  try {
    return normalizeApiBaseUrl(localStorage.getItem(API_BASE_STORAGE_KEY));
  } catch {
    return '';
  }
}

function persistApiBaseUrl(url) {
  if (typeof window === 'undefined') return;
  try {
    if (url) {
      localStorage.setItem(API_BASE_STORAGE_KEY, url);
    } else {
      localStorage.removeItem(API_BASE_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors in private/incognito contexts.
  }
}

function resolveApiBaseUrl() {
  if (typeof window === 'undefined') {
    return DEFAULT_API_BASE_URL;
  }

  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get('apiBaseUrl') || params.get('apiBase') || params.get('apiHost');
  const queryBase = normalizeApiBaseUrl(queryValue);
  if (queryBase) {
    persistApiBaseUrl(queryBase);
    return queryBase;
  }

  const injectedBase = normalizeApiBaseUrl(window.KANBAN_API_BASE_URL);
  if (injectedBase) return injectedBase;

  const storedBase = readStoredApiBaseUrl();
  if (storedBase) return storedBase;

  return DEFAULT_API_BASE_URL;
}

const API_BASE_URL = resolveApiBaseUrl();

class APIService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('auth_token') || null;
  }

  // ===== HELPERS =====

  getAuthHeaders() {
    this.token = localStorage.getItem('auth_token') || this.token;
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  getBaseURL() {
    return this.baseURL;
  }

  setBaseURL(url, { persist = true } = {}) {
    const normalized = normalizeApiBaseUrl(url);
    if (!normalized) throw new Error('Invalid API base URL');
    this.baseURL = normalized;
    if (persist) persistApiBaseUrl(normalized);
    return this.baseURL;
  }

  resetBaseURL() {
    this.baseURL = DEFAULT_API_BASE_URL;
    persistApiBaseUrl('');
    return this.baseURL;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  async request(path, { method = 'GET', body } = {}) {
    const response = await fetch(`${this.baseURL}${path}`, {
      method,
      headers: this.getAuthHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);

    if (!response.ok) {
      const message = payload?.error || payload?.message || response.statusText || 'Request failed';
      throw new Error(message);
    }

    return payload;
  }

  // ===== AUTHENTICATION =====

  async register({ email, name, password }) {
    const response = await fetch(`${this.baseURL}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to register');
    }
    const data = await response.json();
    this.setToken(data.token);
    return data.user;
  }

  async login({ email, password }) {
    const response = await fetch(`${this.baseURL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to login');
    }
    const data = await response.json();
    this.setToken(data.token);
    return data.user;
  }

  logout() {
    this.setToken(null);
  }

  async getCurrentUser() {
    return this.request('/users/me');
  }

  // ===== USERS =====

  async getUsers() {
    return this.request('/users');
  }

  async getUser(userId) {
    return this.request(`/users/${encodeURIComponent(userId)}`);
  }

  async createUser({ email, name }) {
    return this.request('/users', {
      method: 'POST',
      body: { email, name }
    });
  }

  async updateUser(userId, { name }) {
    return this.request(`/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: { name }
    });
  }

  async deleteUser(userId) {
    return this.request(`/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    });
  }

  // ===== TASKS =====

  async getTasksForUser(userId) {
    return this.request(`/tasks/user/${encodeURIComponent(userId)}`);
  }

  async getTasks() {
    return this.request('/tasks');
  }

  async getTasksByStatus(status) {
    return this.request(`/tasks/status/${encodeURIComponent(status)}`);
  }

  async getTask(taskId) {
    return this.request(`/tasks/${encodeURIComponent(taskId)}`);
  }

  async createTask({ id, userId, title, description = '', status = 'To Do', position = 0, updated_at }) {
    return this.request('/tasks', {
      method: 'POST',
      body: { id, userId, title, description, status, position, updated_at }
    });
  }

  async updateTask(taskId, updates) {
    return this.request(`/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PUT',
      body: updates
    });
  }

  async deleteTask(taskId) {
    return this.request(`/tasks/${encodeURIComponent(taskId)}`, {
      method: 'DELETE'
    });
  }

  async syncTasks(actions) {
    return this.request('/tasks/sync', {
      method: 'POST',
      body: { actions }
    });
  }

  // ===== OFFLINE SYNC HELPERS =====

  /**
   * Resolve conflicts between local and server data
   * @param {Object} localData - Data stored locally
   * @param {Object} serverData - Data from server
   * @returns {Object} - Resolved data (server wins if newer)
   */
  resolveConflict(localData, serverData) {
    const localTime = new Date(localData.updated_at).getTime();
    const serverTime = new Date(serverData.updated_at).getTime();

    if (serverTime > localTime) {
      console.log('Server data is newer, using server version');
      return serverData;
    } else if (localTime > serverTime) {
      console.log('Local data is newer, server was updated');
      return localData;
    }
    // If equal, return server data as tiebreaker
    return serverData;
  }

  /**
   * Check if local data needs syncing
   * @param {Object} localData - Data to check
   * @param {Object} serverData - Server data to compare
   * @returns {boolean}
   */
  needsSync(localData, serverData) {
    if (!serverData) return true; // No server data, needs sync
    const localTime = new Date(localData.updated_at).getTime();
    const serverTime = new Date(serverData.updated_at).getTime();
    return localTime > serverTime;
  }
}

// Export as singleton
export default new APIService();
