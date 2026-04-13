class FileStore {
  constructor(dbHelper) {
    this.db = dbHelper;
    this.storeName = 'files';
  }

  async create(projectId, fileData) {
    const file = {
      id: fileData.id || Date.now().toString(36) + Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 4),
      projectId,
      path: fileData.path || fileData.name || 'unknown.txt',
      name: fileData.name || this.getBaseName(fileData.path),
      directory: fileData.directory || this.getDirectory(fileData.path),
      language: fileData.language || 'text',
      content: fileData.content || '',
      lineCount: fileData.lineCount || (fileData.content || '').split('\n').length,
      size: fileData.size || (fileData.content || '').length,
      order: fileData.order || 0,
      createdAt: Date.now()
    };

    try {
      await this.db.add(this.storeName, file);
      return file.id;
    } catch (error) {
      console.error('[FileStore] Create failed:', error);
      throw error;
    }
  }

  async read(fileId) {
    try {
      const file = await this.db.get(this.storeName, fileId);
      return file || null;
    } catch (error) {
      console.error('[FileStore] Read failed:', error);
      throw error;
    }
  }

  async update(fileId, updates) {
    try {
      const existing = await this.db.get(this.storeName, fileId);
      if (!existing) throw new Error(`File not found: ${fileId}`);

      const updated = { ...existing, ...updates };

      if (updates.content !== undefined) {
        updated.lineCount = updates.content.split('\n').length;
        updated.size = updates.content.length;
      }

      await this.db.update(this.storeName, updated);
      return updated;
    } catch (error) {
      console.error('[FileStore] Update failed:', error);
      throw error;
    }
  }

  async delete(fileId) {
    try {
      await this.db.delete(this.storeName, fileId);
    } catch (error) {
      console.error('[FileStore] Delete failed:', error);
      throw error;
    }
  }

  async getByProject(projectId) {
    try {
      const files = await this.db.query(this.storeName, 'by_project', projectId);
      return files.sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
      console.error('[FileStore] GetByProject failed:', error);
      return [];
    }
  }

  async search(query, projectId = null) {
    try {
      let files;
      if (projectId) {
        files = await this.getByProject(projectId);
      } else {
        files = await this.db.getAll(this.storeName);
      }

      const lowerQuery = query.toLowerCase();

      return files.filter(f =>
        (f.name || '').toLowerCase().includes(lowerQuery) ||
        (f.path || '').toLowerCase().includes(lowerQuery) ||
        (f.language || '').toLowerCase().includes(lowerQuery) ||
        (f.content || '').toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      console.error('[FileStore] Search failed:', error);
      return [];
    }
  }

  async getByLanguage(language) {
    try {
      return await this.db.query(this.storeName, 'by_language', language);
    } catch (error) {
      console.error('[FileStore] GetByLanguage failed:', error);
      return [];
    }
  }

  async getByPath(path) {
    try {
      const results = await this.db.query(this.storeName, 'by_path', path);
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error('[FileStore] GetByPath failed:', error);
      return null;
    }
  }

  async deleteByProject(projectId) {
    try {
      const files = await this.getByProject(projectId);
      for (const file of files) {
        await this.db.delete(this.storeName, file.id);
      }
      return files.length;
    } catch (error) {
      console.error('[FileStore] DeleteByProject failed:', error);
      throw error;
    }
  }

  async batchCreate(projectId, files) {
    try {
      const items = files.map((fileData, index) => ({
        id: fileData.id || Date.now().toString(36) + Math.random().toString(36).substr(2, 9) + index.toString(36),
        projectId,
        path: fileData.path || fileData.name || `file_${index}.txt`,
        name: fileData.name || this.getBaseName(fileData.path),
        directory: fileData.directory || this.getDirectory(fileData.path),
        language: fileData.language || 'text',
        content: fileData.content || '',
        lineCount: fileData.lineCount || (fileData.content || '').split('\n').length,
        size: fileData.size || (fileData.content || '').length,
        order: fileData.order || index,
        createdAt: Date.now()
      }));

      await this.db.batchAdd(this.storeName, items);
      return items.map(f => f.id);
    } catch (error) {
      console.error('[FileStore] BatchCreate failed:', error);
      throw error;
    }
  }

  async reorder(projectId, fileIds) {
    try {
      for (let i = 0; i < fileIds.length; i++) {
        await this.update(fileIds[i], { order: i });
      }
    } catch (error) {
      console.error('[FileStore] Reorder failed:', error);
      throw error;
    }
  }

  async countByProject(projectId) {
    try {
      const files = await this.getByProject(projectId);
      return files.length;
    } catch (error) {
      console.error('[FileStore] CountByProject failed:', error);
      return 0;
    }
  }

  async getTotalSizeByProject(projectId) {
    try {
      const files = await this.getByProject(projectId);
      return files.reduce((sum, f) => sum + (f.size || 0), 0);
    } catch (error) {
      console.error('[FileStore] GetTotalSizeByProject failed:', error);
      return 0;
    }
  }

  getBaseName(path) {
    if (!path) return 'unknown.txt';
    const parts = path.split('/');
    return parts[parts.length - 1];
  }

  getDirectory(path) {
    if (!path) return '';
    const parts = path.split('/');
    if (parts.length <= 1) return '';
    return parts.slice(0, -1).join('/');
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { FileStore };
}
