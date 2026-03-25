/**
 * WebSocket Integration for Dashboard
 * Handles syncing real-time task updates with the dashboard
 */

import wsService from '../../../services/websocket-service.js';

// Track subscriptions to avoid duplicates
let isSetup = false;

/**
 * Set up WebSocket listeners for task updates
 * @param {object} config - Configuration object
 * @param {string} config.userId - The user ID to connect with
 * @param {Function} config.onTaskCreated - Callback when task is created
 * @param {Function} config.onTaskUpdated - Callback when task is updated
 * @param {Function} config.onTaskDeleted - Callback when task is deleted
 * @returns {Function} Cleanup function to remove listeners
 */
export function setupWebSocketIntegration({ userId, onTaskCreated, onTaskUpdated, onTaskDeleted }) {
  console.log('🔧 Setting up WebSocket integration for user:', userId);
  
  if (isSetup) {
    console.warn('⚠️ WebSocket integration already setup - skipping');
    return () => {};
  }

  isSetup = true;

  // Use a single callback path to avoid duplicate rerenders per websocket event.
  wsService.setTaskUpdateHandler(async (task, type) => {
    if (type === 'TASK_CREATED' && onTaskCreated) await onTaskCreated(task);
    if (type === 'TASK_UPDATED' && onTaskUpdated) await onTaskUpdated(task);
    if (type === 'TASK_DELETED' && onTaskDeleted) await onTaskDeleted(task.id);
  });

  // Return cleanup function
  return () => {
    wsService.setTaskUpdateHandler(null);
    isSetup = false;
  };
}

/**
 * Connect to WebSocket for a user
 * @param {string} userId - The user ID to connect with
 * @returns {Promise<void>}
 */
export async function connectWebSocket(userId) {
  try {
    await wsService.connect(userId);
    console.log('✓ WebSocket connected for real-time updates');
  } catch (error) {
    console.warn('Failed to connect WebSocket:', error.message);
    // Don't throw - the app should continue working with localStorage
  }
}

/**
 * Disconnect from WebSocket
 */
export function disconnectWebSocket() {
  wsService.disconnect();
  console.log('✓ WebSocket disconnected');
}

/**
 * Convert client task format to server task format for sending to API
 * 
 * @param {object} clientTask - Task from client
 * @returns {object} Task in server format
 */
export function convertClientToServerFormat(clientTask) {
  return {
    title: clientTask.title,
    description: clientTask.description,
    status: clientTask.status,
    position: clientTask.order || 0,
  };
}
