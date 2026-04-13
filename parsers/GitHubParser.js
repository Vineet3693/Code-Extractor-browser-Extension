(function () {
  'use strict';

  if (typeof window.GitHubParser === 'undefined') {
    window.GitHubParser = class GitHubParser extends BaseParser {
      canHandle(url) {
        return /github\.com/.test(url);
      }

      getCodeBlockElements(doc = document) {
        const blocks = [];
        const selectors = ['.blob-code', '.markdown-body pre > code', '.file-box pre', '.markdown-body code', '[class*="code"] pre'];
        for (const selector of selectors) {
          const elements = doc.querySelectorAll(selector);
          elements.forEach(el => {
            if (!blocks.includes(el)) {
              blocks.push(el);
            }
          });
        }
        const gistBlocks = doc.querySelectorAll('.gist-file pre > code, .gist pre code');
        gistBlocks.forEach(el => {
          if (!blocks.includes(el)) {
            blocks.push(el);
          }
        });
        return blocks;
      }

      getLanguageFromElement(element) {
        const dataLang = element.getAttribute('data-language');
        if (dataLang) return dataLang;
        const parent = element.parentElement;
        const parentDataLang = parent?.getAttribute('data-language');
        if (parentDataLang) return parentDataLang;
        const className = element.className || '';
        const parentClass = parent ? parent.className || '' : '';
        const langMatch = className.match(/language-(\w+)/) || parentClass.match(/language-(\w+)/);
        if (langMatch) return langMatch[1];
        const fileBox = element.closest('.file-box, .gist-file');
        if (fileBox) {
          const langBadge = fileBox.querySelector('[class*="language"]');
          if (langBadge) {
            const text = langBadge.textContent.trim();
            if (text) return text;
          }
        }
        return null;
      }

      getLabelFromElement(element) {
        const fileBox = element.closest('.file-box, .gist-file');
        if (fileBox) {
          const breadcrumb = fileBox.querySelector('.breadcrumb a:last-child, .file-header a');
          if (breadcrumb && breadcrumb.textContent.trim()) {
            return breadcrumb.textContent.trim();
          }
          const filename = fileBox.querySelector('[class*="filename"], .js-blob-filename');
          if (filename && filename.textContent.trim()) {
            return filename.textContent.trim();
          }
        }
        const markdownBody = element.closest('.markdown-body');
        if (markdownBody) {
          const prevHeading = element.previousElementSibling?.querySelector?.('h1, h2, h3, h4, h5, h6');
          if (prevHeading) return prevHeading.textContent.trim();
        }
        const prevSibling = element.previousElementSibling;
        if (prevSibling) {
          const text = prevSibling.textContent.trim();
          if (text && text.length < 100) return text;
        }
        return null;
      }

      getMessageContainers(doc = document) {
        const selectors = [
          '.file',
          '.markdown-body',
          '.file-box',
          '.gist-file',
          '.js-comment-container'
        ];
        for (const selector of selectors) {
          const elements = doc.querySelectorAll(selector);
          if (elements.length > 0) return Array.from(elements);
        }
        return [];
      }

      getSiteName() {
        return "GitHub";
      }
    };

    window.GitHubParser = GitHubParser;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { GitHubParser: window.GitHubParser };
  }
})();
