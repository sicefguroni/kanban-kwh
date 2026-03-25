/**
 * API Service for interacting with the KWH Kanban backend
 * This service handles all communication with the Node.js/Express API
 */

const API_BASE_URL = 'http://localhost:3002/api';

class APIService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('auth_token');
  }

  // ===== HELPERS =====

  getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
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
    const response = await fetch(`${this.baseURL}/users/me`, {
      headers: this.getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch current user');
    return response.json();
  }

  // ===== USERS =====

  async getUsers() {
    const response = await fetch(`${this.baseURL}/users`, {
      headers: this.getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  }

  async getUser(userId) {
    const response = await fetch(`${this.baseURL}/users/${userId}`, {
      headers: this.getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch user');
    return response.json();
  }

  async createUser({ email, name }) {
    const response = await fetch(`${this.baseURL}/users`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ email, name })
    });
    if (!response.ok) throw new Error('Failed to create user');
    return response.json();
  }

  async updateUser(userId, { name }) {
    const response = await fetch(`${this.baseURL}/users/${userId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ name })
    });
    if (!response.ok) throw new Error('Failed to update user');
    return response.json();
  }

  async deleteUser(userId) {
    const response = await fetch(`${this.baseURL}/users/${userId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to delete user');
    return response.json();
  }

  // ===== TASKS =====

  async getTasksForUser(userId) {
    const response = await fetch(`${this.baseURL}/tasks/user/${userId}`, {
      headers: this.getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch tasks');
    return response.json();
  }

  async getTasksByStatus(status) {
    const response = await fetch(`${this.baseURL}/tasks/status/${status}`, {
      headers: this.getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch tasks');
    return response.json();
  }

  async getTask(taskId) {
    const response = await fetch(`${this.baseURL}/tasks/${taskId}`, {
      headers: this.getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch task');
    return response.json();
  }

  async createTask({ userId, title, description = '', status = 'todo', position = 0 }) {
    const response = await fetch(`${this.baseURL}/tasks`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ userId, title, description, status, position })
    });
    if (!response.ok) throw new Error('Failed to create task');
    return response.json();
  }

  async updateTask(taskId, updates) {
    const response = await fetch(`${this.baseURL}/tasks/${taskId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update task');
    return response.json();
  }

  async deleteTask(taskId) {
    const response = await fetch(`${this.baseURL}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to delete task');
    return response.json();
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
