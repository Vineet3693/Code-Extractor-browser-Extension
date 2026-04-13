if (typeof window.SmartDuplicateDetector === 'undefined') {
  window.SmartDuplicateDetector = class SmartDuplicateDetector {

    constructor(options = {}) {
      this.strategy = options.strategy || 'latest';
      this.similarityThreshold = options.similarityThreshold || 0.85;
      this.hashCache = new Map();
      this.duplicateGroups = [];
      this.stats = {
        totalFiles: 0,
        uniqueFiles: 0,
        duplicateFiles: 0,
        similarFiles: 0,
        exactDuplicates: 0,
        nearDuplicates: 0
      };
    }

    detectDuplicates(files) {
      this.stats = {
        totalFiles: files.length,
        uniqueFiles: 0,
        duplicateFiles: 0,
        similarFiles: 0,
        exactDuplicates: 0,
        nearDuplicates: 0
      };

      this.duplicateGroups = [];
      this.hashCache.clear();

      const fileMap = new Map();
      const hashToFiles = new Map();

      for (const file of files) {
        const content = file.content || file.code || '';
        const path = file.path || file.fileName || '';
        const hash = this._contentHash(content);

        const fileInfo = {
          ...file,
          content,
          path,
          hash,
          size: content.length,
          lines: content.split('\n').length,
          previouslyExtracted: this.globalHashes && this.globalHashes.has(hash)
        };

        if (!hashToFiles.has(hash)) {
          hashToFiles.set(hash, []);
        }
        hashToFiles.get(hash).push(fileInfo);

        const pathKey = path.toLowerCase();
        if (!fileMap.has(pathKey)) {
          fileMap.set(pathKey, []);
        }
        fileMap.get(pathKey).push(fileInfo);
      }

      const exactDuplicates = [];
      for (const [hash, files] of hashToFiles) {
        if (files.length > 1) {
          exactDuplicates.push({
            type: 'exact',
            hash,
            files,
            count: files.length
          });
          this.stats.exactDuplicates += files.length - 1;
          this.stats.duplicateFiles += files.length - 1;
        }
      }

      const pathDuplicates = [];
      for (const [path, files] of fileMap) {
        if (files.length > 1) {
          const hashes = new Set(files.map(f => f.hash));
          if (hashes.size > 1) {
            pathDuplicates.push({
              type: 'path_conflict',
              path,
              files,
              count: files.length,
              uniqueHashes: hashes.size
            });
            this.stats.duplicateFiles += files.length - 1;
          }
        }
      }

      const similarFiles = this._findSimilarFiles(files);
      this.stats.similarFiles = similarFiles.length;
      this.stats.nearDuplicates = similarFiles.reduce((sum, g) => sum + g.files.length - 1, 0);

      this.duplicateGroups = [...exactDuplicates, ...pathDuplicates, ...similarFiles];

      const uniqueFiles = this._resolveDuplicates(files, this.duplicateGroups);
      this.stats.uniqueFiles = uniqueFiles.length;

      return {
        uniqueFiles,
        duplicates: this.duplicateGroups,
        similarFiles,
        stats: this.stats,
        recommendations: this._generateRecommendations()
      };
    }

    _findSimilarFiles(files) {
      const similarGroups = [];
      const processed = new Set();

      for (let i = 0; i < files.length; i++) {
        if (processed.has(i)) continue;

        const group = [i];
        for (let j = i + 1; j < files.length; j++) {
          if (processed.has(j)) continue;

          const similarity = this._calculateSimilarity(files[i], files[j]);
          if (similarity >= this.similarityThreshold && similarity < 1.0) {
            group.push(j);
            processed.add(j);
          }
        }

        if (group.length > 1) {
          processed.add(i);
          similarGroups.push({
            type: 'similar',
            similarity: this._calculateSimilarity(files[group[0]], files[group[1]]),
            files: group.map(idx => ({
              ...files[idx],
              index: idx
            })),
            count: group.length
          });
        }
      }

      return similarGroups;
    }

    _resolveDuplicates(files, duplicateGroups) {
      const toRemove = new Set();

      for (const group of duplicateGroups) {
        if (group.type === 'exact') {
          const indices = this._getFileIndices(files, group.files);
          const keepIndex = this._selectFileToKeep(group.files);
          for (let i = 0; i < indices.length; i++) {
            if (i !== keepIndex) {
              toRemove.add(indices[i]);
            }
          }
        } else if (group.type === 'path_conflict') {
          const indices = this._getFileIndices(files, group.files);
          const keepIndex = this._selectFileToKeep(group.files);
          for (let i = 0; i < indices.length; i++) {
            if (i !== keepIndex) {
              toRemove.add(indices[i]);
            }
          }
        } else if (group.type === 'similar') {
          const indices = this._getFileIndices(files, group.files);
          const keepIndex = this._selectFileToKeep(group.files);
          for (let i = 0; i < indices.length; i++) {
            if (i !== keepIndex) {
              toRemove.add(indices[i]);
            }
          }
        }
      }

      return files.filter((_, index) => !toRemove.has(index));
    }

    _selectFileToKeep(files) {
      switch (this.strategy) {
        case 'latest': {
          let maxTimestamp = -1;
          let maxIndex = 0;
          files.forEach((f, i) => {
            const ts = f.timestamp || f.createdAt || 0;
            if (ts > maxTimestamp) {
              maxTimestamp = ts;
              maxIndex = i;
            }
          });
          return maxIndex;
        }

        case 'largest': {
          let maxSize = -1;
          let maxIndex = 0;
          files.forEach((f, i) => {
            const size = f.size || (f.content || '').length;
            if (size > maxSize) {
              maxSize = size;
              maxIndex = i;
            }
          });
          return maxIndex;
        }

        case 'first':
          return 0;

        case 'merge':
          return 0;

        default:
          return 0;
      }
    }

    _calculateSimilarity(file1, file2) {
      const content1 = file1.content || file1.code || '';
      const content2 = file2.content || file2.code || '';

      if (content1 === content2) return 1.0;
      if (!content1 || !content2) return 0;

      const hash1 = this._contentHash(content1);
      const hash2 = this._contentHash(content2);
      if (hash1 === hash2) return 1.0;

      const lines1 = content1.split('\n');
      const lines2 = content2.split('\n');

      if (Math.abs(lines1.length - lines2.length) > Math.max(lines1.length, lines2.length) * 0.5) {
        return 0;
      }

      const set1 = new Set(lines1.map(l => l.trim()));
      const set2 = new Set(lines2.map(l => l.trim()));

      let intersection = 0;
      for (const line of set1) {
        if (set2.has(line)) intersection++;
      }

      const union = new Set([...set1, ...set2]).size;
      return intersection / union;
    }

    _contentHash(content) {
      if (this.hashCache.has(content)) {
        return this.hashCache.get(content);
      }

      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }

      const hashStr = Math.abs(hash).toString(36);
      this.hashCache.set(content, hashStr);
      return hashStr;
    }

    _getFileIndices(allFiles, groupFiles) {
      const indices = [];
      for (const gf of groupFiles) {
        const hash = gf.hash || this._contentHash(gf.content || gf.code || '');
        for (let i = 0; i < allFiles.length; i++) {
          const af = allFiles[i];
          const afHash = this._contentHash(af.content || af.code || '');
          if (afHash === hash && af.path === gf.path) {
            indices.push(i);
            break;
          }
        }
      }
      return indices;
    }

    _generateRecommendations() {
      const recommendations = [];

      if (this.stats.exactDuplicates > 0) {
        recommendations.push({
          type: 'exact_duplicates',
          message: `Found ${this.stats.exactDuplicates} exact duplicate files. Consider removing them to reduce project size.`,
          action: 'remove_duplicates'
        });
      }

      if (this.stats.nearDuplicates > 0) {
        recommendations.push({
          type: 'near_duplicates',
          message: `Found ${this.stats.nearDuplicates} near-duplicate files (similar content). Review them to ensure they serve different purposes.`,
          action: 'review_similar'
        });
      }

      if (this.stats.similarFiles > 0) {
        recommendations.push({
          type: 'similar_files',
          message: `${this.stats.similarFiles} groups of similar files detected. Consider consolidating or renaming them.`,
          action: 'consolidate'
        });
      }

      return recommendations;
    }

    getDuplicateReport() {
      return {
        stats: this.stats,
        groups: this.duplicateGroups.map(g => ({
          type: g.type,
          count: g.count,
          files: g.files.map(f => ({
            path: f.path,
            size: f.size,
            lines: f.lines,
            language: f.language
          })),
          ...(g.similarity !== undefined ? { similarity: g.similarity } : {}),
          ...(g.hash ? { hash: g.hash } : {})
        })),
        recommendations: this._generateRecommendations()
      };
    }

    setStrategy(strategy) {
      this.strategy = strategy;
    }

    setSimilarityThreshold(threshold) {
      this.similarityThreshold = Math.max(0, Math.min(1, threshold));
    }

    reset() {
      this.hashCache.clear();
      this.duplicateGroups = [];
      this.stats = {
        totalFiles: 0,
        uniqueFiles: 0,
        duplicateFiles: 0,
        similarFiles: 0,
        exactDuplicates: 0,
        nearDuplicates: 0
      };
    }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SmartDuplicateDetector: window.SmartDuplicateDetector };
}
