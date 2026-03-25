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
  addConnection(userId, ws) {
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId).add(ws);
    console.log(`✓ Client connected for user ${userId}. Total connections: ${this.userConnections.get(userId).size}`);
  }

  /**
   * Remove a WebSocket connection for a user
   * @param {string} userId - The user ID
   * @param {WebSocket} ws - The WebSocket connection
   */
  removeConnection(userId, ws) {
    if (this.userConnections.has(userId)) {
      this.userConnections.get(userId).delete(ws);
      console.log(`✓ Client disconnected for user ${userId}. Total connections: ${this.userConnections.get(userId).size}`);
      
      // Clean up empty user entries
      if (this.userConnections.get(userId).size === 0) {
        this.userConnections.delete(userId);
      }
    }
  }

  /**
   * Broadcast a message to all connections of a given user
   * @param {string} userId - The user ID
   * @param {object} message - The message object to broadcast
   */
  broadcastToUser(userId, message) {
    if (!this.userConnections.has(userId)) {
      return;
    }

    const connections = this.userConnections.get(userId);
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
    return this.userConnections.has(userId) ? this.userConnections.get(userId).size : 0;
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
