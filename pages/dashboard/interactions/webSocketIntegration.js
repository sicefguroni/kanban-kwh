/**
 * WebSocket Integration for Dashboard
 * Applies server events (storage is updated in websocket-service) then re-renders.
 */

import wsService from '../../../services/websocket-service.js';

let isSetup = false;
let debounceTimer = null;

/**
 * @param {object} config
 * @param {string} config.userId
 * @param {() => Promise<void>} config.onRefresh - single debounced callback after any task event
 */
export function setupWebSocketIntegration({ userId, onRefresh }) {
  if (isSetup) {
    console.warn('⚠️ WebSocket integration already setup - skipping');
    return () => {};
  }

  isSetup = true;

  const scheduleRefresh = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      debounceTimer = null;
      try {
        await onRefresh?.();
      } catch (e) {
        console.warn('WebSocket onRefresh failed:', e);
      }
    }, 48);
  };

  wsService.setTaskUpdateHandler(async (task, type) => {
    if (!type?.startsWith('TASK_')) return;
    scheduleRefresh();
  });

  return () => {
    clearTimeout(debounceTimer);
    wsService.setTaskUpdateHandler(null);
    isSetup = false;
  };
}

export async function connectWebSocket(userId) {
  try {
    await wsService.connect(userId);
    console.log('✓ WebSocket connected for real-time updates');
  } catch (error) {
    console.warn('Failed to connect WebSocket:', error?.message || error);
  }
}

export function disconnectWebSocket() {
  wsService.disconnect();
  console.log('✓ WebSocket disconnected');
}

export function convertClientToServerFormat(clientTask) {
  return {
    title: clientTask.title,
    description: clientTask.description,
    status: clientTask.status,
    position: clientTask.order || 0,
  };
}
