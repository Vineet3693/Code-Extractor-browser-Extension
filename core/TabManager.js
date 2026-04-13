if (typeof window.TabManager === 'undefined') {
  window.TabManager = class TabManager {

    constructor() {
      this.activeTabs = new Map();
      this.currentTabId = null;
      this.onTabUpdate = null;
      this._pollInterval = null;
      this._pollMs = 2000;
    }

    async registerCurrentTab() {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0) return null;

        const tab = tabs[0];
        this.currentTabId = tab.id;

        const tabInfo = {
          id: tab.id,
          url: tab.url,
          title: tab.title,
          registeredAt: Date.now(),
          lastHeartbeat: Date.now(),
          projectData: null,
          isAlive: true
        };

        this.activeTabs.set(tab.id, tabInfo);
        this._broadcastPresence(tab.id);
        this._startHeartbeat(tab.id);

        return tabInfo;
      } catch (e) {
        console.error('[TabManager] Failed to register tab:', e);
        return null;
      }
    }

    async discoverTabs() {
      try {
        const allTabs = await chrome.tabs.query({ url: ['https://*/*', 'http://*/*'] });
        const discovered = [];

        for (const tab of allTabs) {
          if (tab.id === this.currentTabId) continue;

          try {
            const response = await chrome.tabs.sendMessage(tab.id, {
              action: 'TAB_MANAGER_PING',
              data: { fromTab: this.currentTabId }
            });

            if (response?.success) {
              const tabInfo = {
                id: tab.id,
                url: tab.url,
                title: tab.title,
                registeredAt: response.registeredAt || Date.now(),
                lastHeartbeat: Date.now(),
                projectData: response.projectData || null,
                isAlive: true
              };

              this.activeTabs.set(tab.id, tabInfo);
              discovered.push(tabInfo);
            }
          } catch (e) {
            if (this.activeTabs.has(tab.id)) {
              this.activeTabs.get(tab.id).isAlive = false;
            }
          }
        }

        this._cleanupDeadTabs();
        return discovered;
      } catch (e) {
        console.error('[TabManager] Tab discovery failed:', e);
        return [];
      }
    }

    async requestProjectData(tabId) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, {
          action: 'TAB_MANAGER_REQUEST_PROJECT',
          data: { fromTab: this.currentTabId }
        });

        if (response?.success && response.project) {
          const tabInfo = this.activeTabs.get(tabId);
          if (tabInfo) {
            tabInfo.projectData = response.project;
            tabInfo.lastHeartbeat = Date.now();
          }
          return response.project;
        }
        return null;
      } catch (e) {
        console.error('[TabManager] Failed to get project from tab:', tabId, e);
        return null;
      }
    }

    async broadcastProjectUpdate(project) {
      const updatePayload = {
        action: 'TAB_MANAGER_PROJECT_UPDATE',
        data: {
          fromTab: this.currentTabId,
          project,
          timestamp: Date.now()
        }
      };

      for (const [tabId, tabInfo] of this.activeTabs) {
        if (tabId === this.currentTabId || !tabInfo.isAlive) continue;
        try {
          await chrome.tabs.sendMessage(tabId, updatePayload);
        } catch (e) {
          tabInfo.isAlive = false;
        }
      }
    }

    async mergeAllTabs() {
      await this.discoverTabs();

      const allProjects = [];

      for (const [tabId, tabInfo] of this.activeTabs) {
        if (!tabInfo.isAlive) continue;

        let project = tabInfo.projectData;
        if (!project) {
          project = await this.requestProjectData(tabId);
        }

        if (project) {
          allProjects.push({
            tabId,
            url: tabInfo.url,
            title: tabInfo.title,
            project
          });
        }
      }

      const merged = this._mergeProjects(allProjects);
      return {
        merged,
        sourceTabs: allProjects.map(p => ({ tabId: p.tabId, url: p.url, title: p.title })),
        totalSourceTabs: allProjects.length,
        timestamp: Date.now()
      };
    }

    _mergeProjects(projects) {
      if (projects.length === 0) return null;
      if (projects.length === 1) return projects[0].project;

      const mergedFiles = [];
      const fileMap = new Map();

      for (const { project, tabId, url } of projects) {
        const files = project.files || [];
        for (const file of files) {
          const key = (file.path || file.fileName || '').toLowerCase();
          const existing = fileMap.get(key);

          if (!existing) {
            const fileWithSource = {
              ...file,
              sourceTabs: [{ tabId, url, timestamp: file.timestamp || Date.now() }]
            };
            fileMap.set(key, fileWithSource);
            mergedFiles.push(fileWithSource);
          } else {
            const existingContent = existing.content || '';
            const newContent = file.content || '';

            if (existingContent !== newContent) {
              const existingTimestamp = existing.sourceTabs[existing.sourceTabs.length - 1].timestamp;
              const newTimestamp = file.timestamp || Date.now();

              if (newTimestamp > existingTimestamp) {
                existing.content = newContent;
                existing.size = file.size || newContent.length;
                existing.lines = file.lines || newContent.split('\n').length;
                existing.updatedAt = newTimestamp;
              }

              existing.sourceTabs.push({ tabId, url, timestamp: newTimestamp });
            }
          }
        }
      }

      const firstProject = projects[0].project;
      return {
        ...firstProject,
        files: mergedFiles,
        totalFiles: mergedFiles.length,
        totalLines: mergedFiles.reduce((sum, f) => sum + (f.lines || 0), 0),
        totalSize: mergedFiles.reduce((sum, f) => sum + (f.size || 0), 0),
        mergedFrom: projects.map(p => ({ tabId: p.tabId, url: p.url, title: p.title })),
        mergedAt: Date.now()
      };
    }

    _broadcastPresence(tabId) {
      if (typeof chrome.runtime?.sendMessage === 'function') {
        chrome.runtime.sendMessage({
          action: 'TAB_MANAGER_REGISTER',
          data: {
            tabId,
            url: window.location.href,
            title: document.title,
            registeredAt: Date.now()
          }
        }).catch(() => { });
      }
    }

    _startHeartbeat(tabId) {
      if (this._pollInterval) clearInterval(this._pollInterval);

      this._pollInterval = setInterval(() => {
        const tabInfo = this.activeTabs.get(tabId);
        if (tabInfo) {
          tabInfo.lastHeartbeat = Date.now();
          this._broadcastPresence(tabId);
        }
        this._cleanupDeadTabs();
      }, this._pollMs);
    }

    _cleanupDeadTabs() {
      const now = Date.now();
      const timeout = this._pollMs * 3;

      for (const [tabId, tabInfo] of this.activeTabs) {
        if (now - tabInfo.lastHeartbeat > timeout) {
          tabInfo.isAlive = false;
        }
      }
    }

    getActiveTabs() {
      return Array.from(this.activeTabs.values()).filter(t => t.isAlive);
    }

    getTabCount() {
      return this.getActiveTabs().length;
    }

    unregister() {
      if (this._pollInterval) {
        clearInterval(this._pollInterval);
        this._pollInterval = null;
      }
      this.activeTabs.clear();
      this.currentTabId = null;
    }
  }
  window.TabManager = TabManager;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { TabManager: window.TabManager };
}
