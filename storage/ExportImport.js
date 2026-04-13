class ExportImport {
  constructor(dbHelper, projectStore, fileStore) {
    this.db = dbHelper;
    this.projectStore = projectStore;
    this.fileStore = fileStore;
  }

  async exportAll() {
    try {
      const projects = await this.db.getAll('projects');
      const files = await this.db.getAll('files');
      const metadata = await this.db.getAll('metadata');
      const settings = await chrome.storage.sync.get(null);
      const localData = await chrome.storage.local.get(null);

      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        data: {
          projects,
          files,
          metadata,
          settings,
          local: localData
        },
        stats: {
          totalProjects: projects.length,
          totalFiles: files.length,
          totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0)
        }
      };

      return exportData;
    } catch (error) {
      console.error('[ExportImport] ExportAll failed:', error);
      throw error;
    }
  }

  async exportProjects(projectIds) {
    try {
      const projects = [];
      const files = [];

      for (const id of projectIds) {
        const project = await this.db.get('projects', id);
        if (project) {
          projects.push(project);
          const projectFiles = await this.fileStore.getByProject(id);
          files.push(...projectFiles);
        }
      }

      return {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        data: { projects, files },
        stats: {
          totalProjects: projects.length,
          totalFiles: files.length
        }
      };
    } catch (error) {
      console.error('[ExportImport] ExportProjects failed:', error);
      throw error;
    }
  }

  async exportAsJSON(data) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    return blob;
  }

  async downloadExport(data, filename = null) {
    const blob = await this.exportAsJSON(data);
    const name = filename || `code-extractor-export-${Date.now()}.json`;

    if (typeof saveAs !== 'undefined') {
      saveAs(blob, name);
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  async importFromJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      return this.importData(data);
    } catch (error) {
      console.error('[ExportImport] ImportFromJSON failed:', error);
      throw new Error('Invalid JSON format');
    }
  }

  async importFromFile(file) {
    try {
      const text = await file.text();
      return this.importFromJSON(text);
    } catch (error) {
      console.error('[ExportImport] ImportFromFile failed:', error);
      throw error;
    }
  }

  async importData(data) {
    if (!data || !data.data) {
      throw new Error('Invalid import data format');
    }

    if (data.version !== '1.0.0') {
      console.warn('[ExportImport] Version mismatch:', data.version);
    }

    const results = {
      projectsImported: 0,
      filesImported: 0,
      settingsImported: false,
      errors: []
    };

    try {
      if (data.data.projects && data.data.projects.length > 0) {
        for (const project of data.data.projects) {
          try {
            await this.db.update('projects', project);
            results.projectsImported++;
          } catch (e) {
            results.errors.push(`Failed to import project: ${project.name || project.id}`);
          }
        }
      }

      if (data.data.files && data.data.files.length > 0) {
        for (const file of data.data.files) {
          try {
            await this.db.update('files', file);
            results.filesImported++;
          } catch (e) {
            results.errors.push(`Failed to import file: ${file.name || file.id}`);
          }
        }
      }

      if (data.data.settings && Object.keys(data.data.settings).length > 0) {
        try {
          await chrome.storage.sync.set(data.data.settings);
          results.settingsImported = true;
        } catch (e) {
          results.errors.push('Failed to import settings');
        }
      }

      if (data.data.local && Object.keys(data.data.local).length > 0) {
        try {
          await chrome.storage.local.set(data.data.local);
        } catch (e) {
          results.errors.push('Failed to import local data');
        }
      }

      return results;
    } catch (error) {
      console.error('[ExportImport] ImportData failed:', error);
      throw error;
    }
  }

  async validateImportData(data) {
    const errors = [];

    if (!data) {
      errors.push('No data provided');
      return errors;
    }

    if (!data.version) {
      errors.push('Missing version field');
    }

    if (!data.data) {
      errors.push('Missing data field');
      return errors;
    }

    if (data.data.projects) {
      if (!Array.isArray(data.data.projects)) {
        errors.push('Projects must be an array');
      } else {
        data.data.projects.forEach((p, i) => {
          if (!p.id) errors.push(`Project at index ${i} missing id`);
        });
      }
    }

    if (data.data.files) {
      if (!Array.isArray(data.data.files)) {
        errors.push('Files must be an array');
      } else {
        data.data.files.forEach((f, i) => {
          if (!f.id) errors.push(`File at index ${i} missing id`);
          if (!f.projectId) errors.push(`File at index ${i} missing projectId`);
        });
      }
    }

    return errors;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ExportImport };
}
