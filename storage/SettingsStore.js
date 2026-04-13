class SettingsStore {
  constructor() {
    this.defaults = {
      theme: 'dark',
      autoScan: false,
      duplicateStrategy: 'keep_latest',
      showNotifications: true,
      highlightBlocks: true,
      includeReadme: true,
      includeGitignore: true,
      includeDependencies: false,
      defaultProjectName: 'extracted-project',
      maxScanDepth: 50,
      scanTimeout: 30000,
      historyLimit: 100,
      downloadLocation: 'ask',
      codePreviewLines: 50,
      fontSize: 13,
      compactMode: false,
      debugMode: false,
      firstRun: true,
      installedVersion: '1.0.0'
    };
  }

  async get(key) {
    try {
      const result = await chrome.storage.sync.get(key);
      return result[key] !== undefined ? result[key] : this.defaults[key];
    } catch (error) {
      console.error('[SettingsStore] Get failed:', error);
      return this.defaults[key];
    }
  }

  async getAll() {
    try {
      const result = await chrome.storage.sync.get(null);
      return { ...this.defaults, ...result };
    } catch (error) {
      console.error('[SettingsStore] GetAll failed:', error);
      return { ...this.defaults };
    }
  }

  async set(key, value) {
    try {
      await chrome.storage.sync.set({ [key]: value });
    } catch (error) {
      console.error('[SettingsStore] Set failed:', error);
      throw error;
    }
  }

  async setMultiple(settings) {
    try {
      await chrome.storage.sync.set(settings);
    } catch (error) {
      console.error('[SettingsStore] SetMultiple failed:', error);
      throw error;
    }
  }

  async reset(key) {
    try {
      if (key) {
        await chrome.storage.sync.remove(key);
      } else {
        await chrome.storage.sync.clear();
      }
    } catch (error) {
      console.error('[SettingsStore] Reset failed:', error);
      throw error;
    }
  }

  async resetAll() {
    try {
      await chrome.storage.sync.clear();
      await chrome.storage.sync.set(this.defaults);
    } catch (error) {
      console.error('[SettingsStore] ResetAll failed:', error);
      throw error;
    }
  }

  async getTheme() {
    return this.get('theme');
  }

  async setTheme(theme) {
    return this.set('theme', theme);
  }

  async getDuplicateStrategy() {
    return this.get('duplicateStrategy');
  }

  async setDuplicateStrategy(strategy) {
    return this.set('duplicateStrategy', strategy);
  }

  async isFirstRun() {
    return this.get('firstRun');
  }

  async markFirstRunComplete() {
    return this.set('firstRun', false);
  }

  async getInstalledVersion() {
    return this.get('installedVersion');
  }

  async setInstalledVersion(version) {
    return this.set('installedVersion', version);
  }

  async subscribe(callback) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync') {
        callback(changes);
      }
    });
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { SettingsStore };
}
