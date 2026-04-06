import StorageService from './StorageService.js';
import apiService from './APIService.js';

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
    this._queueSyncTimer = null;
    this.boundOnlineHandler = this._handleOnline.bind(this);
    this.boundOfflineHandler = this._emitStatus.bind(this);
    this.boundQueueHandler = this._onQueueChanged.bind(this);
  }

  /**
   * When the offline queue changes, update the badge and flush the queue soon after.
   */
  _onQueueChanged() {
    this._emitStatus();
    clearTimeout(this._queueSyncTimer);
    this._queueSyncTimer = setTimeout(() => {
      this._queueSyncTimer = null;
      if (navigator.onLine && !this.syncing) {
        this.syncNow();
      }
    }, 400);
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
    clearTimeout(this._queueSyncTimer);
    this._queueSyncTimer = null;
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

    let queueError = null;
    try {
      const queue = await this.storage.getSyncQueue();

      for (const item of queue) {
        const response = await this.api.syncTasks([item]);
        const result = response?.results?.[0];

        if (result?.status === 'applied' || result?.status === 'skipped') {
          const id = result.queue_id ?? item.queue_id;
          if (id != null) {
            await this.storage.removeSyncQueueItem(id);
          }
        } else {
          throw new Error(result?.reason || 'Failed to sync queued item');
        }
      }

      await this._emitStatus();
    } catch (error) {
      queueError = error;
      await this._emitStatus(error);
      // Do not rethrow: fetch/network failures would become uncaught promise rejections
      // for callers; the UI already shows lastError via onStatusChange.
    } finally {
      this.syncing = false;
      await this._emitStatus(queueError);
    }

    if (!queueError && typeof this.onAfterSync === 'function') {
      try {
        await this.onAfterSync();
      } catch (e) {
        console.warn('SyncManager onAfterSync failed:', e);
      }
    }
  }
}

export default SyncManager;
