class StorageManager {
  constructor() {
    this.isInitialized = false;
    this.db = null;
    this.projectStore = null;
    this.fileStore = null;
    this.settingsStore = null;
    this.exportImport = null;
  }

  async init() {
    if (this.isInitialized) return;

    try {
      this.db = new IndexedDBHelper();
      await this.db.open();

      this.projectStore = new ProjectStore(this.db);
      this.fileStore = new FileStore(this.db);
      this.settingsStore = new SettingsStore();
      this.exportImport = new ExportImport(this.db, this.projectStore, this.fileStore);

      this.isInitialized = true;
    } catch (error) {
      console.error('[StorageManager] Failed to initialize:', error);
      throw error;
    }
  }

  async ensureStorage() {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  async saveProject(project) {
    await this.ensureStorage();

    const projectId = await this.projectStore.create({
      name: project.name || 'extracted-project',
      sourceURL: project.sourceURL || project.metadata?.sourceURL || '',
      sourceSite: project.sourceSite || project.metadata?.sourceSite || 'unknown',
      pageTitle: project.pageTitle || project.metadata?.pageTitle || '',
      totalFiles: project.totalFiles || project.files?.length || 0,
      totalLines: project.totalLines || project.metadata?.totalCodeLines || 0,
      totalSize: project.totalSize || project.metadata?.totalSize || 0,
      languages: project.languages || project.metadata?.languages || [],
      treeJSON: project.treeJSON || JSON.stringify(project.tree || null),
      tags: project.tags || [],
      isFavorite: project.isFavorite || false,
      downloadCount: 0,
      version: 1
    });

    if (project.files && project.files.length > 0) {
      await this.fileStore.batchCreate(projectId, project.files.map((f, i) => ({
        path: f.path || f.fileName,
        name: f.name || f.fileName,
        directory: f.directory || '',
        language: f.language || 'text',
        content: f.content || '',
        lineCount: f.lineCount || f.lines || 0,
        size: f.size || 0,
        order: f.order || i
      })));
    }

    return projectId;
  }

  async getProjects() {
    await this.ensureStorage();
    const { items } = await this.projectStore.list({ limit: 100 });
    return items;
  }

  async getProject(id) {
    await this.ensureStorage();
    return this.projectStore.read(id);
  }

  async updateProject(id, updates) {
    await this.ensureStorage();
    return this.projectStore.update(id, updates);
  }

  async deleteProject(id) {
    await this.ensureStorage();
    return this.projectStore.delete(id);
  }

  async addScanHistory(entry) {
    await this.ensureStorage();
    const history = await this.getScanHistory();
    entry.id = entry.id || Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    entry.timestamp = entry.timestamp || new Date().toISOString();
    history.unshift(entry);

    const maxItems = await this.getMaxHistoryItems();
    if (history.length > maxItems) {
      history.length = maxItems;
    }

    await chrome.storage.local.set({ scanHistory: history });
    return entry;
  }

  async getScanHistory(limit = 20) {
    const result = await chrome.storage.local.get('scanHistory');
    const history = result.scanHistory || [];
    return history.slice(0, limit);
  }

  async clearScanHistory() {
    await chrome.storage.local.set({ scanHistory: [] });
  }

  async getSettings() {
    await this.ensureStorage();
    return this.settingsStore.getAll();
  }

  async updateSettings(settings) {
    await this.ensureStorage();
    return this.settingsStore.setMultiple(settings);
  }

  async getMaxHistoryItems() {
    const settings = await this.getSettings();
    return settings.historyLimit || 100;
  }

  async exportAll() {
    await this.ensureStorage();
    return this.exportImport.exportAll();
  }

  async importAll(data) {
    await this.ensureStorage();
    return this.exportImport.importData(data);
  }

  async clearAll() {
    await this.ensureStorage();
    await this.db.clear('projects');
    await this.db.clear('files');
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
  }

  async getStorageUsage() {
    await this.ensureStorage();
    const stats = await this.db.getStorageStats();
    const projects = stats.projects || 0;
    const files = stats.files || 0;
    const localBytes = await chrome.storage.local.getBytesInUse();
    return { projects, files, localBytes };
  }

  async searchProjects(query) {
    await this.ensureStorage();
    return this.projectStore.search(query);
  }

  async toggleFavorite(projectId) {
    await this.ensureStorage();
    return this.projectStore.toggleFavorite(projectId);
  }

  async getFavorites() {
    await this.ensureStorage();
    return this.projectStore.getFavorites();
  }

  async getProjectCount() {
    await this.ensureStorage();
    return this.projectStore.count();
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { StorageManager };
}
