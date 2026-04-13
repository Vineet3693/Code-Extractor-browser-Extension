if (typeof window.UniversalSearch === 'undefined') {
  class UniversalSearch {
    constructor(dbHelper) {
      this.db = dbHelper;
      this.index = new Map();
      this.isIndexed = false;
      this.searchCache = new Map();
      this.cacheMaxSize = 100;
      this.cacheTTL = 30000;
    }

    async buildIndex() {
      this.index.clear();
      this.searchCache.clear();

      try {
        const projects = await this.db.getAll('projects');
        const files = await this.db.getAll('files');

        for (const project of projects) {
          this.index.set(`project_${project.id}`, {
            type: 'project',
            id: project.id,
            name: project.name,
            sourceURL: project.sourceURL,
            sourceSite: project.sourceSite,
            pageTitle: project.pageTitle,
            languages: project.languages || [],
            tags: project.tags || [],
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            totalFiles: project.totalFiles,
            totalLines: project.totalLines,
            totalSize: project.totalSize,
            isFavorite: project.isFavorite,
            searchableText: this._buildProjectSearchText(project)
          });
        }

        for (const file of files) {
          this.index.set(`file_${file.id}`, {
            type: 'file',
            id: file.id,
            projectId: file.projectId,
            name: file.name,
            path: file.path,
            directory: file.directory,
            language: file.language,
            content: file.content,
            lineCount: file.lineCount,
            size: file.size,
            createdAt: file.createdAt,
            searchableText: this._buildFileSearchText(file)
          });
        }

        this.isIndexed = true;
        return this.index.size;
      } catch (error) {
        console.error('[UniversalSearch] Build index failed:', error);
        throw error;
      }
    }

    async search(query, options = {}) {
      const {
        type = 'all',
        limit = 50,
        offset = 0,
        sortBy = 'relevance',
        language = null,
        dateFrom = null,
        dateTo = null,
        isFavorite = null
      } = options;

      const cacheKey = `${query}_${JSON.stringify(options)}`;
      const cached = this._getFromCache(cacheKey);
      if (cached) return cached;

      if (!this.isIndexed) {
        await this.buildIndex();
      }

      const normalizedQuery = query.toLowerCase().trim();
      const tokens = this._tokenize(query);

      let results = [];

      for (const [key, item] of this.index) {
        if (type !== 'all' && item.type !== type) continue;

        if (language && item.language !== language) continue;
        if (isFavorite !== null && item.isFavorite !== isFavorite) continue;
        if (dateFrom && item.createdAt < dateFrom) continue;
        if (dateTo && item.createdAt > dateTo) continue;

        const score = this._calculateRelevance(item, normalizedQuery, tokens);
        if (score > 0) {
          results.push({ ...item, score, key });
        }
      }

      results = this._sortResults(results, sortBy);
      results = results.slice(offset, offset + limit);

      const totalMatches = results.length;
      this._addToCache(cacheKey, { results, totalMatches, query, timestamp: Date.now() });

      return {
        results,
        totalMatches,
        query,
        took: Date.now() - (cached?.timestamp || Date.now()),
        suggestions: this._generateSuggestions(query, tokens)
      };
    }

    async searchFiles(query, projectId = null) {
      if (!this.isIndexed) {
        await this.buildIndex();
      }

      const normalizedQuery = query.toLowerCase().trim();
      const results = [];

      for (const [key, item] of this.index) {
        if (item.type !== 'file') continue;
        if (projectId && item.projectId !== projectId) continue;

        const score = this._calculateFileRelevance(item, normalizedQuery);
        if (score > 0) {
          results.push({ ...item, score, key });
        }
      }

      results.sort((a, b) => b.score - a.score);

      for (const result of results) {
        if (result.content) {
          result.snippet = this._extractSnippet(result.content, normalizedQuery);
        }
      }

      return results;
    }

    async searchProjects(query) {
      return this.search(query, { type: 'project' });
    }

    async searchByLanguage(language) {
      if (!this.isIndexed) {
        await this.buildIndex();
      }

      const results = [];
      for (const [key, item] of this.index) {
        if (item.type === 'file' && item.language === language.toLowerCase()) {
          results.push({ ...item, key });
        }
      }

      return results;
    }

    async searchByTag(tag) {
      if (!this.isIndexed) {
        await this.buildIndex();
      }

      const results = [];
      for (const [key, item] of this.index) {
        if (item.type === 'project' && item.tags?.includes(tag.toLowerCase())) {
          results.push({ ...item, key });
        }
      }

      return results;
    }

    async getRecentSearches(limit = 10) {
      try {
        const metadata = await this.db.get('metadata', 'recentSearches');
        const searches = metadata?.value || [];
        return searches.slice(0, limit);
      } catch (error) {
        return [];
      }
    }

    async saveSearch(query, resultCount) {
      try {
        const metadata = await this.db.get('metadata', 'recentSearches');
        const searches = metadata?.value || [];

        searches.unshift({
          query,
          resultCount,
          timestamp: Date.now()
        });

        if (searches.length > 50) {
          searches.length = 50;
        }

        await this.db.update('metadata', { key: 'recentSearches', value: searches });
      } catch (error) {
        console.error('[UniversalSearch] Save search failed:', error);
      }
    }

    async getPopularLanguages() {
      if (!this.isIndexed) {
        await this.buildIndex();
      }

      const langCount = {};
      for (const [key, item] of this.index) {
        if (item.type === 'file' && item.language) {
          langCount[item.language] = (langCount[item.language] || 0) + 1;
        }
      }

      return Object.entries(langCount)
        .sort((a, b) => b[1] - a[1])
        .map(([lang, count]) => ({ language: lang, count }));
    }

    async getSearchStats() {
      if (!this.isIndexed) {
        await this.buildIndex();
      }

      let projectCount = 0;
      let fileCount = 0;
      let totalSize = 0;
      const languages = new Set();

      for (const [key, item] of this.index) {
        if (item.type === 'project') projectCount++;
        if (item.type === 'file') {
          fileCount++;
          totalSize += item.size || 0;
          if (item.language) languages.add(item.language);
        }
      }

      return {
        totalIndexed: this.index.size,
        projectCount,
        fileCount,
        totalSize,
        uniqueLanguages: languages.size,
        languages: Array.from(languages),
        isIndexed: this.isIndexed
      };
    }

    invalidateCache() {
      this.searchCache.clear();
    }

    async reindex() {
      this.isIndexed = false;
      return this.buildIndex();
    }

    _calculateRelevance(item, normalizedQuery, tokens) {
      let score = 0;

      if (item.name?.toLowerCase().includes(normalizedQuery)) score += 100;
      if (item.name?.toLowerCase() === normalizedQuery) score += 200;
      if (item.path?.toLowerCase().includes(normalizedQuery)) score += 50;
      if (item.sourceURL?.toLowerCase().includes(normalizedQuery)) score += 30;
      if (item.pageTitle?.toLowerCase().includes(normalizedQuery)) score += 40;
      if (item.sourceSite?.toLowerCase().includes(normalizedQuery)) score += 25;

      for (const tag of (item.tags || [])) {
        if (tag.toLowerCase().includes(normalizedQuery)) score += 60;
      }

      for (const lang of (item.languages || [])) {
        if (lang.toLowerCase().includes(normalizedQuery)) score += 40;
      }

      if (item.searchableText) {
        for (const token of tokens) {
          if (item.searchableText.includes(token)) score += 5;
        }
      }

      if (item.content) {
        const contentLower = item.content.toLowerCase();
        if (contentLower.includes(normalizedQuery)) score += 20;
        for (const token of tokens) {
          const regex = new RegExp(token, 'gi');
          const matches = contentLower.match(regex);
          if (matches) score += Math.min(matches.length * 2, 30);
        }
      }

      if (item.isFavorite) score += 10;

      const ageInDays = (Date.now() - (item.createdAt || 0)) / (1000 * 60 * 60 * 24);
      const recencyBonus = Math.max(0, 10 - ageInDays / 30);
      score += recencyBonus;

      return score;
    }

    _calculateFileRelevance(item, normalizedQuery) {
      let score = 0;

      if (item.name?.toLowerCase().includes(normalizedQuery)) score += 100;
      if (item.name?.toLowerCase() === normalizedQuery) score += 200;
      if (item.path?.toLowerCase().includes(normalizedQuery)) score += 70;
      if (item.directory?.toLowerCase().includes(normalizedQuery)) score += 40;
      if (item.language?.toLowerCase().includes(normalizedQuery)) score += 50;

      if (item.content) {
        const contentLower = item.content.toLowerCase();
        if (contentLower.includes(normalizedQuery)) {
          const index = contentLower.indexOf(normalizedQuery);
          score += 30;
          if (index < 100) score += 20;
        }
      }

      return score;
    }

    _extractSnippet(content, query, maxLength = 200) {
      const lowerContent = content.toLowerCase();
      const index = lowerContent.indexOf(query);

      if (index === -1) {
        return content.substring(0, maxLength);
      }

      const start = Math.max(0, index - 50);
      const end = Math.min(content.length, index + query.length + (maxLength - 50));
      let snippet = content.substring(start, end);

      if (start > 0) snippet = '...' + snippet;
      if (end < content.length) snippet += '...';

      return snippet;
    }

    _sortResults(results, sortBy) {
      switch (sortBy) {
        case 'relevance':
          return results.sort((a, b) => b.score - a.score);
        case 'name':
          return results.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        case 'date':
          return results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        case 'size':
          return results.sort((a, b) => (b.size || 0) - (a.size || 0));
        default:
          return results;
      }
    }

    _generateSuggestions(query, tokens) {
      const suggestions = [];
      const lowerQuery = query.toLowerCase();

      for (const [key, item] of this.index) {
        if (item.name?.toLowerCase().startsWith(lowerQuery) && suggestions.length < 5) {
          suggestions.push({
            type: item.type,
            text: item.name,
            description: item.type === 'project' ? 'Project' : item.language || 'File'
          });
        }
      }

      return suggestions.slice(0, 5);
    }

    _tokenize(query) {
      return query
        .toLowerCase()
        .split(/[\s_-]+/)
        .filter(t => t.length > 1);
    }

    _buildProjectSearchText(project) {
      const parts = [
        project.name,
        project.sourceURL,
        project.pageTitle,
        project.sourceSite,
        ...(project.languages || []),
        ...(project.tags || [])
      ];
      return parts.filter(Boolean).join(' ').toLowerCase();
    }

    _buildFileSearchText(file) {
      return `${file.name} ${file.path} ${file.directory} ${file.language} ${file.content || ''}`.toLowerCase();
    }

    _getFromCache(key) {
      const cached = this.searchCache.get(key);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
        return cached;
      }
      this.searchCache.delete(key);
      return null;
    }

    _addToCache(key, data) {
      if (this.searchCache.size >= this.cacheMaxSize) {
        const oldestKey = this.searchCache.keys().next().value;
        this.searchCache.delete(oldestKey);
      }
      this.searchCache.set(key, data);
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UniversalSearch };
  }
  window.UniversalSearch = UniversalSearch;
}
