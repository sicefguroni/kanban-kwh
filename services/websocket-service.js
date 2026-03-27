/**
 * WebSocket Service for Real-time Task Updates
 * Manages WebSocket connection and event listeners
 */

import StorageService from './storage-service.js';
import apiService from './api-service.js';

/** Build ws/wss URL from the same host as the REST API (e.g. ngrok, different port). */
export function wsUrlFromApiBase(apiBaseUrl) {
  const raw = String(apiBaseUrl || '').trim().replace(/\/$/, '');
  const withoutApi = raw.replace(/\/api$/i, '');
  if (!withoutApi) return 'ws://localhost:3001';
  try {
    const u = new URL(withoutApi);
    const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${u.host}`;
  } catch {
    return 'ws://localhost:3001';
  }
}

class WebSocketService {
  constructor() {
    this.ws = null;
    this.url = 'ws://localhost:3001';
    this.userId = null;
    this.listeners = new Map(); // Map of event type -> Set of callback functions
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000; // milliseconds
    this.taskUpdateHandler = null;
  }

  /**
   * Connect to WebSocket server
   * @param {string} userId - The user ID to connect with
   * @returns {Promise<void>}
   */
  connect(userId) {
    const uid = userId == null ? '' : String(userId).trim();
    if (!uid) {
      return Promise.reject(new Error('WebSocket: missing userId (must match JWT user id)'));
    }

    return new Promise((resolve, reject) => {
      if (this.isConnecting) {
        reject(new Error('Connection already in progress'));
        return;
      }

      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.isConnecting = true;
      this.userId = uid;
      this.url = wsUrlFromApiBase(apiService.getBaseURL());

      let opened = false;
      let settled = false;

      const finishFail = (err) => {
        if (settled) return;
        settled = true;
        this.isConnecting = false;
        reject(err);
      };

      const finishOk = () => {
        if (settled) return;
        settled = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        resolve();
      };

      try {
        const url = `${this.url}?userId=${encodeURIComponent(uid)}`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          opened = true;
          console.log('✓ WebSocket connected', this.url);
          finishOk();
        };

        this.ws.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data);
            await this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onerror = () => {
          console.error('WebSocket error (see close code if connection failed)');
        };

        this.ws.onclose = (ev) => {
          console.log('✗ WebSocket disconnected', ev.code, ev.reason || '');
          this.isConnecting = false;
          if (!opened) {
            finishFail(new Error(`WebSocket closed before open (code ${ev.code})`));
          } else {
            this.attemptReconnect();
          }
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Attempt to reconnect to WebSocket
   * @private
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      const uid = this.userId;
      if (uid) {
        this.url = wsUrlFromApiBase(apiService.getBaseURL());
        this.connect(uid).catch((err) => {
          console.error('Reconnection failed:', err);
        });
      }
    }, this.reconnectDelay);
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Handle incoming WebSocket message
   * @private
   * @param {object} message - The message object
   */
  async handleMessage(message) {
    const { type, task, timestamp } = message;

    console.log(`📨 Received ${type} at ${timestamp}`);

    if (type.startsWith('TASK_')) {
      await this.applyTaskMessage(type, task);
    }

    // Call all listeners for this message type
    if (this.listeners.has(type)) {
      this.listeners.get(type).forEach(callback => {
        try {
          callback(task, message);
        } catch (error) {
          console.error(`Error in ${type} listener:`, error);
        }
      });
    }

    // Also emit a generic 'update' event
    if (type.startsWith('TASK_') && this.listeners.has('TASK_UPDATE')) {
      this.listeners.get('TASK_UPDATE').forEach(callback => {
        try {
          callback(task, message);
        } catch (error) {
          console.error('Error in TASK_UPDATE listener:', error);
        }
      });
    }
  }

  async applyTaskMessage(type, task) {
    if (!task) return;

    if (type === 'TASK_DELETED') {
      await StorageService.removeTaskLocal(task.id);
    } else {
      await StorageService.upsertTaskFromServer(task);
    }

    if (typeof this.taskUpdateHandler === 'function') {
      await this.taskUpdateHandler(task, type);
    }
  }

  setTaskUpdateHandler(handler) {
    this.taskUpdateHandler = handler;
  }

  /**
   * Register a listener for a specific event type
   * @param {string} eventType - The event type (e.g., 'TASK_CREATED', 'TASK_UPDATED')
   * @param {Function} callback - The callback function to execute
   * @returns {Function} Unsubscribe function
   */
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType).add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType).delete(callback);
    };
  }

  /**
   * Remove a listener
   * @param {string} eventType - The event type
   * @param {Function} callback - The callback function to remove
   */
  off(eventType, callback) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).delete(callback);
    }
  }

  /**
   * Send a message to the server
   * @param {object} message - The message to send
   */
  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not open. Message not sent:', message);
    }
  }

  /**
   * Send a ping to keep connection alive
   */
  ping() {
    this.send({ type: 'PING' });
  }

  /**
   * Check if WebSocket is connected
   * @returns {boolean}
   */
  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export default new WebSocketService();
