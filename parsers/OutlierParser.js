(function () {
  'use strict';

  if (typeof window.OutlierParser === 'undefined') {
    window.OutlierParser = class OutlierParser extends BaseParser {
      canHandle(url) {
        return /app\.outlier\.ai|\.outlier\.ai/.test(url);
      }

      getCodeBlockElements(doc = document) {
        const blocks = [];
        const selectors = ['pre > code', '.code-block pre', '.markdown-body pre', 'pre[class*="language"]'];
        for (const selector of selectors) {
          const elements = doc.querySelectorAll(selector);
          elements.forEach(el => {
            if (!blocks.includes(el)) {
              blocks.push(el);
            }
          });
        }
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
        const parent = element.closest('.turn, .response, [class*="message"]');
        if (parent) {
          const label = parent.querySelector('[class*="filename"], [class*="label"], [class*="title"]');
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
          '.turn',
          '.response',
          '[class*="message"]',
          '[class*="conversation"] > div'
        ];
        for (const selector of selectors) {
          const elements = doc.querySelectorAll(selector);
          if (elements.length > 0) return Array.from(elements);
        }
        return [];
      }

      getSiteName() {
        return "Outlier";
      }
    };

    window.OutlierParser = OutlierParser;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { OutlierParser: window.OutlierParser };
  }
})();
