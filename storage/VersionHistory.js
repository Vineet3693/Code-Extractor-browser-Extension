if (typeof window.VersionHistory === 'undefined') {
  class VersionHistory {
    constructor(dbHelper) {
      this.db = dbHelper;
      this.storeName = 'version_history';
      this.maxVersionsPerFile = 20;
      this.compressionEnabled = true;
    }

    async saveVersion(projectId, fileName, filePath, content, metadata = {}) {
      const version = {
        id: `ver_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`,
        projectId,
        fileName,
        filePath,
        content,
        size: content?.length || 0,
        lines: content ? content.split('\n').length : 0,
        timestamp: Date.now(),
        changeType: metadata.changeType || 'manual_edit',
        changeDescription: metadata.changeDescription || '',
        source: metadata.source || 'unknown',
        diff: metadata.diff || null,
        tags: metadata.tags || [],
        isFavorite: false
      };

      try {
        await this.db.add(this.storeName, version);
        await this._enforceMaxVersions(projectId, fileName);
        return version.id;
      } catch (error) {
        console.error('[VersionHistory] Save failed:', error);
        throw error;
      }
    }

    async getVersions(projectId, fileName) {
      try {
        const allVersions = await this.db.getAll(this.storeName);
        const fileVersions = allVersions.filter(
          v => v.projectId === projectId && v.filePath === fileName
        );
        return fileVersions.sort((a, b) => b.timestamp - a.timestamp);
      } catch (error) {
        console.error('[VersionHistory] Get versions failed:', error);
        return [];
      }
    }

    async getVersion(versionId) {
      try {
        return await this.db.get(this.storeName, versionId);
      } catch (error) {
        console.error('[VersionHistory] Get version failed:', error);
        return null;
      }
    }

    async getVersionAt(projectId, fileName, timestamp) {
      try {
        const versions = await this.getVersions(projectId, fileName);
        return versions.find(v => v.timestamp <= timestamp) || null;
      } catch (error) {
        console.error('[VersionHistory] Get version at failed:', error);
        return null;
      }
    }

    async getTimeline(projectId) {
      try {
        const allVersions = await this.db.getAll(this.storeName);
        const projectVersions = allVersions.filter(v => v.projectId === projectId);

        const timeline = {};
        for (const version of projectVersions) {
          const dateKey = new Date(version.timestamp).toISOString().split('T')[0];
          if (!timeline[dateKey]) {
            timeline[dateKey] = { date: dateKey, changes: [], fileCount: 0 };
          }
          timeline[dateKey].changes.push(version);
          timeline[dateKey].fileCount++;
        }

        return Object.values(timeline).sort((a, b) => b.date.localeCompare(a.date));
      } catch (error) {
        console.error('[VersionHistory] Get timeline failed:', error);
        return [];
      }
    }

    async getDiffBetween(projectId, fileName, versionId1, versionId2) {
      try {
        const v1 = await this.getVersion(versionId1);
        const v2 = await this.getVersion(versionId2);

        if (!v1 || !v2) return null;

        return {
          fileName,
          filePath: v1.filePath,
          oldVersion: {
            id: v1.id,
            timestamp: v1.timestamp,
            content: v1.content,
            size: v1.size,
            lines: v1.lines
          },
          newVersion: {
            id: v2.id,
            timestamp: v2.timestamp,
            content: v2.content,
            size: v2.size,
            lines: v2.lines
          },
          diff: this._computeDiff(v1.content, v2.content)
        };
      } catch (error) {
        console.error('[VersionHistory] Get diff failed:', error);
        return null;
      }
    }

    async deleteVersion(versionId) {
      try {
        await this.db.delete(this.storeName, versionId);
      } catch (error) {
        console.error('[VersionHistory] Delete version failed:', error);
        throw error;
      }
    }

    async deleteProjectVersions(projectId) {
      try {
        const allVersions = await this.db.getAll(this.storeName);
        const toDelete = allVersions.filter(v => v.projectId === projectId);
        for (const version of toDelete) {
          await this.db.delete(this.storeName, version.id);
        }
        return toDelete.length;
      } catch (error) {
        console.error('[VersionHistory] Delete project versions failed:', error);
        return 0;
      }
    }

    async toggleFavorite(versionId) {
      try {
        const version = await this.getVersion(versionId);
        if (!version) throw new Error(`Version not found: ${versionId}`);

        version.isFavorite = !version.isFavorite;
        await this.db.update(this.storeName, version);
        return version.isFavorite;
      } catch (error) {
        console.error('[VersionHistory] Toggle favorite failed:', error);
        throw error;
      }
    }

    async getStats(projectId) {
      try {
        const allVersions = await this.db.getAll(this.storeName);
        const projectVersions = allVersions.filter(v => v.projectId === projectId);

        const fileVersions = {};
        for (const v of projectVersions) {
          if (!fileVersions[v.filePath]) {
            fileVersions[v.filePath] = [];
          }
          fileVersions[v.filePath].push(v);
        }

        const mostChangedFile = Object.entries(fileVersions)
          .sort((a, b) => b[1].length - a[1].length)[0];

        return {
          totalVersions: projectVersions.length,
          totalFiles: Object.keys(fileVersions).length,
          mostChangedFile: mostChangedFile ? mostChangedFile[0] : null,
          mostChangedCount: mostChangedFile ? mostChangedFile[1].length : 0,
          firstVersion: projectVersions.length > 0
            ? Math.min(...projectVersions.map(v => v.timestamp))
            : null,
          lastVersion: projectVersions.length > 0
            ? Math.max(...projectVersions.map(v => v.timestamp))
            : null,
          changeTypes: this._countChangeTypes(projectVersions)
        };
      } catch (error) {
        console.error('[VersionHistory] Get stats failed:', error);
        return { totalVersions: 0, totalFiles: 0 };
      }
    }

    async saveBatchVersions(versions) {
      const ids = [];
      for (const v of versions) {
        try {
          const id = await this.saveVersion(
            v.projectId, v.fileName, v.filePath, v.content, v.metadata
          );
          ids.push(id);
        } catch (e) {
          console.error('[VersionHistory] Batch save failed for:', v.fileName, e);
        }
      }
      return ids;
    }

    _computeDiff(oldContent, newContent) {
      if (!oldContent && !newContent) return [];
      if (!oldContent) return newContent.split('\n').map(line => ({ type: 'added', content: line }));
      if (!newContent) return oldContent.split('\n').map(line => ({ type: 'removed', content: line }));

      const oldLines = oldContent.split('\n');
      const newLines = newContent.split('\n');
      const diff = [];

      const lcs = this._longestCommonSubsequence(oldLines, newLines);

      let i = 0, j = 0, k = 0;
      while (i < oldLines.length || j < newLines.length) {
        if (k < lcs.length && i < oldLines.length && oldLines[i] === lcs[k]) {
          if (j < newLines.length && newLines[j] === lcs[k]) {
            diff.push({ type: 'unchanged', content: newLines[j], lineNum: j + 1 });
            j++;
            i++;
            k++;
          } else {
            diff.push({ type: 'removed', content: oldLines[i], lineNum: i + 1 });
            i++;
          }
        } else if (j < newLines.length) {
          diff.push({ type: 'added', content: newLines[j], lineNum: j + 1 });
          j++;
        } else if (i < oldLines.length) {
          diff.push({ type: 'removed', content: oldLines[i], lineNum: i + 1 });
          i++;
        }
      }

      return diff;
    }

    _longestCommonSubsequence(arr1, arr2) {
      const m = arr1.length;
      const n = arr2.length;
      const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          if (arr1[i - 1] === arr2[j - 1]) {
            dp[i][j] = dp[i - 1][j - 1] + 1;
          } else {
            dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
          }
        }
      }

      const result = [];
      let i = m, j = n;
      while (i > 0 && j > 0) {
        if (arr1[i - 1] === arr2[j - 1]) {
          result.unshift(arr1[i - 1]);
          i--;
          j--;
        } else if (dp[i - 1][j] > dp[i][j - 1]) {
          i--;
        } else {
          j--;
        }
      }

      return result;
    }

    async _enforceMaxVersions(projectId, fileName) {
      try {
        const versions = await this.getVersions(projectId, fileName);
        if (versions.length > this.maxVersionsPerFile) {
          const toDelete = versions.slice(this.maxVersionsPerFile);
          for (const version of toDelete) {
            if (!version.isFavorite) {
              await this.db.delete(this.storeName, version.id);
            }
          }
        }
      } catch (error) {
        console.error('[VersionHistory] Enforce max versions failed:', error);
      }
    }

    _countChangeTypes(versions) {
      const counts = {};
      for (const v of versions) {
        const type = v.changeType || 'unknown';
        counts[type] = (counts[type] || 0) + 1;
      }
      return counts;
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VersionHistory };
  }
  window.VersionHistory = VersionHistory;
}
