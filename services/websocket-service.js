/**
 * WebSocket Service for Real-time Task Updates
 * Manages WebSocket connection and event listeners
 */

class WebSocketService {
  constructor() {
    this.ws = null;
    this.url = 'ws://localhost:3002';
    this.userId = null;
    this.listeners = new Map(); // Map of event type -> Set of callback functions
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000; // milliseconds
  }

  /**
   * Connect to WebSocket server
   * @param {string} userId - The user ID to connect with
   * @returns {Promise<void>}
   */
  connect(userId) {
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
      this.userId = userId;

      try {
        const url = `${this.url}?userId=${encodeURIComponent(userId)}`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('✓ WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('✗ WebSocket disconnected');
          this.isConnecting = false;
          this.attemptReconnect();
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
      if (this.userId) {
        this.connect(this.userId).catch(err => {
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
  handleMessage(message) {
    const { type, task, timestamp } = message;

    console.log(`📨 Received ${type} at ${timestamp}`);

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
