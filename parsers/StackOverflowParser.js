(function () {
  'use strict';

  if (typeof window.StackOverflowParser === 'undefined') {
    window.StackOverflowParser = class StackOverflowParser extends BaseParser {
      canHandle(url) {
        return /stackoverflow\.com/.test(url);
      }

      getCodeBlockElements(doc = document) {
        const blocks = [];
        const selectors = ['.s-code-block', 'pre > code', '.post-text pre code', 'pre code', '.s-prose pre code'];
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
        const langMatch = className.match(/language-(\w+)/) || className.match(/lang-(\w+)/) ||
          parentClass.match(/language-(\w+)/) || parentClass.match(/lang-(\w+)/);
        if (langMatch) return langMatch[1];
        const dataLang = element.getAttribute('data-language') || parent?.getAttribute('data-language');
        if (dataLang) return dataLang;
        return null;
      }

      getLabelFromElement(element) {
        const post = element.closest('.answer, .question, .post-layout');
        if (post) {
          const isAnswer = post.classList.contains('answer') || post.querySelector('[class*="answer"]');
          if (isAnswer) {
            const score = post.querySelector('.vote-count, .js-vote-count');
            if (score) {
              return `Answer (score: ${score.textContent.trim()})`;
            }
            return 'Answer';
          }
          const isQuestion = post.classList.contains('question');
          if (isQuestion) return 'Question';
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
          '.question',
          '.answer',
          '.post-layout',
          '#answers .answer',
          '.s-prose'
        ];
        for (const selector of selectors) {
          const elements = doc.querySelectorAll(selector);
          if (elements.length > 0) return Array.from(elements);
        }
        return [];
      }

      getSiteName() {
        return "Stack Overflow";
      }
    };

    window.StackOverflowParser = StackOverflowParser;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { StackOverflowParser: window.StackOverflowParser };
  }
})();
