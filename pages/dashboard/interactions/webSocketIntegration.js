/**
 * WebSocket Integration for Dashboard
 * Handles syncing real-time task updates with the dashboard
 */

import wsService from '../../../services/websocket-service.js';
import { StorageService } from '../../../services/storage-service.js';

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
  const unsubscribers = [];

  // Handle task created
  const unsubTaskCreated = wsService.on('TASK_CREATED', (task) => {
    console.log('📥 Task created:', task.title);
    
    // Convert server format to client format
    const clientTask = convertServerToClientFormat(task);
    
    // Add to storage
    const tasks = StorageService.getTasks();
    if (!tasks.find(t => t.id === clientTask.id)) {
      tasks.push(clientTask);
      StorageService.saveTasks(tasks);
      
      if (onTaskCreated) onTaskCreated(clientTask);
    }
  });
  unsubscribers.push(unsubTaskCreated);

  // Handle task updated
  const unsubTaskUpdated = wsService.on('TASK_UPDATED', (task) => {
    console.log('📥 Task updated:', task.title);
    
    // Convert server format to client format
    const clientTask = convertServerToClientFormat(task);
    
    // Update in storage
    StorageService.updateTask(clientTask.id, clientTask);
    
    if (onTaskUpdated) onTaskUpdated(clientTask);
  });
  unsubscribers.push(unsubTaskUpdated);

  // Handle task deleted
  const unsubTaskDeleted = wsService.on('TASK_DELETED', (task) => {
    console.log('📥 Task deleted:', task.id);
    
    // Remove from storage
    StorageService.deleteTask(task.id);
    
    if (onTaskDeleted) onTaskDeleted(task.id);
  });
  unsubscribers.push(unsubTaskDeleted);

  // Return cleanup function
  return () => {
    unsubscribers.forEach(unsub => unsub());
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
 * Convert server task format to client task format
 * Server format uses: id, user_id, title, description, status, position, created_at, updated_at
 * Client format uses: id, title, description, status, order (not position), createdAt, deadline
 * 
 * @param {object} serverTask - Task from server
 * @returns {object} Task in client format
 */
function convertServerToClientFormat(serverTask) {
  return {
    id: serverTask.id,
    title: serverTask.title,
    description: serverTask.description || '',
    status: serverTask.status,
    order: serverTask.position || 0,
    createdAt: serverTask.created_at,
    deadline: '', // Server doesn't have deadline field yet
  };
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
