(function () {
  'use strict';

  class ScriptInjector {
    constructor() {
      this.injectedScripts = new Set();
      this.injectedStyles = new Set();
    }

    injectScript(src, options = {}) {
      if (this.injectedScripts.has(src)) return Promise.resolve();

      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = options.async !== false;
        script.defer = options.defer !== false;

        if (options.nonce) {
          script.nonce = options.nonce;
        }

        script.onload = () => {
          this.injectedScripts.add(src);
          resolve();
        };

        script.onerror = () => {
          reject(new Error(`Failed to inject script: ${src}`));
        };

        (document.head || document.documentElement).appendChild(script);
      });
    }

    injectInlineScript(code, id = null) {
      const scriptId = id || `ce-inline-${Date.now()}`;
      if (document.getElementById(scriptId)) return;

      const script = document.createElement('script');
      script.id = scriptId;
      script.textContent = code;
      (document.head || document.documentElement).appendChild(script);
      this.injectedScripts.add(scriptId);
    }

    injectStyle(src, options = {}) {
      if (this.injectedStyles.has(src)) return Promise.resolve();

      return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = src;

        if (options.media) {
          link.media = options.media;
        }

        link.onload = () => {
          this.injectedStyles.add(src);
          resolve();
        };

        link.onerror = () => {
          reject(new Error(`Failed to inject style: ${src}`));
        };

        (document.head || document.documentElement).appendChild(link);
      });
    }

    injectInlineStyle(css, id = null) {
      const styleId = id || `ce-style-${Date.now()}`;
      if (document.getElementById(styleId)) return;

      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
      this.injectedStyles.add(styleId);
    }

    injectHighlightStyles() {
      if (document.getElementById('ce-highlight-styles')) return;

      const css = `
        .ce-highlight {
          outline: 2px solid #4CAF50 !important;
          outline-offset: 2px !important;
          position: relative !important;
          transition: outline-color 0.2s ease;
        }
        .ce-highlight::before {
          content: 'Code Extractor';
          position: absolute;
          top: -22px;
          left: 0;
          background: #4CAF50;
          color: white;
          padding: 2px 8px;
          font-size: 10px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          border-radius: 3px;
          z-index: 99999;
          pointer-events: none;
          font-weight: 600;
        }
        .ce-copy-btn {
          position: absolute;
          top: 6px;
          right: 6px;
          padding: 4px 10px;
          background: rgba(76, 175, 80, 0.9);
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s ease;
          z-index: 10;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        pre:hover .ce-copy-btn {
          opacity: 1;
        }
        .ce-copy-btn:hover {
          background: rgba(69, 160, 73, 1);
        }
        .ce-fab {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #4CAF50;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          cursor: pointer;
          z-index: 99998;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          border: none;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .ce-fab:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 16px rgba(0,0,0,0.4);
        }
        .ce-progress-toast {
          position: fixed;
          bottom: 90px;
          right: 24px;
          background: #1e1e3a;
          border: 1px solid #2a2a4a;
          border-radius: 8px;
          padding: 12px 16px;
          color: #eaeaea;
          font-size: 13px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          z-index: 99997;
          min-width: 200px;
        }
        .ce-progress-toast-bar {
          width: 100%;
          height: 4px;
          background: #2a2a4a;
          border-radius: 2px;
          margin-top: 8px;
          overflow: hidden;
        }
        .ce-progress-toast-fill {
          height: 100%;
          background: #4CAF50;
          border-radius: 2px;
          transition: width 0.3s ease;
        }
      `;

      this.injectInlineStyle(css, 'ce-highlight-styles');
    }

    addCopyButtons() {
      const blocks = document.querySelectorAll('pre');
      let count = 0;

      blocks.forEach(block => {
        if (block.querySelector('.ce-copy-btn')) return;
        const text = block.textContent || '';
        if (text.split('\n').length < 2 || text.length < 20) return;

        const btn = document.createElement('button');
        btn.className = 'ce-copy-btn';
        btn.textContent = 'Copy';
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            await navigator.clipboard.writeText(block.textContent);
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
          } catch (err) {
            const ta = document.createElement('textarea');
            ta.value = block.textContent;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
          }
        });

        block.style.position = 'relative';
        block.appendChild(btn);
        count++;
      });

      return count;
    }

    showFAB(count, onClick) {
      let fab = document.getElementById('ce-fab');
      if (fab) {
        fab.querySelector('.ce-fab-count').textContent = count;
        return;
      }

      fab = document.createElement('button');
      fab.id = 'ce-fab';
      fab.className = 'ce-fab';
      fab.innerHTML = `<span>📦</span><span class="ce-fab-count">${count}</span>`;
      fab.addEventListener('click', onClick);
      document.body.appendChild(fab);
    }

    hideFAB() {
      const fab = document.getElementById('ce-fab');
      if (fab) fab.remove();
    }

    showProgressToast(message, percent) {
      let toast = document.getElementById('ce-progress-toast');

      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'ce-progress-toast';
        toast.className = 'ce-progress-toast';
        toast.innerHTML = `
          <div class="ce-progress-toast-text">${message}</div>
          <div class="ce-progress-toast-bar">
            <div class="ce-progress-toast-fill" style="width: ${percent}%"></div>
          </div>
        `;
        document.body.appendChild(toast);
      } else {
        toast.querySelector('.ce-progress-toast-text').textContent = message;
        toast.querySelector('.ce-progress-toast-fill').style.width = `${percent}%`;
      }
    }

    hideProgressToast() {
      const toast = document.getElementById('ce-progress-toast');
      if (toast) toast.remove();
    }

    removeAllInjected() {
      document.querySelectorAll('[id^="ce-"]').forEach(el => el.remove());
      this.injectedScripts.clear();
      this.injectedStyles.clear();
    }
  }

  window.CodeExtractorInjector = new ScriptInjector();
})();
