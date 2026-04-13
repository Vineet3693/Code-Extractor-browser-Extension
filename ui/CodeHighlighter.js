(function () {
  'use strict';

  function highlightCodeBlocks(doc = document) {
    const blocks = doc.querySelectorAll('pre, pre > code, code');
    let count = 0;

    blocks.forEach((block, index) => {
      const text = block.textContent || '';
      if (text.split('\n').length < 2 || text.length < 20) return;

      block.classList.add('code-extractor-highlight');
      block.dataset.ceIndex = index;
      count++;
    });

    return count;
  }

  function stopHighlight(doc = document) {
    const highlighted = doc.querySelectorAll('.code-extractor-highlight');
    highlighted.forEach(el => {
      el.classList.remove('code-extractor-highlight');
      delete el.dataset.ceIndex;
    });
  }

  function highlightSingleBlock(element) {
    if (!element) return false;
    element.classList.add('code-extractor-highlight');
    return true;
  }

  function getHighlightedBlocks(doc = document) {
    return Array.from(doc.querySelectorAll('.code-extractor-highlight'));
  }

  function addCopyButtons(doc = document) {
    const blocks = doc.querySelectorAll('pre');
    let count = 0;

    blocks.forEach(block => {
      if (block.querySelector('.ce-copy-btn')) return;

      const btn = document.createElement('button');
      btn.className = 'ce-copy-btn';
      btn.textContent = 'Copy';
      btn.title = 'Copy code';
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const code = block.querySelector('code') || block;
        try {
          await navigator.clipboard.writeText(code.textContent);
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        } catch (err) {
          const ta = document.createElement('textarea');
          ta.value = code.textContent;
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

  function removeCopyButtons(doc = document) {
    const buttons = doc.querySelectorAll('.ce-copy-btn');
    buttons.forEach(btn => btn.remove());
  }

  function injectHighlightStyles() {
    if (document.getElementById('ce-highlight-styles')) return;
    const style = document.createElement('style');
    style.id = 'ce-highlight-styles';
    style.textContent = `
      .code-extractor-highlight {
        outline: 2px solid #4CAF50 !important;
        outline-offset: 2px !important;
        position: relative !important;
        transition: outline-color 0.2s ease;
      }
      .code-extractor-highlight::before {
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
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      highlightCodeBlocks,
      stopHighlight,
      highlightSingleBlock,
      getHighlightedBlocks,
      addCopyButtons,
      removeCopyButtons,
      injectHighlightStyles
    };
  }
})();
