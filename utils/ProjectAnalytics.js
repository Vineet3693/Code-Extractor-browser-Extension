if (typeof window.ProjectAnalytics === 'undefined') {
  class ProjectAnalytics {
    constructor(options = {}) {
      this.dbHelper = options.dbHelper;
      this._cache = new Map();
      this._cacheTTL = 300000; // 5 minutes
    }

    async getProjectStats(projectId) {
      const cacheKey = `stats_${projectId}`;
      const cached = this._getCache(cacheKey);
      if (cached) return { success: true, stats: cached };

      if (!this.dbHelper) return { success: false, error: 'DB not initialized' };
      const project = await this.dbHelper.get('projects', projectId);
      if (!project) return { success: false, error: 'Project not found' };

      const stats = {
        totalFiles: project.files?.length || 0,
        totalLines: 0,
        totalSize: 0,
        languageBreakdown: {},
        fileTypes: {},
        codeMetrics: { functions: 0, classes: 0, imports: 0, commentLines: 0, blankLines: 0 }
      };

      let totalCommentLines = 0;
      let totalBlankLines = 0;

      for (const file of (project.files || [])) {
        const content = file.content || '';
        const lines = content.split('\n');
        stats.totalLines += lines.length;
        stats.totalSize += new Blob([content]).size;

        const lang = (file.language || 'text').toLowerCase();
        if (!stats.languageBreakdown[lang]) stats.languageBreakdown[lang] = { files: 0, lines: 0 };
        stats.languageBreakdown[lang].files++;
        stats.languageBreakdown[lang].lines += lines.length;

        const ext = this._getFileExtension(file.path || file.fileName || '');
        stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;

        const metrics = this._analyzeFileMetrics(content, lang);
        stats.codeMetrics.functions += metrics.functions;
        stats.codeMetrics.classes += metrics.classes;
        stats.codeMetrics.imports += metrics.imports;
        totalCommentLines += metrics.commentLines;
        totalBlankLines += metrics.blankLines;
      }

      if (stats.totalLines > 0) {
        stats.codeMetrics.commentRatio = Math.round((totalCommentLines / stats.totalLines) * 100);
        stats.codeMetrics.blankLineRatio = Math.round((totalBlankLines / stats.totalLines) * 100);
      }

      stats.languageBreakdown = this._sortObjectByValue(stats.languageBreakdown, 'lines');
      stats.fileTypes = this._sortObjectByValue(stats.fileTypes);

      this._setCache(cacheKey, stats);
      return { success: true, stats };
    }

    async getAllProjectsStats() {
      let projects = [];
      if (this.dbHelper) {
        projects = await this.dbHelper.getAll('projects');
      }

      const overview = {
        totalProjects: projects.length,
        totalFiles: 0,
        totalLines: 0,
        totalSize: 0,
        languageDistribution: {},
        projectSizes: [],
        averageFilesPerProject: 0,
        averageLinesPerProject: 0,
        topLanguages: [],
        generatedAt: Date.now()
      };

      for (const project of projects) {
        const files = project.files || [];
        overview.totalFiles += files.length;

        for (const file of files) {
          const content = file.content || '';
          const lines = content.split('\n').length;
          const size = new Blob([content]).size;

          overview.totalLines += lines;
          overview.totalSize += size;

          const lang = (file.language || 'text').toLowerCase();
          if (!overview.languageDistribution[lang]) {
            overview.languageDistribution[lang] = { files: 0, lines: 0, projects: new Set() };
          }
          overview.languageDistribution[lang].files++;
          overview.languageDistribution[lang].lines += lines;
          overview.languageDistribution[lang].projects.add(project.id);
        }

        overview.projectSizes.push({
          name: project.name,
          files: files.length,
          size: files.reduce((sum, f) => sum + new Blob([f.content || '']).size, 0)
        });
      }

      if (projects.length > 0) {
        overview.averageFilesPerProject = Math.round(overview.totalFiles / projects.length);
        overview.averageLinesPerProject = Math.round(overview.totalLines / projects.length);
      }

      for (const lang of Object.keys(overview.languageDistribution)) {
        overview.languageDistribution[lang].projects = overview.languageDistribution[lang].projects.size;
      }

      overview.languageDistribution = this._sortObjectByValue(overview.languageDistribution, 'lines');
      overview.topLanguages = Object.entries(overview.languageDistribution)
        .slice(0, 10)
        .map(([lang, data]) => ({ language: lang, ...data }));

      overview.projectSizes.sort((a, b) => b.size - a.size);

      return { success: true, overview };
    }

    async getScanHistory(days = 30) {
      let projects = [];
      if (this.dbHelper) {
        projects = await this.dbHelper.getAll('projects');
      }

      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
      const dailyStats = {};

      for (let i = 0; i < days; i++) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = date.toISOString().split('T')[0];
        dailyStats[key] = { scans: 0, files: 0, lines: 0 };
      }

      for (const project of projects) {
        const createdAt = new Date(project.createdAt || 0);
        if (createdAt.getTime() < cutoff) continue;

        const key = createdAt.toISOString().split('T')[0];
        if (!dailyStats[key]) continue;

        dailyStats[key].scans++;
        dailyStats[key].files += project.files?.length || 0;
        dailyStats[key].lines += (project.files || []).reduce((sum, f) => {
          return sum + (f.content || '').split('\n').length;
        }, 0);
      }

      const timeline = Object.entries(dailyStats)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, stats]) => ({ date, ...stats }));

      return { success: true, timeline, days };
    }

    async getLanguageTrend(days = 30) {
      let projects = [];
      if (this.dbHelper) {
        projects = await this.dbHelper.getAll('projects');
      }

      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
      const dailyLanguages = {};

      for (let i = 0; i < days; i++) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = date.toISOString().split('T')[0];
        dailyLanguages[key] = {};
      }

      for (const project of projects) {
        const createdAt = new Date(project.createdAt || 0);
        if (createdAt.getTime() < cutoff) continue;

        const key = createdAt.toISOString().split('T')[0];
        if (!dailyLanguages[key]) continue;

        for (const file of (project.files || [])) {
          const lang = (file.language || 'text').toLowerCase();
          if (!dailyLanguages[key][lang]) dailyLanguages[key][lang] = 0;
          dailyLanguages[key][lang]++;
        }
      }

      return { success: true, dailyLanguages, days };
    }

    async getProductivityScore() {
      const allStats = await this.getAllProjectsStats();
      if (!allStats.success) return { success: false, error: allStats.error };

      const { overview } = allStats;
      let score = 0;
      const breakdown = {};

      if (overview.totalProjects > 0) {
        const projectScore = Math.min(overview.totalProjects * 10, 30);
        score += projectScore;
        breakdown.projects = { score: projectScore, max: 30, value: overview.totalProjects };
      }

      if (overview.totalFiles > 0) {
        const fileScore = Math.min(overview.totalFiles * 2, 25);
        score += fileScore;
        breakdown.files = { score: fileScore, max: 25, value: overview.totalFiles };
      }

      if (overview.totalLines > 0) {
        const lineScore = Math.min(Math.log10(overview.totalLines) * 15, 25);
        score += lineScore;
        breakdown.lines = { score: Math.round(lineScore), max: 25, value: overview.totalLines };
      }

      if (overview.topLanguages.length > 0) {
        const langScore = Math.min(overview.topLanguages.length * 5, 20);
        score += langScore;
        breakdown.languages = { score: langScore, max: 20, value: overview.topLanguages.length };
      }

      return {
        success: true,
        score: Math.round(score),
        maxScore: 100,
        breakdown,
        generatedAt: Date.now()
      };
    }

    _analyzeFileMetrics(content, language) {
      const lines = content.split('\n');
      const metrics = { functions: 0, classes: 0, imports: 0, commentLines: 0, blankLines: 0 };

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
          metrics.blankLines++;
          continue;
        }

        if (this._isCommentLine(trimmed, language)) {
          metrics.commentLines++;
        }

        if (/^(?:function |const \w+\s*=\s*(?:async\s+)?function|def |func |fn )/.test(trimmed)) {
          metrics.functions++;
        }

        if (/^(?:class |interface |type \w+\s*=)/.test(trimmed)) {
          metrics.classes++;
        }

        if (/^(?:import |from .* import |require\(|#include )/.test(trimmed)) {
          metrics.imports++;
        }
      }

      return metrics;
    }

    _isCommentLine(line, language) {
      if (language === 'python' || language === 'bash' || language === 'ruby' || language === 'yaml') {
        return line.startsWith('#');
      }
      if (language === 'html' || language === 'xml') {
        return line.startsWith('<!--');
      }
      if (language === 'css' || language === 'scss') {
        return line.startsWith('/*') || line.startsWith('*') || line.startsWith('//');
      }
      if (language === 'sql') {
        return line.startsWith('--');
      }
      return line.startsWith('//') || line.startsWith('/*') || line.startsWith('*');
    }

    _getFileExtension(fileName) {
      if (!fileName) return 'no-extension';
      const parts = fileName.split('.');
      return parts.length > 1 ? '.' + parts[parts.length - 1].toLowerCase() : 'no-extension';
    }

    _sortObjectByValue(obj, valueKey = null) {
      const entries = Object.entries(obj);
      entries.sort((a, b) => {
        const valA = valueKey ? a[1][valueKey] : a[1];
        const valB = valueKey ? b[1][valueKey] : b[1];
        return typeof valA === 'number' ? valB - valA : 0;
      });
      return Object.fromEntries(entries);
    }

    _getCache(key) {
      const entry = this._cache.get(key);
      if (entry && Date.now() - entry.timestamp < this._cacheTTL) {
        return entry.data;
      }
      this._cache.delete(key);
      return null;
    }

    _setCache(key, data) {
      this._cache.set(key, { data, timestamp: Date.now() });
    }

    clearCache() {
      this._cache.clear();
    }
  }

  window.ProjectAnalytics = ProjectAnalytics;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { ProjectAnalytics };
  }
}
