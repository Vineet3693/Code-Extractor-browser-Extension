if (typeof window.CodeValidator === 'undefined') {
  class CodeValidator {
    constructor() {
      this.validators = new Map();
      this._registerDefaultValidators();
    }

    _registerDefaultValidators() {
      this.validators.set('javascript', this._validateJavaScript.bind(this));
      this.validators.set('typescript', this._validateTypeScript.bind(this));
      this.validators.set('python', this._validatePython.bind(this));
      this.validators.set('html', this._validateHTML.bind(this));
      this.validators.set('css', this._validateCSS.bind(this));
      this.validators.set('json', this._validateJSON.bind(this));
      this.validators.set('yaml', this._validateYAML.bind(this));
      this.validators.set('markdown', this._validateMarkdown.bind(this));
      this.validators.set('sql', this._validateSQL.bind(this));
      this.validators.set('bash', this._validateBash.bind(this));
    }

    async validate(file) {
      const language = (file.language || 'text').toLowerCase();
      const content = file.content || '';
      const fileName = file.path || file.fileName || 'unknown';

      const validator = this.validators.get(language);
      if (!validator) {
        return {
          valid: true,
          language,
          fileName,
          warnings: [{ type: 'info', message: `No validator available for ${language}` }],
          errors: []
        };
      }

      try {
        const result = await validator(content, fileName);
        result.language = language;
        result.fileName = fileName;
        return result;
      } catch (error) {
        return {
          valid: false,
          language,
          fileName,
          errors: [{ type: 'error', message: `Validation failed: ${error.message}`, line: null }],
          warnings: []
        };
      }
    }

    async validateAll(files) {
      const results = [];
      for (const file of files) {
        try {
          const result = await this.validate(file);
          results.push(result);
        } catch (e) {
          results.push({
            valid: false,
            language: file.language || 'text',
            fileName: file.path || file.fileName,
            errors: [{ type: 'error', message: e.message }],
            warnings: []
          });
        }
      }
      return results;
    }

    _validateJavaScript(content, fileName) {
      const errors = [];
      const warnings = [];

      try {
        new Function(content);
      } catch (e) {
        const lineMatch = e.message.match(/:(\d+)/);
        errors.push({
          type: 'error',
          message: `Syntax error: ${e.message}`,
          line: lineMatch ? parseInt(lineMatch[1]) : null
        });
      }

      const lines = content.split('\n');
      lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimmed = line.trim();

        if (trimmed === 'var ') {
          warnings.push({ type: 'warning', message: 'Use let or const instead of var', line: lineNum });
        }

        if (trimmed.includes('==') && !trimmed.includes('===') && !trimmed.includes('!==')) {
          warnings.push({ type: 'warning', message: 'Consider using === instead of ==', line: lineNum });
        }

        if (trimmed.includes('console.log')) {
          warnings.push({ type: 'info', message: 'console.log statement found', line: lineNum });
        }

        if (line.length > 120) {
          warnings.push({ type: 'warning', message: `Line too long (${line.length} chars, max 120)`, line: lineNum });
        }
      });

      const openBraces = (content.match(/{/g) || []).length;
      const closeBraces = (content.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        errors.push({
          type: 'error',
          message: `Mismatched braces: ${openBraces} opening, ${closeBraces} closing`,
          line: null
        });
      }

      const openParens = (content.match(/\(/g) || []).length;
      const closeParens = (content.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        errors.push({
          type: 'error',
          message: `Mismatched parentheses: ${openParens} opening, ${closeParens} closing`,
          line: null
        });
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        stats: {
          totalLines: lines.length,
          blankLines: lines.filter(l => l.trim() === '').length,
          commentLines: lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('/*')).length
        }
      };
    }

    _validateTypeScript(content, fileName) {
      return this._validateJavaScript(content, fileName);
    }

    _validatePython(content, fileName) {
      const errors = [];
      const warnings = [];
      const lines = content.split('\n');

      let indentStack = [0];
      lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimmed = line.trim();

        if (trimmed === '' || trimmed.startsWith('#')) return;

        const indent = line.length - line.trimStart().length;

        if (indent % 4 !== 0 && indent > 0) {
          warnings.push({ type: 'warning', message: 'Indentation should be multiples of 4 spaces', line: lineNum });
        }

        if (trimmed.endsWith(':')) {
          indentStack.push(indent + 4);
        } else if (indent < indentStack[indentStack.length - 1]) {
          indentStack.pop();
        }

        if (trimmed.includes('print(')) {
          warnings.push({ type: 'info', message: 'print() statement found', line: lineNum });
        }

        if (line.length > 120) {
          warnings.push({ type: 'warning', message: `Line too long (${line.length} chars, max 120)`, line: lineNum });
        }
      });

      const hasMain = content.includes('if __name__') || content.includes('def main');
      if (!hasMain && lines.length > 10) {
        warnings.push({ type: 'info', message: 'No main block detected' });
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        stats: {
          totalLines: lines.length,
          blankLines: lines.filter(l => l.trim() === '').length,
          commentLines: lines.filter(l => l.trim().startsWith('#')).length
        }
      };
    }

    _validateHTML(content, fileName) {
      const errors = [];
      const warnings = [];

      const tagStack = [];
      const selfClosingTags = ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'];
      const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*\/?>/g;
      let match;

      while ((match = tagRegex.exec(content)) !== null) {
        const fullTag = match[0];
        const tagName = match[1].toLowerCase();
        const isClosing = fullTag.startsWith('</');
        const isSelfClosing = fullTag.endsWith('/>');

        if (selfClosingTags.includes(tagName)) continue;

        if (isClosing) {
          if (tagStack.length === 0) {
            errors.push({ type: 'error', message: `Unexpected closing tag </${tagName}>` });
          } else if (tagStack[tagStack.length - 1] !== tagName) {
            errors.push({ type: 'error', message: `Mismatched tag: expected </${tagStack[tagStack.length - 1]}>, got </${tagName}>` });
          } else {
            tagStack.pop();
          }
        } else if (!isSelfClosing) {
          tagStack.push(tagName);
        }
      }

      for (const tag of tagStack) {
        errors.push({ type: 'error', message: `Unclosed tag: <${tag}>` });
      }

      if (!content.includes('<!DOCTYPE') && content.includes('<html')) {
        warnings.push({ type: 'warning', message: 'Missing DOCTYPE declaration' });
      }

      if (!content.includes('<title>') && content.includes('<head>')) {
        warnings.push({ type: 'warning', message: 'Missing <title> tag in <head>' });
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        stats: {
          totalTags: (content.match(/<[^>]+>/g) || []).length,
          selfClosingTags: (content.match(/<[^>]+\/>/g) || []).length
        }
      };
    }

    _validateCSS(content, fileName) {
      const errors = [];
      const warnings = [];
      const lines = content.split('\n');

      const openBraces = (content.match(/{/g) || []).length;
      const closeBraces = (content.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        errors.push({
          type: 'error',
          message: `Mismatched braces: ${openBraces} opening, ${closeBraces} closing`,
          line: null
        });
      }

      lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimmed = line.trim();

        if (trimmed === '' || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/')) return;

        if (trimmed.includes('{') && !trimmed.includes(':') && !trimmed.includes('}')) {
          // Likely a rule start, check if it has a closing brace eventually
        }

        if (trimmed.includes('!important')) {
          warnings.push({ type: 'warning', message: 'Avoid using !important', line: lineNum });
        }

        if (line.length > 120) {
          warnings.push({ type: 'warning', message: `Line too long (${line.length} chars, max 120)`, line: lineNum });
        }
      });

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        stats: {
          totalLines: lines.length,
          rules: (content.match(/{/g) || []).length
        }
      };
    }

    _validateJSON(content, fileName) {
      const errors = [];
      const warnings = [];

      try {
        JSON.parse(content);
      } catch (e) {
        const lineMatch = e.message.match(/position\s+(\d+)/i);
        let line = null;
        if (lineMatch) {
          const position = parseInt(lineMatch[1]);
          const textBefore = content.substring(0, position);
          line = (textBefore.match(/\n/g) || []).length + 1;
        }
        errors.push({
          type: 'error',
          message: `Invalid JSON: ${e.message}`,
          line
        });
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        stats: {}
      };
    }

    _validateYAML(content, fileName) {
      const errors = [];
      const warnings = [];
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimmed = line.trim();

        if (trimmed === '' || trimmed.startsWith('#')) return;

        if (line.startsWith(' ') && line.indexOf(line.trim()) % 2 !== 0) {
          warnings.push({ type: 'warning', message: 'YAML indentation should be even spaces', line: lineNum });
        }

        if (line.includes('\t')) {
          errors.push({ type: 'error', message: 'YAML does not allow tabs, use spaces', line: lineNum });
        }
      });

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        stats: {
          totalLines: lines.length
        }
      };
    }

    _validateMarkdown(content, fileName) {
      const errors = [];
      const warnings = [];
      const lines = content.split('\n');

      let inCodeBlock = false;
      lines.forEach((line, index) => {
        const lineNum = index + 1;

        if (line.trim().startsWith('```')) {
          inCodeBlock = !inCodeBlock;
        }

        if (!inCodeBlock) {
          if (line.startsWith('#') && !line.startsWith('# ')) {
            warnings.push({ type: 'warning', message: 'Add space after # in heading', line: lineNum });
          }

          if (line.includes('http') && !line.includes('[') && !line.includes('<')) {
            warnings.push({ type: 'info', message: 'Consider using markdown links for URLs', line: lineNum });
          }
        }
      });

      if (inCodeBlock) {
        warnings.push({ type: 'warning', message: 'Unclosed code block' });
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        stats: {
          totalLines: lines.length,
          headings: lines.filter(l => l.startsWith('#')).length,
          codeBlocks: (content.match(/```/g) || []).length / 2
        }
      };
    }

    _validateSQL(content, fileName) {
      const errors = [];
      const warnings = [];
      const lines = content.split('\n');
      const upperContent = content.toUpperCase();

      const keywords = ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'JOIN'];
      const foundKeywords = keywords.filter(kw => upperContent.includes(kw));

      if (foundKeywords.length === 0 && lines.length > 3) {
        warnings.push({ type: 'info', message: 'No SQL keywords detected' });
      }

      lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimmed = line.trim().toUpperCase();

        if (trimmed.startsWith('SELECT') && !trimmed.includes('FROM')) {
          warnings.push({ type: 'warning', message: 'SELECT without FROM clause', line: lineNum });
        }

        if (trimmed.includes('*') && trimmed.startsWith('SELECT')) {
          warnings.push({ type: 'warning', message: 'SELECT * is not recommended, specify columns', line: lineNum });
        }
      });

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        stats: {
          totalLines: lines.length,
          keywords: foundKeywords
        }
      };
    }

    _validateBash(content, fileName) {
      const errors = [];
      const warnings = [];
      const lines = content.split('\n');

      if (lines.length > 0 && !lines[0].trim().startsWith('#!')) {
        warnings.push({ type: 'info', message: 'Missing shebang line (#!/bin/bash)' });
      }

      const openQuotes = (content.match(/"/g) || []).length;
      const closeQuotes = (content.match(/"/g) || []).length;
      if (openQuotes % 2 !== 0) {
        errors.push({ type: 'error', message: 'Unclosed double quote' });
      }

      const openSingles = (content.match(/'/g) || []).length;
      if (openSingles % 2 !== 0) {
        errors.push({ type: 'error', message: 'Unclosed single quote' });
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        stats: {
          totalLines: lines.length
        }
      };
    }

    getSupportedLanguages() {
      return Array.from(this.validators.keys());
    }

    registerValidator(language, validatorFn) {
      this.validators.set(language.toLowerCase(), validatorFn);
    }

    getValidationSummary(results) {
      const total = results.length;
      const valid = results.filter(r => r.valid).length;
      const invalid = total - valid;
      const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
      const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

      return {
        total,
        valid,
        invalid,
        totalErrors,
        totalWarnings,
        passRate: total > 0 ? ((valid / total) * 100).toFixed(1) + '%' : '0%'
      };
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CodeValidator };
  }
  window.CodeValidator = CodeValidator;
}
