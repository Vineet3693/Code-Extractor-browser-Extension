(function () {
  'use strict';

  if (typeof window.PoeParser === 'undefined') {
    window.PoeParser = class PoeParser extends BaseParser {
      canHandle(url) {
        return /^https?:\/\/poe\.com/.test(url);
      }

      getCodeBlockElements(doc = document) {
        const blocks = [];
        const selectors = ['pre > code', '[class*="codeBlock"] code', '[class*="code-block"] code', 'pre[class*="language"]'];
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
        const messageContainer = element.closest('[class*="Message"], [class*="message"]');
        if (messageContainer) {
          const botName = messageContainer.querySelector('[class*="botName"], [class*="bot-name"], [class*="author"]');
          if (botName && botName.textContent.trim()) {
            const label = botName.textContent.trim();
            const prevSibling = element.previousElementSibling;
            if (prevSibling) {
              const filename = prevSibling.querySelector('[class*="filename"], [class*="file-name"]');
              if (filename && filename.textContent.trim()) {
                return `${label}: ${filename.textContent.trim()}`;
              }
            }
            return label;
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
          '[class*="Message"]',
          '[class*="message"]',
          '[class*="chatMessage"]',
          '[class*="conversation"] > div'
        ];
        for (const selector of selectors) {
          const elements = doc.querySelectorAll(selector);
          if (elements.length > 0) return Array.from(elements);
        }
        return [];
      }

      getSiteName() {
        return "Poe";
      }
    };

    window.PoeParser = PoeParser;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { PoeParser: window.PoeParser };
  }
})();
