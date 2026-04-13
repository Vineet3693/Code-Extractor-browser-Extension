if (typeof window.CloudSync === 'undefined') {
  class CloudSync {
    constructor(options = {}) {
      this.dbHelper = options.dbHelper;
      this.syncEndpoint = options.syncEndpoint || null;
      this.apiKey = options.apiKey || null;
      this.autoSync = options.autoSync ?? false;
      this.syncInterval = options.syncInterval || 60000;
      this._syncTimer = null;
      this._lastSync = null;
      this._syncing = false;
      this.stats = { uploads: 0, downloads: 0, conflicts: 0, errors: 0 };
    }

    async configure(options) {
      if (options.syncEndpoint) this.syncEndpoint = options.syncEndpoint;
      if (options.apiKey) this.apiKey = options.apiKey;
      if (typeof options.autoSync === 'boolean') this.autoSync = options.autoSync;
      if (options.syncInterval) this.syncInterval = options.syncInterval;

      if (this.dbHelper) {
        await this.dbHelper.update('settings', {
          key: 'cloudSync',
          value: {
            endpoint: this.syncEndpoint,
            autoSync: this.autoSync,
            interval: this.syncInterval,
            lastSync: this._lastSync
          }
        });
      }

      return { success: true };
    }

    async pushProject(project) {
      if (!this.syncEndpoint) {
        return { success: false, error: 'No sync endpoint configured' };
      }

      const payload = {
        action: 'push',
        projectId: project.id,
        data: {
          name: project.name,
          sourceUrl: project.sourceUrl,
          files: project.files,
          summary: project.summary,
          metadata: project.metadata || {}
        },
        timestamp: Date.now(),
        deviceInfo: this._getDeviceInfo()
      };

      try {
        const response = await this._sendToEndpoint(payload);
        this.stats.uploads++;
        this._lastSync = Date.now();
        return { success: true, remoteId: response.remoteId, timestamp: this._lastSync };
      } catch (error) {
        this.stats.errors++;
        return { success: false, error: error.message };
      }
    }

    async pullProject(projectId) {
      if (!this.syncEndpoint) {
        return { success: false, error: 'No sync endpoint configured' };
      }

      const payload = {
        action: 'pull',
        projectId,
        timestamp: this._lastSync || 0,
        deviceInfo: this._getDeviceInfo()
      };

      try {
        const response = await this._sendToEndpoint(payload);
        this.stats.downloads++;
        this._lastSync = Date.now();
        return { success: true, project: response.data, hasChanges: response.hasChanges };
      } catch (error) {
        this.stats.errors++;
        return { success: false, error: error.message };
      }
    }

    async syncAll() {
      if (this._syncing) return { success: false, error: 'Sync already in progress' };
      this._syncing = true;

      try {
        const localProjects = this.dbHelper ? await this.dbHelper.getAll('projects') : [];
        const conflicts = [];
        const synced = [];

        for (const project of localProjects) {
          const remote = await this.pullProject(project.id);

          if (remote.success && remote.hasChanges) {
            const localVersion = project.updatedAt || project.createdAt;
            const remoteVersion = remote.project.updatedAt || remote.project.createdAt;

            if (localVersion > remoteVersion) {
              await this.pushProject(project);
              synced.push({ projectId: project.id, direction: 'pushed' });
            } else if (remoteVersion > localVersion) {
              if (this.dbHelper) {
                await this.dbHelper.update('projects', { ...remote.project, id: project.id });
              }
              synced.push({ projectId: project.id, direction: 'pulled' });
            } else {
              conflicts.push({ projectId: project.id });
              this.stats.conflicts++;
            }
          } else {
            await this.pushProject(project);
            synced.push({ projectId: project.id, direction: 'pushed' });
          }
        }

        this._lastSync = Date.now();
        return { success: true, synced, conflicts, total: synced.length };
      } catch (error) {
        this.stats.errors++;
        return { success: false, error: error.message };
      } finally {
        this._syncing = false;
      }
    }

    async getSyncStatus() {
      const localCount = this.dbHelper ? await this.dbHelper.count('projects') : 0;

      return {
        configured: !!this.syncEndpoint,
        endpoint: this.syncEndpoint,
        autoSync: this.autoSync,
        lastSync: this._lastSync,
        syncing: this._syncing,
        localProjects: localCount,
        stats: { ...this.stats }
      };
    }

    async pushSettings() {
      if (!this.syncEndpoint) return { success: false, error: 'No sync endpoint configured' };

      try {
        const settings = await chrome.storage.sync.get(null);
        const payload = {
          action: 'push_settings',
          data: settings,
          timestamp: Date.now(),
          deviceInfo: this._getDeviceInfo()
        };

        await this._sendToEndpoint(payload);
        return { success: true };
      } catch (error) {
        this.stats.errors++;
        return { success: false, error: error.message };
      }
    }

    async pullSettings() {
      if (!this.syncEndpoint) return { success: false, error: 'No sync endpoint configured' };

      try {
        const payload = {
          action: 'pull_settings',
          timestamp: 0,
          deviceInfo: this._getDeviceInfo()
        };

        const response = await this._sendToEndpoint(payload);
        if (response.data) {
          await chrome.storage.sync.set(response.data);
        }
        return { success: true, settings: response.data };
      } catch (error) {
        this.stats.errors++;
        return { success: false, error: error.message };
      }
    }

    startAutoSync() {
      if (this._syncTimer || !this.autoSync || !this.syncEndpoint) return;

      this._syncTimer = setInterval(async () => {
        if (!this._syncing) {
          await this.syncAll();
        }
      }, this.syncInterval);
    }

    stopAutoSync() {
      if (this._syncTimer) {
        clearInterval(this._syncTimer);
        this._syncTimer = null;
      }
    }

    async _sendToEndpoint(payload) {
      const headers = {
        'Content-Type': 'application/json'
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(this.syncEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Sync request failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    }

    _getDeviceInfo() {
      const ua = navigator.userAgent;
      let platform = 'unknown';
      if (ua.includes('Windows')) platform = 'windows';
      else if (ua.includes('Mac')) platform = 'macos';
      else if (ua.includes('Linux')) platform = 'linux';
      else if (ua.includes('Android')) platform = 'android';
      else if (ua.includes('iOS')) platform = 'ios';

      return {
        platform,
        extensionVersion: chrome.runtime.getManifest().version,
        deviceId: this._getDeviceId()
      };
    }

    _getDeviceId() {
      let id = localStorage.getItem('cloud_sync_device_id');
      if (!id) {
        id = 'device_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('cloud_sync_device_id', id);
      }
      return id;
    }
  }

  window.CloudSync = CloudSync;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { CloudSync };
  }
}
