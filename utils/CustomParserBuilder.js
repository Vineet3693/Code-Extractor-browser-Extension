if (typeof window.CustomParserBuilder === 'undefined') {
  class CustomParserBuilder {
    constructor(options = {}) {
      this.dbHelper = options.dbHelper;
      this.parsers = new Map();
      this._loadSavedParsers();
    }

    async _loadSavedParsers() {
      if (!this.dbHelper) return;
      try {
        const saved = await this.dbHelper.getAll('custom_parsers');
        if (saved) {
          saved.forEach(p => this.parsers.set(p.id, p));
        }
      } catch (e) {
        console.error('[CustomParserBuilder] Failed to load parsers:', e);
      }
    }

    getAllParsers() {
      return Array.from(this.parsers.values());
    }

    getParser(id) {
      return this.parsers.get(id);
    }

    async createParser(config) {
      const parser = {
        id: this._generateId(),
        name: config.name || 'New Parser',
        domain: config.domain || '',
        selectors: config.selectors || {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...config
      };

      this.parsers.set(parser.id, parser);
      if (this.dbHelper) {
        await this.dbHelper.add('custom_parsers', parser);
      }
      return { success: true, parser };
    }

    async saveParser(parser) {
      parser.updatedAt = Date.now();
      this.parsers.set(parser.id, parser);
      if (this.dbHelper) {
        await this.dbHelper.update('custom_parsers', parser);
      }
      return { success: true, parser };
    }

    async deleteParser(id) {
      this.parsers.delete(id);
      if (this.dbHelper) {
        await this.dbHelper.delete('custom_parsers', id);
      }
      return { success: true };
    }

    _generateId() {
      return 'parser_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    _extractPreview(parent) {
      if (!parent) return '';
      return parent.textContent.substring(0, 500);
    }

    _evaluateXPath(document, xpath) {
      try {
        const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        const elements = [];
        for (let i = 0; i < result.snapshotLength; i++) {
          elements.push(result.snapshotItem(i));
        }
        return elements;
      } catch (e) {
        console.warn('[CustomParserBuilder] XPath evaluation failed:', e);
        return [];
      }
    }

    exportParser(parserId) {
      const parser = this.parsers.get(parserId);
      if (!parser) return { success: false, error: 'Parser not found' };

      const exportData = {
        format: 'code-extractor-parser',
        version: '1.0.0',
        parser: { ...parser }
      };

      return {
        success: true,
        data: JSON.stringify(exportData, null, 2),
        fileName: `${parser.name.replace(/\s+/g, '-').toLowerCase()}-parser.json`
      };
    }

    importParser(jsonString) {
      try {
        const data = JSON.parse(jsonString);
        if (data.format !== 'code-extractor-parser') {
          return { success: false, error: 'Invalid parser format' };
        }

        const parser = data.parser;
        parser.id = this._generateId();
        parser.createdAt = Date.now();
        parser.updatedAt = Date.now();

        this.parsers.set(parser.id, parser);
        return { success: true, parser };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    validateParserConfig(config) {
      const errors = [];
      if (!config.name) errors.push('Parser name is required');
      if (!config.domain) errors.push('Domain is required');
      if (!config.selectors || Object.keys(config.selectors).length === 0) {
        errors.push('At least one selector is required');
      }
      return { valid: errors.length === 0, errors };
    }
  }

  window.CustomParserBuilder = CustomParserBuilder;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CustomParserBuilder };
  }
}
