/**
 * WebSocket Handler
 * Sets up WebSocket server and handles client connections
 */

import { WebSocketServer } from 'ws';
import wsManager from './manager.js';

/**
 * Initialize WebSocket server
 * @param {http.Server} server - The HTTP server instance from Node
 * @returns {WebSocketServer} The WebSocket server instance
 */
export function initializeWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    // Extract userId from URL query string or headers
    // Format: ws://localhost:3001?userId=<userId>
    const url = new URL(req.url, `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      console.warn('⚠ Connection rejected: userId not provided');
      ws.close(1008, 'userId parameter required');
      return;
    }

    // Register the connection
    wsManager.addConnection(userId, ws);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      message: 'Connected to real-time updates',
      userId,
      timestamp: new Date().toISOString()
    }));

    // Handle incoming messages (if needed)
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        handleClientMessage(ws, userId, message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    // Handle client disconnection
    ws.on('close', () => {
      wsManager.removeConnection(userId, ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  console.log('✓ WebSocket server initialized');
  return wss;
}

/**
 * Handle messages from clients
 * @param {WebSocket} ws - The WebSocket connection
 * @param {string} userId - The user ID
 * @param {object} message - The message object
 */
function handleClientMessage(ws, userId, message) {
  // Handle different message types if needed
  switch (message.type) {
    case 'PING':
      ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
      break;
    default:
      console.log(`Received message from user ${userId}:`, message.type);
  }
}

/**
 * Broadcast a task event to all clients
 * @param {object} task - The task object
 * @param {string} eventType - The type of event (TASK_CREATED, TASK_UPDATED, etc.)
 * @param {string} userId - Optional: userId to broadcast to specific user only
 */
export function broadcastTaskEvent(task, eventType, userId = null) {
  const message = {
    type: eventType,
    task,
    timestamp: new Date().toISOString()
  };

  if (userId) {
    wsManager.broadcastToUser(userId, message);
  } else {
    wsManager.broadcastToAll(message);
  }

  console.log(`📡 Broadcasting ${eventType} for task ${task.id}`);
}

export default { initializeWebSocket, broadcastTaskEvent };
