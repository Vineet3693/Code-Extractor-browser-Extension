(function () {
  'use strict';

  if (typeof window.ClaudeParser === 'undefined') {
    window.ClaudeParser = class ClaudeParser extends BaseParser {
      canHandle(url) {
        return /claude\.ai/.test(url);
      }

      getCodeBlockElements(doc = document) {
        const blocks = [];
        const selectors = ['pre > code', '[class*="code-block"] code', 'pre[class*="language"]', '[class*="code"] pre'];
        for (const selector of selectors) {
          const elements = doc.querySelectorAll(selector);
          elements.forEach(el => {
            if (!blocks.includes(el)) {
              blocks.push(el);
            }
          });
        }
        const artifactBlocks = doc.querySelectorAll('[class*="artifact"] pre > code, [class*="artifact"] code');
        artifactBlocks.forEach(el => {
          if (!blocks.includes(el)) {
            blocks.push(el);
          }
        });
        return blocks;
      }

      getLanguageFromElement(element) {
        const className = element.className || '';
        const parent = element.parentElement;
        const parentClass = parent ? parent.className || '' : '';
        const langMatch = className.match(/language-(\w+)/) || parentClass.match(/language-(\w+)/);
        if (langMatch) return langMatch[1];
        const dataLang = element.getAttribute('data-language') || parent?.getAttribute('data-language');
        if (dataLang) return dataLang;
        return null;
      }

      getLabelFromElement(element) {
        const artifactContainer = element.closest('[class*="artifact"]');
        if (artifactContainer) {
          const tabName = artifactContainer.querySelector('[class*="tab-name"], [class*="file-name"], [class*="label"]');
          if (tabName && tabName.textContent.trim()) {
            return tabName.textContent.trim();
          }
          const title = artifactContainer.querySelector('[class*="title"], [class*="header"]');
          if (title && title.textContent.trim()) {
            return title.textContent.trim();
          }
        }
        const parent = element.closest('[class*="message"], [class*="response"]');
        if (parent) {
          const label = parent.querySelector('[class*="filename"], [class*="file-name"]');
          if (label && label.textContent.trim()) {
            return label.textContent.trim();
          }
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
          '[class*="message"]',
          '[class*="response"]',
          '[class*="conversation"] > div',
          '[class*="turn"]'
        ];
        for (const selector of selectors) {
          const elements = doc.querySelectorAll(selector);
          if (elements.length > 0) return Array.from(elements);
        }
        return [];
      }

      getSiteName() {
        return "Claude";
      }
    };

    window.ClaudeParser = ClaudeParser;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { ClaudeParser: window.ClaudeParser };
  }
})();
