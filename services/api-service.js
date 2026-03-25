/**
 * API Service for interacting with the KWH Kanban backend
 * This service handles all communication with the Node.js/Express API
 */

const API_BASE_URL = 'http://localhost:3001/api';

class APIService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // ===== USERS =====

  async getUsers() {
    const response = await fetch(`${this.baseURL}/users`);
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  }

  async getUser(userId) {
    const response = await fetch(`${this.baseURL}/users/${userId}`);
    if (!response.ok) throw new Error('Failed to fetch user');
    return response.json();
  }

  async createUser({ email, name }) {
    const response = await fetch(`${this.baseURL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name })
    });
    if (!response.ok) throw new Error('Failed to create user');
    return response.json();
  }

  async updateUser(userId, { name }) {
    const response = await fetch(`${this.baseURL}/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!response.ok) throw new Error('Failed to update user');
    return response.json();
  }

  async deleteUser(userId) {
    const response = await fetch(`${this.baseURL}/users/${userId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete user');
    return response.json();
  }

  // ===== TASKS =====

  async getTasksForUser(userId) {
    const response = await fetch(`${this.baseURL}/tasks/user/${userId}`);
    if (!response.ok) throw new Error('Failed to fetch tasks');
    return response.json();
  }

  async getTasksByStatus(status) {
    const response = await fetch(`${this.baseURL}/tasks/status/${status}`);
    if (!response.ok) throw new Error('Failed to fetch tasks');
    return response.json();
  }

  async getTask(taskId) {
    const response = await fetch(`${this.baseURL}/tasks/${taskId}`);
    if (!response.ok) throw new Error('Failed to fetch task');
    return response.json();
  }

  async createTask({ userId, title, description = '', status = 'todo', position = 0 }) {
    const response = await fetch(`${this.baseURL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title, description, status, position })
    });
    if (!response.ok) throw new Error('Failed to create task');
    return response.json();
  }

  async updateTask(taskId, updates) {
    const response = await fetch(`${this.baseURL}/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update task');
    return response.json();
  }

  async deleteTask(taskId) {
    const response = await fetch(`${this.baseURL}/tasks/${taskId}`, {
      method: 'DELETE'
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
