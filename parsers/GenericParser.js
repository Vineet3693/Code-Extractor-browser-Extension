(function () {
  'use strict';

  if (typeof window.UniversalParser === 'undefined') {
    window.UniversalParser = class UniversalParser extends BaseParser {
      canHandle(url) {
        return true;
      }

      getCodeBlockElements(doc = document) {
        const blocks = [];
        const seen = new WeakSet();

        const selectors = [
          'pre > code', 'pre code', 'pre.highlight', 'pre[class*="language"]', 'pre[class*="lang-"]',
          'code[class*="language"]', 'code[class*="lang-"]', 'code[class*="hljs"]', 'code[class*="highlight"]',
          'div[class*="code-block"] pre', 'div[class*="codeBlock"] pre', 'div[class*="code"] > pre',
          'div[class*="code"] > code', 'div[class*="code"] pre > code', 'div[class*="code"] code',
          'div[class*="highlight"] pre', 'div[class*="highlight"] code', 'div[class*="syntax"] pre',
          'div[class*="syntax"] code', 'div[class*="snippet"] pre', 'div[class*="snippet"] code',
          'div[class*="sourcecode"] pre', 'div[class*="source-code"] pre', 'div[class*="codeblock"] pre',
          'div[class*="code_panel"] pre', 'div[class*="code-example"] pre', 'div[class*="code-sample"] pre',
          'div[class*="code-snippet"] pre', 'div[class*="code-container"] pre', 'div[class*="code-wrapper"] pre',
          'div[class*="editor"] pre', 'div[class*="terminal"] pre', 'div[class*="console"] pre',
          'div[class*="markdown"] pre', 'div[class*="prose"] pre', 'div[class*="content"] pre',
          'div[class*="article"] pre', 'div[class*="post"] pre', 'div[class*="response"] pre',
          'div[class*="message"] pre', 'div[class*="conversation"] pre', 'div[class*="chat"] pre',
          'div[class*="artifact"] pre', 'div[class*="file-tab"] pre', 'div[class*="tab-content"] pre',
          'div[class*="tab-pane"] pre', 'div[class*="cell"] pre', 'div[class*="output"] pre',
          '.blob-code', '.file-box pre', '.gist pre', '.gist-file pre', '.s-code-block',
          '.post-text pre code', '.s-prose pre code', 'code-block', 'code-block pre',
          '.code-block', '.code-block pre', '.CodeMirror', '.monaco-editor', '.ace_editor',
          '[data-code]', '[data-language]', '[data-lang]', 'figure pre', 'figure code',
          'td pre', 'td code', 'li pre', 'li code', 'blockquote pre', 'blockquote code',
          'details pre', 'section pre', 'main pre', 'article pre'
        ];

        for (const selector of selectors) {
          try {
            const elements = doc.querySelectorAll(selector);
            elements.forEach(el => {
              if (!seen.has(el)) {
                seen.add(el);
                blocks.push(el);
              }
            });
          } catch (e) { }
        }

        const shadowHosts = doc.querySelectorAll('*');
        shadowHosts.forEach(host => {
          if (host.shadowRoot) {
            try {
              const shadowBlocks = host.shadowRoot.querySelectorAll('pre, code, code-block');
              shadowBlocks.forEach(el => {
                if (!seen.has(el)) {
                  seen.add(el);
                  blocks.push(el);
                }
              });
            } catch (e) { }
          }
        });

        const filtered = [];
        for (const block of blocks) {
          const text = block.textContent || '';
          const lines = text.split('\n').filter(l => l.trim().length > 0);
          if (lines.length >= 1 && text.length >= 15) {
            if (!block.closest('.ce-toast, .ce-modal, .ce-fab, .ce-progress-toast, #code-extractor-toasts')) {
              filtered.push(block);
            }
          }
        }

        const deduped = [];
        const textSeen = new Set();
        for (const block of filtered) {
          const text = (block.textContent || '').trim().substring(0, 100);
          if (!textSeen.has(text)) {
            textSeen.add(text);
            deduped.push(block);
          }
        }

        return deduped;
      }

      getLanguageFromElement(element) {
        const elClass = (element.className || '').toLowerCase();
        const parent = element.parentElement;
        const parentClass = (parent?.className || '').toLowerCase();
        const allClasses = elClass + ' ' + parentClass;

        const langPatterns = [
          /language-(\w+)/i, /lang-(\w+)/i, /hljs\s+(\w+)/i,
          /brush:\s*(\w+)/i, /highlight-(\w+)/i, /syntax-(\w+)/i
        ];

        for (const pattern of langPatterns) {
          const match = allClasses.match(pattern);
          if (match) return this._normalizeLanguage(match[1]);
        }

        const dataLang = element.getAttribute('data-language') ||
          element.getAttribute('data-lang') ||
          parent?.getAttribute('data-language') ||
          parent?.getAttribute('data-lang');
        if (dataLang) return this._normalizeLanguage(dataLang);

        const headerLabel = this._getHeaderLabel(element);
        if (headerLabel) {
          const knownLangs = ['javascript', 'python', 'java', 'typescript', 'html', 'css', 'json', 'yaml', 'xml', 'sql', 'bash', 'shell', 'ruby', 'php', 'go', 'golang', 'rust', 'c++', 'c#', 'csharp', 'swift', 'kotlin', 'dart', 'scala', 'lua', 'perl', 'haskell', 'elixir', 'vue', 'svelte', 'dockerfile', 'makefile', 'toml', 'ini', 'markdown', 'text', 'powershell', 'batch', 'matlab', 'julia', 'zig', 'nim', 'solidity', 'terraform', 'graphql', 'protobuf', 'csv', 'log', 'diff', 'gitignore'];
          const lower = headerLabel.toLowerCase();
          for (const lang of knownLangs) {
            if (lower.includes(lang)) return this._normalizeLanguage(lang);
          }
        }

        const code = element.textContent || '';
        const contentLang = this._detectLanguageFromContent(code);
        if (contentLang) return contentLang;

        return null;
      }

      _getHeaderLabel(element) {
        const containers = [
          element.parentElement, element.closest('[class*="code"]'), element.closest('[class*="highlight"]'),
          element.closest('[class*="block"]'), element.closest('[class*="wrapper"]'), element.closest('[class*="container"]'),
          element.closest('[class*="card"]'), element.closest('[class*="panel"]'), element.closest('[class*="cell"]'),
          element.closest('[class*="message"]'), element.closest('[class*="response"]'), element.closest('[class*="conversation"]'),
          element.closest('[class*="chat"]'), element.closest('[class*="article"]'), element.closest('[class*="post"]'),
          element.closest('[class*="content"]'), element.closest('figure'), element.closest('section'),
          element.closest('main'), element.closest('article'), element.closest('div')
        ];

        for (const container of containers) {
          if (!container) continue;
          const previous = container.previousElementSibling;
          if (previous) {
            const text = previous.textContent.trim();
            if (text.length > 0 && text.length < 100) return text;
          }
          const children = container.children;
          for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child === element || element.contains(child)) continue;
            const text = child.textContent.trim();
            if (text.length > 0 && text.length < 100 && !text.includes('\n')) {
              return text;
            }
          }
        }
        const prevSibling = element.previousElementSibling;
        if (prevSibling) {
          const text = prevSibling.textContent.trim();
          if (text.length > 0 && text.length < 100) return text;
        }
        return null;
      }

      _detectLanguageFromContent(code) {
        if (!code || code.trim().length === 0) return null;
        const indicators = {
          python: ['import ', 'from ', 'def ', 'class ', 'print(', 'if __name__', 'self.', 'elif ', 'lambda '],
          javascript: ['const ', 'let ', 'var ', 'function ', '=>', 'require(', 'module.exports', 'console.log'],
          typescript: ['interface ', 'type ', 'as ', ': string', ': number', 'enum ', 'namespace '],
          html: ['<!DOCTYPE', '<html', '<head', '<body', '<div', '<span', '<p>'],
          css: ['{', '}', ':', ';', 'margin:', 'padding:', 'color:', 'display:'],
          json: ['{', '}', ':', ',', '"'],
          yaml: ['  ', ':', '-', '|', '>'],
          sql: ['SELECT ', 'FROM ', 'WHERE ', 'INSERT ', 'CREATE TABLE'],
          bash: ['#!/bin/bash', '#!/bin/sh', 'echo ', 'export ', 'cd '],
          dockerfile: ['FROM ', 'RUN ', 'COPY ', 'CMD ', 'ENTRYPOINT'],
          java: ['public class ', 'private ', 'public static void main', 'import java.'],
          go: ['package main', 'func main(', 'import (', 'fmt.Println'],
          rust: ['fn main()', 'let mut ', 'println!', 'use std::'],
          ruby: ['def ', 'end', 'puts ', "require '", 'class '],
          php: ['<?php', 'echo ', '$_GET', '$_POST']
        };
        const scores = {};
        for (const [lang, patterns] of Object.entries(indicators)) {
          scores[lang] = 0;
          for (const pattern of patterns) {
            if (code.includes(pattern)) scores[lang]++;
          }
        }
        let bestLang = null;
        let bestScore = 0;
        for (const [lang, score] of Object.entries(scores)) {
          if (score > bestScore) {
            bestScore = score;
            bestLang = lang;
          }
        }
        return bestScore >= 2 ? bestLang : null;
      }

      _normalizeLanguage(lang) {
        if (!lang) return null;
        const map = {
          'js': 'javascript', 'py': 'python', 'ts': 'typescript',
          'rb': 'ruby', 'rs': 'rust', 'cs': 'csharp', 'c++': 'cpp',
          'c#': 'csharp', 'sh': 'bash', 'shell': 'bash', 'yml': 'yaml',
          'md': 'markdown', 'html5': 'html', 'css3': 'css',
          'node': 'javascript', 'react': 'javascript', 'golang': 'go',
          'jsx': 'javascript', 'tsx': 'typescript'
        };
        const lower = lang.toLowerCase().trim();
        return map[lower] || lower;
      }

      getLabelFromElement(element) {
        const headerLabel = this._getHeaderLabel(element);
        if (headerLabel) return headerLabel;
        const prevSibling = element.previousElementSibling;
        if (prevSibling) {
          const heading = prevSibling.querySelector('h1, h2, h3, h4, h5, h6');
          if (heading && heading.textContent.trim()) return heading.textContent.trim();
          const text = prevSibling.textContent.trim();
          if (text && text.length < 200) return text;
        }
        const parent = element.parentElement;
        if (parent) {
          const heading = parent.previousElementSibling?.querySelector?.('h1, h2, h3, h4, h5, h6');
          if (heading && heading.textContent.trim()) return heading.textContent.trim();
        }
        return null;
      }

      getMessageContainers(doc = document) {
        const selectors = [
          'article', 'main', '.content', '.post', '.entry',
          '[class*="content"]', '[class*="article"]',
          '[class*="message"]', '[class*="response"]',
          '[class*="conversation"]', '[class*="chat"]',
          '[class*="markdown"]', '[class*="prose"]',
          '[class*="code-block"]', '[class*="codeBlock"]',
          'section', 'div[class*="page"]', 'div[class*="app"]'
        ];
        for (const selector of selectors) {
          const elements = doc.querySelectorAll(selector);
          if (elements.length > 0) return Array.from(elements);
        }
        return [doc.body];
      }

      getSiteName() {
        try {
          return window.location.hostname || 'Unknown';
        } catch (e) {
          return 'Unknown';
        }
      }
    };

    window.UniversalParser = UniversalParser;
    window.GenericParser = UniversalParser;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { UniversalParser, GenericParser: window.GenericParser };
  }
})();
