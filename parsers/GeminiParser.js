(function () {
  'use strict';

  if (typeof window.GeminiParser === 'undefined') {
    window.GeminiParser = class GeminiParser extends BaseParser {
      canHandle(url) {
        return /gemini\.google\.com/.test(url);
      }

      getCodeBlockElements(doc = document) {
        const blocks = [];
        const selectors = ['code-block', 'pre > code', '.code-container code', 'pre[class*="language"]'];
        for (const selector of selectors) {
          const elements = doc.querySelectorAll(selector);
          elements.forEach(el => {
            if (!blocks.includes(el)) {
              blocks.push(el);
            }
          });
        }
        const shadowHosts = doc.querySelectorAll('[class*="code"], code-block');
        shadowHosts.forEach(host => {
          if (host.shadowRoot) {
            const shadowCodes = host.shadowRoot.querySelectorAll('pre > code, code');
            shadowCodes.forEach(el => {
              if (!blocks.includes(el)) {
                blocks.push(el);
              }
            });
          }
        });
        return blocks;
      }

      getLanguageFromElement(element) {
        const langAttr = element.getAttribute('language');
        if (langAttr) return langAttr;
        const parent = element.parentElement;
        const parentLang = parent?.getAttribute('language');
        if (parentLang) return parentLang;
        const className = element.className || '';
        const parentClass = parent ? parent.className || '' : '';
        const langMatch = className.match(/language-(\w+)/) || parentClass.match(/language-(\w+)/);
        if (langMatch) return langMatch[1];
        const dataLang = element.getAttribute('data-language') || parent?.getAttribute('data-language');
        if (dataLang) return dataLang;
        return null;
      }

      getLabelFromElement(element) {
        const parent = element.closest('[class*="message"], [class*="response"]');
        if (parent) {
          const label = parent.querySelector('[class*="filename"], [class*="label"], [class*="title"]');
          if (label && label.textContent.trim()) {
            return label.textContent.trim();
          }
        }
        const codeBlock = element.closest('code-block');
        if (codeBlock) {
          const label = codeBlock.getAttribute('filename') || codeBlock.getAttribute('label');
          if (label) return label;
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
          'message-content',
          '.response-container',
          '[class*="message-content"]',
          '[class*="response"]',
          '[class*="conversation"] > div'
        ];
        for (const selector of selectors) {
          const elements = doc.querySelectorAll(selector);
          if (elements.length > 0) return Array.from(elements);
        }
        const shadowHosts = doc.querySelectorAll('[class*="conversation"], [class*="chat"]');
        for (const host of shadowHosts) {
          if (host.shadowRoot) {
            const messages = host.shadowRoot.querySelectorAll('message-content, [class*="message"]');
            if (messages.length > 0) return Array.from(messages);
          }
        }
        return [];
      }

      getSiteName() {
        return "Gemini";
      }
    };

    window.GeminiParser = GeminiParser;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { GeminiParser: window.GeminiParser };
  }
})();
