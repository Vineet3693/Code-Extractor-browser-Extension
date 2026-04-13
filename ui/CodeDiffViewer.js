if (typeof window.CodeDiffViewer === 'undefined') {
  class CodeDiffViewer {
    constructor(container) {
      this.container = typeof container === 'string' ? document.querySelector(container) : container;
      this.currentDiff = null;
      this.viewMode = 'split';
      this.ignoreWhitespace = false;
      this.ignoreBlankLines = false;
    }

    renderDiff(diffData, options = {}) {
      this.viewMode = options.viewMode || 'split';
      this.ignoreWhitespace = options.ignoreWhitespace || false;
      this.ignoreBlankLines = options.ignoreBlankLines || false;
      this.currentDiff = diffData;

      if (!this.container) {
        return this.generateDiffHTML(diffData, options);
      }

      this.container.innerHTML = '';
      this.container.className = 'code-diff-viewer';

      const toolbar = this._createToolbar(diffData);
      this.container.appendChild(toolbar);

      const content = document.createElement('div');
      content.className = 'diff-content';

      if (diffData.diff && diffData.diff.length > 0) {
        if (this.viewMode === 'split') {
          content.appendChild(this._renderSplitView(diffData.diff));
        } else {
          content.appendChild(this._renderUnifiedView(diffData.diff));
        }
      } else {
        content.innerHTML = '<p class="diff-empty">No differences found</p>';
      }

      this.container.appendChild(content);
      this._addCopyHandlers(content);
    }

    generateDiffHTML(diffData, options = {}) {
      const viewMode = options.viewMode || 'split';
      let html = '<div class="code-diff-viewer">';

      html += this._generateToolbarHTML(diffData);

      html += '<div class="diff-content">';
      if (diffData.diff && diffData.diff.length > 0) {
        if (viewMode === 'split') {
          html += this._generateSplitViewHTML(diffData.diff);
        } else {
          html += this._generateUnifiedViewHTML(diffData.diff);
        }
      } else {
        html += '<p class="diff-empty">No differences found</p>';
      }
      html += '</div></div>';

      return html;
    }

    _createToolbar(diffData) {
      const toolbar = document.createElement('div');
      toolbar.className = 'diff-toolbar';

      const fileInfo = document.createElement('div');
      fileInfo.className = 'diff-file-info';
      fileInfo.innerHTML = `
        <span class="diff-filename">${this._escapeHtml(diffData.fileName || diffData.filePath || 'unknown')}</span>
        <span class="diff-stats">${this._getDiffStats(diffData.diff)}</span>
      `;
      toolbar.appendChild(fileInfo);

      const controls = document.createElement('div');
      controls.className = 'diff-controls';

      const viewToggle = document.createElement('button');
      viewToggle.className = 'diff-view-toggle';
      viewToggle.textContent = this.viewMode === 'split' ? 'Unified' : 'Split';
      viewToggle.addEventListener('click', () => {
        this.viewMode = this.viewMode === 'split' ? 'unified' : 'split';
        this.renderDiff(diffData, { viewMode: this.viewMode });
      });
      controls.appendChild(viewToggle);

      const whitespaceToggle = document.createElement('button');
      whitespaceToggle.className = 'diff-whitespace-toggle';
      whitespaceToggle.textContent = this.ignoreWhitespace ? 'Show Whitespace' : 'Ignore Whitespace';
      whitespaceToggle.addEventListener('click', () => {
        this.ignoreWhitespace = !this.ignoreWhitespace;
        this.renderDiff(diffData, { viewMode: this.viewMode, ignoreWhitespace: this.ignoreWhitespace });
      });
      controls.appendChild(whitespaceToggle);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'diff-copy-btn';
      copyBtn.textContent = 'Copy Diff';
      copyBtn.addEventListener('click', () => this._copyDiff(diffData));
      controls.appendChild(copyBtn);

      toolbar.appendChild(controls);
      return toolbar;
    }

    _generateToolbarHTML(diffData) {
      return `
        <div class="diff-toolbar">
          <div class="diff-file-info">
            <span class="diff-filename">${this._escapeHtml(diffData.fileName || diffData.filePath || 'unknown')}</span>
            <span class="diff-stats">${this._getDiffStatsHTML(diffData.diff)}</span>
          </div>
        </div>
      `;
    }

    _renderSplitView(diff) {
      const container = document.createElement('div');
      container.className = 'diff-split';

      const leftPanel = document.createElement('div');
      leftPanel.className = 'diff-panel diff-panel-old';
      const leftHeader = document.createElement('div');
      leftHeader.className = 'diff-panel-header';
      leftHeader.textContent = 'Old Version';
      leftPanel.appendChild(leftHeader);

      const rightPanel = document.createElement('div');
      rightPanel.className = 'diff-panel diff-panel-new';
      const rightHeader = document.createElement('div');
      rightHeader.className = 'diff-panel-header';
      rightHeader.textContent = 'New Version';
      rightPanel.appendChild(rightHeader);

      const leftContent = document.createElement('div');
      leftContent.className = 'diff-code';
      const rightContent = document.createElement('div');
      rightContent.className = 'diff-code';

      const leftLines = [];
      const rightLines = [];

      let oldLineNum = 0;
      let newLineNum = 0;

      for (const line of diff) {
        switch (line.type) {
          case 'unchanged':
            oldLineNum++;
            newLineNum++;
            leftLines.push(this._createLineElement(line, oldLineNum, 'unchanged'));
            rightLines.push(this._createLineElement(line, newLineNum, 'unchanged'));
            break;
          case 'removed':
            oldLineNum++;
            leftLines.push(this._createLineElement(line, oldLineNum, 'removed'));
            break;
          case 'added':
            newLineNum++;
            rightLines.push(this._createLineElement(line, newLineNum, 'added'));
            break;
        }
      }

      leftLines.forEach(el => leftContent.appendChild(el));
      rightLines.forEach(el => rightContent.appendChild(el));

      leftPanel.appendChild(leftContent);
      rightPanel.appendChild(rightContent);

      container.appendChild(leftPanel);
      container.appendChild(rightPanel);

      this._syncScroll(leftContent, rightContent);
      return container;
    }

    _generateSplitViewHTML(diff) {
      let html = '<div class="diff-split">';

      html += '<div class="diff-panel diff-panel-old">';
      html += '<div class="diff-panel-header">Old Version</div>';
      html += '<div class="diff-code">';

      let oldLineNum = 0;
      for (const line of diff) {
        if (line.type === 'unchanged' || line.type === 'removed') {
          oldLineNum++;
          html += this._createLineHTML(line, oldLineNum, line.type);
        }
      }

      html += '</div></div>';

      html += '<div class="diff-panel diff-panel-new">';
      html += '<div class="diff-panel-header">New Version</div>';
      html += '<div class="diff-code">';

      let newLineNum = 0;
      for (const line of diff) {
        if (line.type === 'unchanged' || line.type === 'added') {
          newLineNum++;
          html += this._createLineHTML(line, newLineNum, line.type);
        }
      }

      html += '</div></div></div>';
      return html;
    }

    _renderUnifiedView(diff) {
      const container = document.createElement('div');
      container.className = 'diff-unified';

      let lineNum = 0;
      for (const line of diff) {
        lineNum++;
        container.appendChild(this._createLineElement(line, lineNum, line.type));
      }

      return container;
    }

    _generateUnifiedViewHTML(diff) {
      let html = '<div class="diff-unified">';
      let lineNum = 0;

      for (const line of diff) {
        lineNum++;
        html += this._createLineHTML(line, lineNum, line.type);
      }

      html += '</div>';
      return html;
    }

    _createLineElement(line, lineNum, type) {
      const el = document.createElement('div');
      el.className = `diff-line diff-line-${type}`;
      el.dataset.lineType = type;
      el.dataset.lineNum = lineNum;

      const lineNumEl = document.createElement('span');
      lineNumEl.className = 'diff-line-number';
      lineNumEl.textContent = lineNum;

      const prefixEl = document.createElement('span');
      prefixEl.className = 'diff-line-prefix';
      prefixEl.textContent = type === 'added' ? '+' : type === 'removed' ? '-' : ' ';

      const contentEl = document.createElement('span');
      contentEl.className = 'diff-line-content';
      contentEl.textContent = line.content || '';

      el.appendChild(lineNumEl);
      el.appendChild(prefixEl);
      el.appendChild(contentEl);

      return el;
    }

    _createLineHTML(line, lineNum, type) {
      const prefix = type === 'added' ? '+' : type === 'removed' ? '-' : ' ';
      return `<div class="diff-line diff-line-${type}" data-line-type="${type}" data-line-num="${lineNum}">
        <span class="diff-line-number">${lineNum}</span>
        <span class="diff-line-prefix">${prefix}</span>
        <span class="diff-line-content">${this._escapeHtml(line.content || '')}</span>
      </div>`;
    }

    _getDiffStats(diff) {
      if (!diff) return '0 additions, 0 deletions';
      const additions = diff.filter(l => l.type === 'added').length;
      const deletions = diff.filter(l => l.type === 'removed').length;
      return `${additions} addition${additions !== 1 ? 's' : ''}, ${deletions} deletion${deletions !== 1 ? 's' : ''}`;
    }

    _getDiffStatsHTML(diff) {
      if (!diff) return '<span class="diff-stat-add">+0</span> <span class="diff-stat-del">-0</span>';
      const additions = diff.filter(l => l.type === 'added').length;
      const deletions = diff.filter(l => l.type === 'removed').length;
      return `<span class="diff-stat-add">+${additions}</span> <span class="diff-stat-del">-${deletions}</span>`;
    }

    _syncScroll(leftEl, rightEl) {
      let syncing = false;
      leftEl.addEventListener('scroll', () => {
        if (!syncing) {
          syncing = true;
          rightEl.scrollTop = leftEl.scrollTop;
          rightEl.scrollLeft = leftEl.scrollLeft;
          requestAnimationFrame(() => { syncing = false; });
        }
      });
      rightEl.addEventListener('scroll', () => {
        if (!syncing) {
          syncing = true;
          leftEl.scrollTop = rightEl.scrollTop;
          leftEl.scrollLeft = rightEl.scrollLeft;
          requestAnimationFrame(() => { syncing = false; });
        }
      });
    }

    _addCopyHandlers(container) {
      container.addEventListener('dblclick', (e) => {
        const line = e.target.closest('.diff-line');
        if (line) {
          const content = line.querySelector('.diff-line-content')?.textContent;
          if (content) {
            navigator.clipboard.writeText(content).catch(() => { });
          }
        }
      });
    }

    async _copyDiff(diffData) {
      if (!diffData.diff) return;

      let text = '';
      for (const line of diffData.diff) {
        const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
        text += `${prefix} ${line.content}\n`;
      }

      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        console.error('[CodeDiffViewer] Copy failed:', e);
      }
    }

    computeDiff(oldContent, newContent) {
      if (!oldContent && !newContent) return [];
      if (!oldContent) return newContent.split('\n').map(line => ({ type: 'added', content: line }));
      if (!newContent) return oldContent.split('\n').map(line => ({ type: 'removed', content: line }));

      const oldLines = oldContent.split('\n');
      const newLines = newContent.split('\n');

      if (this.ignoreWhitespace) {
        for (let i = 0; i < oldLines.length; i++) {
          oldLines[i] = oldLines[i].trimEnd();
        }
        for (let i = 0; i < newLines.length; i++) {
          newLines[i] = newLines[i].trimEnd();
        }
      }

      const lcs = this._computeLCS(oldLines, newLines);
      const diff = [];

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

    _computeLCS(arr1, arr2) {
      const m = arr1.length;
      const n = arr2.length;

      if (m * n > 10000000) {
        return this._computeLCSApproximate(arr1, arr2);
      }

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

    _computeLCSApproximate(arr1, arr2) {
      const result = [];
      const set2 = new Set(arr2);
      for (const line of arr1) {
        if (set2.has(line)) {
          result.push(line);
          set2.delete(line);
        }
      }
      return result;
    }

    _escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    clear() {
      if (this.container) {
        this.container.innerHTML = '';
      }
      this.currentDiff = null;
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CodeDiffViewer };
  }
  window.CodeDiffViewer = CodeDiffViewer;
}
