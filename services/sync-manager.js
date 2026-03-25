import StorageService from './storage-service.js';
import apiService from './api-service.js';

class SyncManager {
  constructor({
    storage = StorageService,
    api = apiService,
    onStatusChange = null,
    onAfterSync = null,
  } = {}) {
    this.storage = storage;
    this.api = api;
    this.onStatusChange = onStatusChange;
    this.onAfterSync = onAfterSync;
    this.syncing = false;
    this.boundOnlineHandler = this._handleOnline.bind(this);
    this.boundOfflineHandler = this._emitStatus.bind(this);
    this.boundQueueHandler = this._emitStatus.bind(this);
  }

  async init() {
    await this.storage.init();

    window.addEventListener('online', this.boundOnlineHandler);
    window.addEventListener('offline', this.boundOfflineHandler);
    window.addEventListener('sync-queue:changed', this.boundQueueHandler);

    this._emitStatus();

    if (navigator.onLine) {
      await this.syncNow();
    }
  }

  destroy() {
    window.removeEventListener('online', this.boundOnlineHandler);
    window.removeEventListener('offline', this.boundOfflineHandler);
    window.removeEventListener('sync-queue:changed', this.boundQueueHandler);
  }

  async _handleOnline() {
    await this.syncNow();
  }

  async _emitStatus(lastError = null) {
    if (!this.onStatusChange) return;
    const queueSize = await this.storage.getPendingQueueCount().catch(() => 0);
    this.onStatusChange({
      online: navigator.onLine,
      syncing: this.syncing,
      queueSize,
      lastError,
    });
  }

  async syncNow() {
    if (!navigator.onLine || this.syncing) {
      await this._emitStatus();
      return;
    }

    this.syncing = true;
    await this._emitStatus();

    try {
      const queue = await this.storage.getSyncQueue();

      for (const item of queue) {
        const response = await this.api.syncTasks([item]);
        const result = response?.results?.[0];

        if (result?.status === 'applied' || result?.status === 'skipped') {
          await this.storage.removeSyncQueueItem(item.queue_id);
        } else {
          throw new Error(result?.reason || 'Failed to sync queued item');
        }
      }

      if (typeof this.onAfterSync === 'function') {
        await this.onAfterSync();
      }

      await this._emitStatus();
    } catch (error) {
      await this._emitStatus(error);
      throw error;
    } finally {
      this.syncing = false;
      await this._emitStatus();
    }
  }
}

export default SyncManager;
