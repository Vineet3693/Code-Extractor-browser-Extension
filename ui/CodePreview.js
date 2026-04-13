class CodePreview {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.options = {
      showLineNumbers: options.showLineNumbers !== false,
      showLanguage: options.showLanguage !== false,
      showCopyButton: options.showCopyButton !== false,
      maxLines: options.maxLines || 200,
      language: options.language || null,
      fileName: options.fileName || null
    };
    this.element = null;
    this.currentContent = '';
  }

  render(content, language = null, fileName = null) {
    this.currentContent = content;
    const lang = language || this.options.language || 'text';
    const name = fileName || this.options.fileName;
    this.container.innerHTML = '';

    this.element = document.createElement('div');
    this.element.className = 'ce-code-preview';

    const header = document.createElement('div');
    header.className = 'ce-code-preview-header';

    if (name) {
      const nameEl = document.createElement('span');
      nameEl.className = 'ce-code-preview-filename';
      nameEl.textContent = name;
      header.appendChild(nameEl);
    }

    if (this.options.showLanguage) {
      const langEl = document.createElement('span');
      langEl.className = 'ce-code-preview-lang';
      langEl.textContent = lang.charAt(0).toUpperCase() + lang.slice(1);
      header.appendChild(langEl);
    }

    if (this.options.showCopyButton) {
      const copyBtn = document.createElement('button');
      copyBtn.className = 'ce-code-preview-copy';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', () => this.copyToClipboard());
      header.appendChild(copyBtn);
    }

    this.element.appendChild(header);

    const codeContainer = document.createElement('div');
    codeContainer.className = 'ce-code-container';

    if (this.options.showLineNumbers) {
      const lineNumbers = document.createElement('div');
      lineNumbers.className = 'ce-line-numbers';
      const lines = content.split('\n');
      const displayLines = lines.slice(0, this.options.maxLines);
      for (let i = 1; i <= displayLines.length; i++) {
        const num = document.createElement('div');
        num.className = 'ce-line-number';
        num.textContent = i;
        lineNumbers.appendChild(num);
      }
      if (lines.length > this.options.maxLines) {
        const more = document.createElement('div');
        more.className = 'ce-line-number ce-line-more';
        more.textContent = `+${lines.length - this.options.maxLines} more`;
        lineNumbers.appendChild(more);
      }
      codeContainer.appendChild(lineNumbers);
    }

    const codeEl = document.createElement('pre');
    codeEl.className = 'ce-code-block';
    const displayContent = content.split('\n').slice(0, this.options.maxLines).join('\n');
    codeEl.textContent = displayContent;
    if (content.split('\n').length > this.options.maxLines) {
      codeEl.textContent += '\n\n... (truncated)';
    }
    codeContainer.appendChild(codeEl);

    this.element.appendChild(codeContainer);
    this.container.appendChild(this.element);
  }

  async copyToClipboard() {
    try {
      await navigator.clipboard.writeText(this.currentContent);
      const btn = this.element?.querySelector('.ce-code-preview-copy');
      if (btn) {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      }
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = this.currentContent;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      const btn = this.element?.querySelector('.ce-code-preview-copy');
      if (btn) {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      }
    }
  }

  getContent() {
    return this.currentContent;
  }

  update(content) {
    this.render(content, this.options.language, this.options.fileName);
  }

  clear() {
    this.currentContent = '';
    this.element = null;
    this.container.innerHTML = '';
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CodePreview };
}
