if (typeof window.APIBridge === 'undefined') {
  class APIBridge {
    constructor(options = {}) {
      this.dbHelper = options.dbHelper;
      this.apiEnabled = options.apiEnabled ?? false;
      this.apiKey = options.apiKey || null;
      this.allowedOrigins = options.allowedOrigins || ['http://localhost:*', 'http://127.0.0.1:*'];
      this.port = options.port || 8765;
      this._server = null;
      this._requestLog = [];
      this.stats = { totalRequests: 0, scanRequests: 0, exportRequests: 0, errors: 0 };
    }

    async enable(options = {}) {
      if (options.apiKey) this.apiKey = options.apiKey;
      if (options.allowedOrigins) this.allowedOrigins = options.allowedOrigins;
      if (options.port) this.port = options.port;

      this.apiEnabled = true;

      if (this.dbHelper) {
        await this.dbHelper.update('settings', {
          key: 'apiBridge',
          value: {
            enabled: true,
            port: this.port,
            allowedOrigins: this.allowedOrigins,
            createdAt: Date.now()
          }
        });
      }

      this._setupMessageListener();
      return { success: true, port: this.port };
    }

    disable() {
      this.apiEnabled = false;
      this._removeMessageListener();
      return { success: true };
    }

    _setupMessageListener() {
      this._messageHandler = (message, sender, sendResponse) => {
        if (message.action?.startsWith('API_')) {
          this._handleAPIMessage(message, sender, sendResponse);
          return true;
        }
        return false;
      };

      chrome.runtime.onMessage.addListener(this._messageHandler);
    }

    _removeMessageListener() {
      if (this._messageHandler) {
        chrome.runtime.onMessage.removeListener(this._messageHandler);
        this._messageHandler = null;
      }
    }

    async _handleAPIMessage(message, sender, sendResponse) {
      if (!this.apiEnabled) {
        sendResponse({ success: false, error: 'API bridge is disabled' });
        return;
      }

      if (this.apiKey && message.apiKey !== this.apiKey) {
        this.stats.errors++;
        sendResponse({ success: false, error: 'Invalid API key' });
        return;
      }

      this.stats.totalRequests++;
      this._logRequest(message.action, sender);

      try {
        switch (message.action) {
          case 'API_SCAN_PAGE':
            this.stats.scanRequests++;
            await this._apiScanPage(message.data, sendResponse);
            break;

          case 'API_GET_PROJECTS':
            await this._apiGetProjects(sendResponse);
            break;

          case 'API_GET_PROJECT':
            await this._apiGetProject(message.data, sendResponse);
            break;

          case 'API_EXPORT_ZIP':
            this.stats.exportRequests++;
            await this._apiExportZip(message.data, sendResponse);
            break;

          case 'API_SAVE_PROJECT':
            await this._apiSaveProject(message.data, sendResponse);
            break;

          case 'API_DELETE_PROJECT':
            await this._apiDeleteProject(message.data, sendResponse);
            break;

          case 'API_GET_SETTINGS':
            await this._apiGetSettings(sendResponse);
            break;

          case 'API_UPDATE_SETTINGS':
            await this._apiUpdateSettings(message.data, sendResponse);
            break;

          case 'API_GET_STATS':
            await this._apiGetStats(sendResponse);
            break;

          case 'API_HEALTH':
            sendResponse({ success: true, status: 'ok', version: '3.0.0' });
            break;

          default:
            sendResponse({ success: false, error: `Unknown action: ${message.action}` });
        }
      } catch (error) {
        this.stats.errors++;
        sendResponse({ success: false, error: error.message });
      }
    }

    async _apiScanPage(data, sendResponse) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        sendResponse({ success: false, error: 'No active tab' });
        return;
      }

      try {
        const result = await chrome.tabs.sendMessage(tab.id, {
          action: 'SCAN_PAGE',
          data: data || {}
        });

        sendResponse(result);
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }

    async _apiGetProjects(sendResponse) {
      const projects = this.dbHelper ? await this.dbHelper.getAll('projects') : [];
      sendResponse({ success: true, projects, count: projects.length });
    }

    async _apiGetProject(data, sendResponse) {
      if (!data?.id) {
        sendResponse({ success: false, error: 'Project ID required' });
        return;
      }

      const project = this.dbHelper ? await this.dbHelper.get('projects', data.id) : null;
      if (!project) {
        sendResponse({ success: false, error: 'Project not found' });
        return;
      }

      sendResponse({ success: true, project });
    }

    async _apiExportZip(data, sendResponse) {
      if (!data?.projectId) {
        sendResponse({ success: false, error: 'Project ID required' });
        return;
      }

      const project = this.dbHelper ? await this.dbHelper.get('projects', data.projectId) : null;
      if (!project) {
        sendResponse({ success: false, error: 'Project not found' });
        return;
      }

      try {
        const zip = new JSZip();
        for (const file of (project.files || [])) {
          const path = file.path || file.fileName || 'unknown.txt';
          zip.file(path, file.content || '');
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);

        sendResponse({
          success: true,
          downloadUrl: url,
          fileName: `${project.name || 'project'}.zip`,
          size: blob.size
        });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }

    async _apiSaveProject(data, sendResponse) {
      if (!data?.name || !data?.files) {
        sendResponse({ success: false, error: 'Project name and files required' });
        return;
      }

      const project = {
        id: data.id || Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
        name: data.name,
        sourceUrl: data.sourceUrl || '',
        files: data.files,
        summary: data.summary || {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      if (this.dbHelper) {
        await this.dbHelper.add('projects', project);
      }

      sendResponse({ success: true, project });
    }

    async _apiDeleteProject(data, sendResponse) {
      if (!data?.id) {
        sendResponse({ success: false, error: 'Project ID required' });
        return;
      }

      if (this.dbHelper) {
        await this.dbHelper.delete('projects', data.id);
      }

      sendResponse({ success: true });
    }

    async _apiGetSettings(sendResponse) {
      const settings = await chrome.storage.sync.get(null);
      sendResponse({ success: true, settings });
    }

    async _apiUpdateSettings(data, sendResponse) {
      await chrome.storage.sync.set(data);
      sendResponse({ success: true });
    }

    async _apiGetStats(sendResponse) {
      const projectCount = this.dbHelper ? await this.dbHelper.count('projects') : 0;
      const fileCount = this.dbHelper ? await this.dbHelper.count('files') : 0;

      sendResponse({
        success: true,
        stats: {
          ...this.stats,
          projects: projectCount,
          files: fileCount,
          uptime: Date.now()
        }
      });
    }

    _logRequest(action, sender) {
      this._requestLog.push({
        action,
        source: sender?.url || 'unknown',
        timestamp: Date.now()
      });

      if (this._requestLog.length > 100) {
        this._requestLog = this._requestLog.slice(-100);
      }
    }

    getRequestLog() {
      return [...this._requestLog];
    }

    getStats() {
      return { ...this.stats, requestLogSize: this._requestLog.length };
    }

    generateApiKey() {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let key = 'ce_api_';
      for (let i = 0; i < 32; i++) {
        key += chars[Math.floor(Math.random() * chars.length)];
      }
      return key;
    }
  }

  window.APIBridge = APIBridge;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { APIBridge };
  }
}
