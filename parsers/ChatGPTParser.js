(function () {
  'use strict';

  if (typeof window.ChatGPTParser === 'undefined') {
    window.ChatGPTParser = class ChatGPTParser extends BaseParser {
      canHandle(url) {
        return /chat\.openai\.com|chatgpt\.com/.test(url);
      }

      getCodeBlockElements(doc = document) {
        const blocks = [];
        const selectors = ['pre > code', 'div[class*="code"] code', 'pre[class*="language"]', '[class*="code-block"] pre'];
        for (const selector of selectors) {
          const elements = doc.querySelectorAll(selector);
          elements.forEach(el => {
            if (!blocks.includes(el)) {
              blocks.push(el);
            }
          });
        }

        const collapsedBlocks = doc.querySelectorAll('[class*="collapsed"], [class*="expand"]');
        collapsedBlocks.forEach(el => {
          const code = el.querySelector('code');
          if (code && !blocks.includes(code)) {
            blocks.push(code);
          }
        });

        return blocks;
      }

      getLanguageFromElement(element) {
        const className = element.className || '';
        const parent = element.parentElement;
        const parentClass = parent ? parent.className || '' : '';
        const langMatch = className.match(/language-(\w+)/) || className.match(/hljs\s+(\w+)/) ||
          parentClass.match(/language-(\w+)/) || parentClass.match(/hljs\s+(\w+)/);
        if (langMatch) return langMatch[1];
        const dataLang = element.getAttribute('data-language') || parent?.getAttribute('data-language');
        if (dataLang) return dataLang;
        return null;
      }

      getLabelFromElement(element) {
        const parent = element.closest('[class*="message"]') || element.parentElement;
        if (!parent) return null;
        const labelSelectors = [
          '[class*="filename"]',
          '[class*="file-name"]',
          '[class*="label"]',
          'span[class*="text"]',
          'div[class*="header"]'
        ];
        for (const selector of labelSelectors) {
          const label = parent.querySelector(selector) || element.previousElementSibling?.querySelector?.(selector);
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
          'div[data-message-author-role]',
          'div[class*="message"]',
          'div[class*="conversation"] > div',
          'article'
        ];
        for (const selector of selectors) {
          const elements = doc.querySelectorAll(selector);
          if (elements.length > 0) return Array.from(elements);
        }
        return [];
      }

      getSiteName() {
        return "ChatGPT";
      }
    };

    window.ChatGPTParser = ChatGPTParser;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { ChatGPTParser: window.ChatGPTParser };
  }
})();
