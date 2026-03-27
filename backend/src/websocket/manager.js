/**
 * WebSocket Manager
 * Handles WebSocket connections, subscriptions, and event broadcasting
 */

class WebSocketManager {
  constructor() {
    // Map of userId -> Set of WebSocket connections
    this.userConnections = new Map();
  }

  /**
   * Register a new WebSocket connection for a user
   * @param {string} userId - The user ID
   * @param {WebSocket} ws - The WebSocket connection
   */
  _key(userId) {
    return userId == null ? '' : String(userId).trim();
  }

  addConnection(userId, ws) {
    const key = this._key(userId);
    if (!key) {
      console.warn('⚠ WebSocket addConnection: empty userId');
      return;
    }
    if (!this.userConnections.has(key)) {
      this.userConnections.set(key, new Set());
    }
    this.userConnections.get(key).add(ws);
    console.log(`✓ Client connected for user ${key}. Total connections: ${this.userConnections.get(key).size}`);
  }

  /**
   * Remove a WebSocket connection for a user
   * @param {string} userId - The user ID
   * @param {WebSocket} ws - The WebSocket connection
   */
  removeConnection(userId, ws) {
    const key = this._key(userId);
    if (!key || !this.userConnections.has(key)) return;
    this.userConnections.get(key).delete(ws);
    const remaining = this.userConnections.get(key).size;
    console.log(`✓ Client disconnected for user ${key}. Total connections: ${remaining}`);
    if (remaining === 0) {
      this.userConnections.delete(key);
    }
  }

  /**
   * Broadcast a message to all connections of a given user
   * @param {string} userId - The user ID
   * @param {object} message - The message object to broadcast
   */
  broadcastToUser(userId, message) {
    const key = this._key(userId);
    if (!key || !this.userConnections.has(key)) {
      return;
    }

    const connections = this.userConnections.get(key);
    const messageStr = JSON.stringify(message);

    connections.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        ws.send(messageStr);
      }
    });
  }

  /**
   * Broadcast a message to all connected clients
   * @param {object} message - The message object to broadcast
   */
  broadcastToAll(message) {
    const messageStr = JSON.stringify(message);

    this.userConnections.forEach((connections, userId) => {
      connections.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
          ws.send(messageStr);
        }
      });
    });
  }

  /**
   * Get the number of active connections for a user
   * @param {string} userId - The user ID
   * @returns {number} Number of connections
   */
  getConnectionCount(userId) {
    const key = this._key(userId);
    return this.userConnections.has(key) ? this.userConnections.get(key).size : 0;
  }

  /**
   * Get total number of active connections
   * @returns {number} Total number of connections
   */
  getTotalConnections() {
    let total = 0;
    this.userConnections.forEach(connections => {
      total += connections.size;
    });
    return total;
  }
}

// Export singleton instance
export default new WebSocketManager();
