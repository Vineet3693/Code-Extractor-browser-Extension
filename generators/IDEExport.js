if (typeof window.IDEExport === 'undefined') {
  window.IDEExport = class IDEExport {

    constructor() {
      this.supportedIDEs = {
        vscode: { name: 'VS Code', protocol: 'vscode://', icon: '💙', supported: true },
        cursor: { name: 'Cursor', protocol: 'cursor://', icon: '🔵', supported: true },
        jetbrains: { name: 'JetBrains', protocol: 'jetbrains://', icon: '🟠', supported: true },
        zed: { name: 'Zed', protocol: 'zed://', icon: '⚡', supported: true },
        antigravity: { name: 'Antigravity', protocol: 'antigravity://', icon: '🚀', supported: true },
        opencode: { name: 'OpenCode', protocol: 'opencode://', icon: '🟢', supported: true }
      };
    }

    /**
     * Export the full project as a proper ZIP with real files and IDE config folders.
     * @param {object} project  - { name, files: [{path, content, language}], sourceUrl }
     * @param {string} ide      - one of the supportedIDEs keys
     * @param {object} options  - { includePDF, includeDocs, includeMD, ... }
     * @returns {Promise<{success, fileName}>}
     */
    async exportProjectAsZip(project, ide = 'vscode', options = {}) {
      const files = project.files || [];
      const projectName = (project.name || 'extracted-project')
        .replace(/[^a-zA-Z0-9_\-]/g, '-').toLowerCase();

      if (typeof JSZip === 'undefined') {
        console.error('[IDEExport] JSZip not available');
        return { success: false, error: 'JSZip not loaded' };
      }

      const zip = new JSZip();
      const root = zip.folder(projectName);

      // ── 1. Write every actual source file ─────────────────────────────────
      for (const file of files) {
        const filePath = file.path || file.fileName || 'unknown.txt';
        const content = file.content || '';
        root.file(filePath, content);
      }

      // ── 2. Include extra formats if requested ─────────────────────────────
      if (options.includeMD) {
        root.file('PROJECT_COMPLETE.md', this._generateProjectMarkdown(project, files));
      }
      if (options.includeDocs) {
        root.file('PROJECT_COMPLETE.doc', this._generateProjectDocs(project, files));
      }
      // Note: PDF is hard to generate purely in JSZip without a library like jsPDF.
      // We will include the HTML version which can be printed to PDF easily.
      if (options.includePDF) {
        root.file('PROJECT_PRINT_READY.html', this._generateProjectHTML(project, files));
      }

      // ── 3. IDE-specific config files ──────────────────────────────────────
      this._addIDEConfig(root, ide, project, files);

      // ── 4. Generate & add README.md ───────────────────────────────────────
      root.file('README.md', this._generateReadme(project, files));

      // ── 5. Trigger download ───────────────────────────────────────────────
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const fileName = `${projectName}-${ide}.zip`;
      this._downloadBlob(blob, fileName);

      return { success: true, type: ide, fileName, fileCount: files.length };
    }

    /**
     * Export a single file as a download.
     * @param {{path, content, language}} file
     */
    exportSingleFile(file) {
      const name = file.path || file.fileName || 'snippet.txt';
      const content = file.content || '';
      const blob = new Blob([content], { type: 'text/plain' });
      this._downloadBlob(blob, name.split('/').pop());
      return { success: true, fileName: name };
    }

    async exportToVSCode(project) {
      return this.exportProjectAsZip(project, 'vscode');
    }

    async exportToCursor(project) {
      return this.exportProjectAsZip(project, 'cursor');
    }

    async exportToOpenCode(project) {
      return this.exportProjectAsZip(project, 'opencode');
    }

    async exportToAntigravity(project) {
      return this.exportProjectAsZip(project, 'antigravity');
    }

    getSupportedIDEs() {
      return Object.entries(this.supportedIDEs).map(([key, cfg]) => ({ id: key, ...cfg }));
    }

    // ── Private ───────────────────────────────────────────────────────────────

    _addIDEConfig(root, ide, project, files) {
      const languages = [...new Set(files.map(f => f.language).filter(Boolean))];
      const exts = this._detectRecommendedExtensions(files);
      const launch = this._generateLaunchConfig(files);

      switch (ide) {
        case 'vscode': {
          const vs = root.folder('.vscode');
          vs.file('settings.json', JSON.stringify({
            'editor.formatOnSave': true,
            'editor.defaultFormatter': 'esbenp.prettier-vscode',
            'files.autoSave': 'afterDelay',
            'files.autoSaveDelay': 1000
          }, null, 2));
          vs.file('extensions.json', JSON.stringify({ recommendations: exts }, null, 2));
          if (launch) vs.file('launch.json', JSON.stringify(launch, null, 2));
          break;
        }
        case 'cursor': {
          const rules = this._generateCursorRules(files);
          if (rules.length) {
            root.file('.cursorrules', rules.map(r => `# ${r.name}\n${r.description}`).join('\n\n'));
          }
          const cur = root.folder('.cursor');
          cur.file('settings.json', JSON.stringify({ aiLanguages: languages }, null, 2));
          break;
        }
        case 'jetbrains': {
          const idea = root.folder('.idea');
          idea.file('modules.xml', `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="ProjectModuleManager">
    <modules>
      <module fileurl="file://$PROJECT_DIR$/${project.name || 'project'}.iml" filepath="$PROJECT_DIR$/${project.name || 'project'}.iml" />
    </modules>
  </component>
</project>`);
          break;
        }
        case 'zed': {
          const zed = root.folder('.zed');
          zed.file('settings.json', JSON.stringify({
            'format_on_save': 'on',
            'soft_wrap': 'editor_width',
            'tab_size': 2
          }, null, 2));
          break;
        }
        case 'antigravity': {
          const ag = root.folder('.antigravity');
          ag.file('context.md', this._generateAntigravityContext(project, files));
          break;
        }
        case 'opencode': {
          root.file('.opencode.json', JSON.stringify({
            version: '2.0',
            project: project.name,
            sourceUrl: project.sourceUrl,
            languages,
            files: files.map(f => f.path || f.fileName)
          }, null, 2));
          break;
        }
      }

      // Add requirements.txt / package.json if we can infer them
      const hasPy = languages.some(l => l === 'python');
      const hasJs = languages.some(l => ['javascript', 'typescript'].includes(l));
      if (hasPy && !files.some(f => (f.path || '').endsWith('requirements.txt'))) {
        root.file('requirements.txt', '# Generated by Code Extractor V3.0\n# Add your Python dependencies here\n');
      }
      if (hasJs && !files.some(f => (f.path || '').endsWith('package.json'))) {
        root.file('package.json', JSON.stringify({
          name: project.name || 'extracted-project',
          version: '1.0.0',
          description: 'Extracted from ' + (project.sourceUrl || 'AI chat'),
          main: 'index.js',
          scripts: { start: 'node index.js' }
        }, null, 2));
      }
    }

    _generateReadme(project, files) {
      const languages = [...new Set(files.map(f => f.language).filter(Boolean))].join(', ');
      const tree = this._buildTextTree(files);
      return [
        `# ${project.name || 'Extracted Project'}`,
        '',
        `> Extracted by Code Extractor V3.0 from ${project.sourceUrl || 'AI chat'}`,
        '',
        `**Languages:** ${languages || 'various'}  `,
        `**Files:** ${files.length}  `,
        `**Extracted:** ${new Date().toLocaleDateString()}`,
        '',
        '## Project Structure',
        '',
        '```',
        tree,
        '```',
        '',
        '## Getting Started',
        '',
        '1. Open this folder in your IDE',
        '2. Install dependencies (see requirements.txt / package.json)',
        '3. Start coding!',
      ].join('\n');
    }

    _generateAntigravityContext(project, files) {
      return [
        `# ${project.name || 'Extracted Project'} — Antigravity Context`,
        '',
        `Source: ${project.sourceUrl || 'AI chat'}`,
        `Extracted: ${new Date().toISOString()}`,
        '',
        '## Files',
        '',
        ...files.map(f => `- \`${f.path || f.fileName}\` (${f.language || 'text'})`),
      ].join('\n');
    }

    _buildTextTree(files) {
      const paths = files.map(f => f.path || f.fileName || 'unknown.txt').sort();
      let tree = '';
      const structure = {};

      // Build nested object
      paths.forEach(p => {
        const parts = p.split('/');
        let curr = structure;
        parts.forEach((part, i) => {
          if (!curr[part]) curr[part] = i === parts.length - 1 ? null : {};
          curr = curr[part];
        });
      });

      const render = (obj, indent = '') => {
        const keys = Object.keys(obj || {});
        keys.forEach((key, i) => {
          const isLast = i === keys.length - 1;
          const prefix = isLast ? '└── ' : '├── ';
          tree += `${indent}${prefix}${key}\n`;
          if (obj[key]) {
            render(obj[key], indent + (isLast ? '    ' : '│   '));
          }
        });
      };

      render(structure);
      return tree || '  (no files)';
    }

    _generateProjectMarkdown(project, files) {
      let md = `# ${project.name || 'Project'}\n\n`;
      md += `Source: ${project.sourceUrl || 'Unknown'}\n`;
      md += `Exported: ${new Date().toLocaleString()}\n\n`;
      md += `## Project Tree\n\n\`\`\`\n${this._buildTextTree(files)}\n\`\`\`\n\n`;

      files.forEach(file => {
        md += `### File: ${file.path || file.fileName}\n`;
        md += `\`\`\`${file.language || ''}\n${file.content}\n\`\`\`\n\n`;
      });

      return md;
    }

    _generateProjectHTML(project, files) {
      let html = `<!DOCTYPE html><html><head><title>${project.name}</title>`;
      html += `<style>body{font-family:sans-serif;padding:40px;line-height:1.6;} pre{background:#f4f4f4;padding:15px;border-radius:5px;overflow-x:auto;} .file-header{border-bottom:2px solid #eee;margin-top:40px;}</style></head><body>`;
      html += `<h1>${project.name}</h1><p>Source: ${project.sourceUrl}</p>`;
      html += `<h2>Files Index</h2><ul>${files.map(f => `<li>${f.path || f.fileName}</li>`).join('')}</ul>`;

      files.forEach(file => {
        html += `<div class="file-header"><h3>${file.path || file.fileName}</h3></div>`;
        html += `<pre><code>${this._escapeHTML(file.content)}</code></pre>`;
      });

      html += `</body></html>`;
      return html;
    }

    _generateProjectDocs(project, files) {
      // Basic HTML that Word can open correctly
      return this._generateProjectHTML(project, files);
    }

    _escapeHTML(str) {
      return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[m]));
    }

    _downloadBlob(blob, fileName) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    }

    _detectRecommendedExtensions(files) {
      const exts = [];
      const langs = new Set(files.map(f => f.language).filter(Boolean));
      if (langs.has('python')) exts.push('ms-python.python', 'ms-python.vscode-pylance');
      if (langs.has('javascript') || langs.has('typescript'))
        exts.push('dbaeumer.vscode-eslint', 'esbenp.prettier-vscode');
      if (langs.has('html') || langs.has('css'))
        exts.push('ecmel.vscode-html-css');
      if (langs.has('markdown')) exts.push('yzhang.markdown-all-in-one');
      if (langs.has('rust')) exts.push('rust-lang.rust-analyzer');
      if (langs.has('go')) exts.push('golang.go');
      return [...new Set(exts)];
    }

    _generateLaunchConfig(files) {
      const main = files.find(f => {
        const n = (f.path || f.fileName || '').toLowerCase();
        return ['app.py', 'main.py', 'index.js', 'app.js', 'main.js', 'main.ts'].includes(n);
      });
      if (!main) return null;
      const name = main.path || main.fileName;
      if (name.endsWith('.py')) {
        return { version: '0.2.0', configurations: [{ type: 'python', request: 'launch', name: 'Run Python', program: '${workspaceFolder}/' + name, console: 'integratedTerminal' }] };
      }
      if (name.endsWith('.js') || name.endsWith('.ts')) {
        return { version: '0.2.0', configurations: [{ type: 'node', request: 'launch', name: 'Run Node.js', program: '${workspaceFolder}/' + name, console: 'integratedTerminal' }] };
      }
      return null;
    }

    _generateCursorRules(files) {
      const langs = [...new Set(files.map(f => f.language).filter(Boolean))];
      const rules = [];
      if (langs.includes('python')) rules.push({ name: 'Python', description: 'Follow PEP 8 style guide', pattern: '**/*.py' });
      if (langs.some(l => ['javascript', 'typescript'].includes(l)))
        rules.push({ name: 'JavaScript/TypeScript', description: 'Use ESLint and Prettier', pattern: '**/*.{js,ts,jsx,tsx}' });
      return rules;
    }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { IDEExport: window.IDEExport };
}
