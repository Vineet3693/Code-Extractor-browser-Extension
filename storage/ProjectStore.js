class ProjectStore {
  constructor(dbHelper) {
    this.db = dbHelper;
    this.storeName = 'projects';
  }

  async create(projectData) {
    const project = {
      id: projectData.id || Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      name: projectData.name || 'extracted-project',
      sourceURL: projectData.sourceURL || '',
      sourceSite: projectData.sourceSite || 'unknown',
      pageTitle: projectData.pageTitle || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      totalFiles: projectData.totalFiles || 0,
      totalLines: projectData.totalLines || 0,
      totalSize: projectData.totalSize || 0,
      languages: projectData.languages || [],
      treeJSON: projectData.treeJSON || '',
      thumbnailData: projectData.thumbnailData || null,
      tags: projectData.tags || [],
      isFavorite: projectData.isFavorite || false,
      downloadCount: projectData.downloadCount || 0,
      version: projectData.version || 1
    };

    try {
      await this.db.add(this.storeName, project);
      await this.updateMetadata('totalProjects');
      return project.id;
    } catch (error) {
      console.error('[ProjectStore] Create failed:', error);
      throw error;
    }
  }

  async read(projectId) {
    try {
      const project = await this.db.get(this.storeName, projectId);
      if (!project) return null;

      const files = await this.getFilesForProject(projectId);
      return { ...project, files };
    } catch (error) {
      console.error('[ProjectStore] Read failed:', error);
      throw error;
    }
  }

  async update(projectId, updates) {
    try {
      const existing = await this.db.get(this.storeName, projectId);
      if (!existing) throw new Error(`Project not found: ${projectId}`);

      const updated = {
        ...existing,
        ...updates,
        updatedAt: Date.now()
      };

      await this.db.update(this.storeName, updated);
      return updated;
    } catch (error) {
      console.error('[ProjectStore] Update failed:', error);
      throw error;
    }
  }

  async delete(projectId) {
    try {
      const fileStore = new FileStore(this.db);
      await fileStore.deleteByProject(projectId);
      await this.db.delete(this.storeName, projectId);
      await this.updateMetadata('totalProjects');
    } catch (error) {
      console.error('[ProjectStore] Delete failed:', error);
      throw error;
    }
  }

  async list(options = {}) {
    const { limit = 20, offset = 0, sortBy = 'createdAt', direction = 'prev', filter = {} } = options;

    try {
      const { items, total, hasMore } = await this.db.paginate(
        this.storeName,
        offset,
        limit,
        sortBy === 'createdAt' ? 'by_created' : null,
        direction
      );

      let filtered = items;

      if (filter.sourceSite) {
        filtered = filtered.filter(p => p.sourceSite === filter.sourceSite);
      }
      if (filter.language) {
        filtered = filtered.filter(p => p.languages && p.languages.includes(filter.language));
      }
      if (filter.isFavorite) {
        filtered = filtered.filter(p => p.isFavorite);
      }

      return { items: filtered, total: filtered.length, hasMore: hasMore };
    } catch (error) {
      console.error('[ProjectStore] List failed:', error);
      throw error;
    }
  }

  async search(query) {
    try {
      const projects = await this.db.getAll(this.storeName);
      const lowerQuery = query.toLowerCase();

      return projects.filter(p =>
        (p.name || '').toLowerCase().includes(lowerQuery) ||
        (p.sourceURL || '').toLowerCase().includes(lowerQuery) ||
        (p.pageTitle || '').toLowerCase().includes(lowerQuery) ||
        (p.tags || []).some(tag => tag.toLowerCase().includes(lowerQuery)) ||
        (p.languages || []).some(lang => lang.toLowerCase().includes(lowerQuery))
      );
    } catch (error) {
      console.error('[ProjectStore] Search failed:', error);
      throw error;
    }
  }

  async count() {
    try {
      return await this.db.count(this.storeName);
    } catch (error) {
      console.error('[ProjectStore] Count failed:', error);
      return 0;
    }
  }

  async getFavorites() {
    try {
      return await this.db.query(this.storeName, 'by_favorite', true);
    } catch (error) {
      console.error('[ProjectStore] GetFavorites failed:', error);
      return [];
    }
  }

  async getBySource(sourceSite) {
    try {
      return await this.db.query(this.storeName, 'by_source', sourceSite);
    } catch (error) {
      console.error('[ProjectStore] GetBySource failed:', error);
      return [];
    }
  }

  async getByLanguage(language) {
    try {
      return await this.db.query(this.storeName, 'by_language', language);
    } catch (error) {
      console.error('[ProjectStore] GetByLanguage failed:', error);
      return [];
    }
  }

  async toggleFavorite(projectId) {
    const project = await this.db.get(this.storeName, projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    project.isFavorite = !project.isFavorite;
    project.updatedAt = Date.now();
    await this.db.update(this.storeName, project);
    return project.isFavorite;
  }

  async incrementDownloadCount(projectId) {
    const project = await this.db.get(this.storeName, projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    project.downloadCount = (project.downloadCount || 0) + 1;
    project.updatedAt = Date.now();
    await this.db.update(this.storeName, project);
  }

  async deleteOldProjects(beforeTimestamp) {
    try {
      const projects = await this.db.getAll(this.storeName);
      const toDelete = projects.filter(p => p.createdAt < beforeTimestamp);

      for (const project of toDelete) {
        await this.delete(project.id);
      }

      return toDelete.length;
    } catch (error) {
      console.error('[ProjectStore] DeleteOldProjects failed:', error);
      throw error;
    }
  }

  async getFilesForProject(projectId) {
    const fileStore = new FileStore(this.db);
    return fileStore.getByProject(projectId);
  }

  async updateMetadata(key) {
    try {
      if (key === 'totalProjects') {
        const count = await this.count();
        await this.db.update('metadata', { key: 'totalProjects', value: count });
      }
    } catch (error) {
      console.error('[ProjectStore] UpdateMetadata failed:', error);
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ProjectStore };
}
