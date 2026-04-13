if (typeof window.LiveScanner === 'undefined') {
  window.LiveScanner = class LiveScanner {

    constructor(options = {}) {
      this.observer = null;
      this.isObserving = false;
      this.isPaused = false;
      this.debounceTimer = null;
      this.pendingMutations = [];
      this.scannedElementIds = new Set();
      this.startTime = null;
      this.totalDetected = 0;
      this.lastDetectedAt = null;

      this.options = {
        debounceMs: options.debounceMs || 500,
        targetSelector: options.targetSelector || null,
        autoStart: options.autoStart || false,
        onNewCode: options.onNewCode || null,
        onUpdate: options.onUpdate || null,
        onError: options.onError || null,
        parser: options.parser || null,
        scanState: options.scanState || null
      };

      this._streamingCheckCache = new Map();
    }

    start() {
      if (this.isObserving) return;

      const target = this._determineTarget();
      if (!target) {
        this._logError('No valid observation target found');
        return;
      }

      this.observer = new MutationObserver(this._handleMutations.bind(this));
      this.observer.observe(target, {
        childList: true,
        subtree: true,
        characterData: false,
        attributes: false
      });

      this._markExistingElements();
      this.isObserving = true;
      this.isPaused = false;
      this.startTime = Date.now();

      console.log('[LiveScanner] Started observing:', target.tagName, target.className?.substring(0, 50));
    }

    stop() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      this._clearDebounce();
      this.pendingMutations = [];
      this.isObserving = false;
      this.isPaused = false;
      console.log('[LiveScanner] Stopped observing');
    }

    pause() {
      if (!this.isObserving || this.isPaused) return;
      if (this.observer) {
        this.observer.disconnect();
      }
      this.isPaused = true;
      this._clearDebounce();
      console.log('[LiveScanner] Paused observing');
    }

    resume() {
      if (!this.isObserving || !this.isPaused) return;
      const target = this._determineTarget();
      if (!target) return;

      this.observer = new MutationObserver(this._handleMutations.bind(this));
      this.observer.observe(target, {
        childList: true,
        subtree: true,
        characterData: false,
        attributes: false
      });
      this.isPaused = false;
      console.log('[LiveScanner] Resumed observing');
    }

    getStatus() {
      return {
        isObserving: this.isObserving,
        isPaused: this.isPaused,
        totalDetected: this.totalDetected,
        lastDetectedAt: this.lastDetectedAt,
        scannedElementCount: this.scannedElementIds.size,
        uptime: this.startTime ? Date.now() - this.startTime : 0
      };
    }

    _determineTarget() {
      if (this.options.targetSelector) {
        return document.querySelector(this.options.targetSelector);
      }
      if (this.options.parser && typeof this.options.parser.getConversationContainer === 'function') {
        return this.options.parser.getConversationContainer();
      }
      return document.body;
    }

    _markExistingElements() {
      if (!this.options.parser) return;
      try {
        const existing = this.options.parser.getCodeBlockElements?.() || [];
        existing.forEach(el => {
          const id = this._getElementId(el);
          this.scannedElementIds.add(id);
        });
      } catch (e) {
        console.warn('[LiveScanner] Could not mark existing elements:', e);
      }
    }

    _handleMutations(mutationsList) {
      if (this.isPaused) return;

      this.pendingMutations.push(...mutationsList);

      this._clearDebounce();
      this.debounceTimer = setTimeout(() => {
        this._processPendingMutations();
      }, this.options.debounceMs);
    }

    _processPendingMutations() {
      const mutations = [...this.pendingMutations];
      this.pendingMutations = [];

      const addedNodes = [];
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              addedNodes.push(node);
            }
          }
        }
      }

      if (addedNodes.length === 0) return;

      const newCodeElements = [];
      for (const node of addedNodes) {
        if (this._isCodeBlockElement(node)) {
          newCodeElements.push(node);
        }
        try {
          const innerBlocks = node.querySelectorAll?.('pre code, pre, .code-block, [class*="code"], [class*="highlight"]') || [];
          innerBlocks.forEach(el => {
            if (!newCodeElements.includes(el)) {
              newCodeElements.push(el);
            }
          });
        } catch (e) { }
      }

      const trulyNew = newCodeElements.filter(el => {
        const id = this._getElementId(el);
        return !this.scannedElementIds.has(id);
      });

      if (trulyNew.length === 0) return;

      const validNewBlocks = [];
      for (const el of trulyNew) {
        if (!this._isStreamingComplete(el)) {
          continue;
        }

        const id = this._getElementId(el);
        this.scannedElementIds.add(id);

        const content = (el.textContent || '').trim();
        if (content.length < 10) continue;

        const language = this._detectLanguage(el);
        const lines = content.split('\n').length;

        validNewBlocks.push({
          element: el,
          elementId: id,
          content,
          language,
          lines,
          size: content.length,
          timestamp: Date.now()
        });

        this.totalDetected++;
        this.lastDetectedAt = Date.now();
      }

      if (validNewBlocks.length > 0) {
        if (this.options.onNewCode) {
          this.options.onNewCode({
            newBlocks: validNewBlocks,
            timestamp: Date.now(),
            source: 'live_scan'
          });
        }

        if (this.options.onUpdate) {
          this.options.onUpdate({
            type: 'new_code_detected',
            blockCount: validNewBlocks.length,
            blocks: validNewBlocks
          });
        }
      }
    }

    _getElementId(element) {
      if (element.id) return `id_${element.id}`;

      const dataAttrs = ['data-message-id', 'data-block-id', 'data-code-id', 'data-response-id'];
      for (const attr of dataAttrs) {
        const val = element.getAttribute(attr);
        if (val) return `${attr}_${val}`;
      }

      const parent = element.parentElement;
      if (parent?.id) return `parent_${parent.id}_idx_${Array.from(parent.children).indexOf(element)}`;

      const contentPreview = (element.textContent || '').substring(0, 200);
      const hash = this._simpleHash(contentPreview);
      return `el_${element.tagName}_${this._getPositionIndex(element)}_${hash}`;
    }

    _getPositionIndex(element) {
      let index = 0;
      let sibling = element.previousElementSibling;
      while (sibling) {
        index++;
        sibling = sibling.previousElementSibling;
      }
      return index;
    }

    _isCodeBlockElement(node) {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;

      const tag = node.tagName?.toLowerCase();
      if (tag === 'pre' || tag === 'code') return true;

      const className = typeof node.className === 'string' ? node.className : '';
      const codeIndicators = ['code', 'hljs', 'highlight', 'code-block', 'syntax', 'prism', 'monaco'];
      if (codeIndicators.some(ind => className.includes(ind))) return true;

      try {
        if (node.querySelector?.('pre, code')) return true;
      } catch (e) { }

      const textContent = node.textContent || '';
      if (textContent.includes('\n') && textContent.length > 50) {
        const codePatterns = [
          /^(import |from |def |class |function |const |let |var )/m,
          /^(\/\/|#|\/\*|--|<!--)/m,
          /[{(]\s*\n.*\n\s*[)}]/s
        ];
        if (codePatterns.some(pattern => pattern.test(textContent))) return true;
      }

      return false;
    }

    _isStreamingComplete(node) {
      const className = typeof node.className === 'string' ? node.className.toLowerCase() : '';
      const streamingIndicators = ['streaming', 'typing', 'loading', 'generating', 'in-progress', 'animate'];
      if (streamingIndicators.some(ind => className.includes(ind))) {
        return false;
      }

      const dataState = node.getAttribute?.('data-state');
      if (dataState === 'streaming' || dataState === 'generating') return false;

      const spinner = node.querySelector?.('.spinner, .loading, .typing-indicator, [class*="loading"]');
      if (spinner) return false;

      const elementId = this._getElementId(node);
      const lastCheck = this._streamingCheckCache.get(elementId);
      const now = Date.now();

      if (lastCheck) {
        const contentHash = this._simpleHash((node.textContent || '').substring(0, 500));
        if (lastCheck.hash === contentHash && (now - lastCheck.time) < 500) {
          return false;
        }
        this._streamingCheckCache.set(elementId, { hash: contentHash, time: now });
      } else {
        const contentHash = this._simpleHash((node.textContent || '').substring(0, 500));
        this._streamingCheckCache.set(elementId, { hash: contentHash, time: now });
        return false;
      }

      if (this._streamingCheckCache.size > 100) {
        const entries = Array.from(this._streamingCheckCache.entries());
        this._streamingCheckCache.clear();
        entries.slice(-50).forEach(([k, v]) => this._streamingCheckCache.set(k, v));
      }

      return true;
    }

    _detectLanguage(element) {
      const className = typeof element.className === 'string' ? element.className : '';
      const langMatch = className.match(/language-(\w+)/);
      if (langMatch) return langMatch[1].toLowerCase();

      const dataLang = element.getAttribute?.('data-language');
      if (dataLang) return dataLang.toLowerCase();

      const parent = element.parentElement;
      if (parent) {
        const parentClass = typeof parent.className === 'string' ? parent.className : '';
        const parentLangMatch = parentClass.match(/language-(\w+)/);
        if (parentLangMatch) return parentLangMatch[1].toLowerCase();
      }

      return 'unknown';
    }

    _simpleHash(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(36);
    }

    _clearDebounce() {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
    }

    _logError(message) {
      console.error('[LiveScanner]', message);
      if (this.options.onError) {
        this.options.onError(new Error(message));
      }
    }

    destroy() {
      this.stop();
      this.scannedElementIds.clear();
      this._streamingCheckCache.clear();
      this.options.onNewCode = null;
      this.options.onUpdate = null;
      this.options.onError = null;
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { LiveScanner: window.LiveScanner };
}
