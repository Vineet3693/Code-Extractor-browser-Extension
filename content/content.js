(function () {
  'use strict';

  let codeScanner = null;
  let currentParser = null;
  let isScanning = false;
  let liveScanner = null;
  let scanStateManager = null;
  let incrementalMerger = null;
  let tabManager = null;
  let liveScanEnabled = true;
  let currentScanResults = null;

  // Lightweight conversation extractor: scans common chat message containers on the page
  function extractConversationFromDom() {
    const messages = [];
    const selectors = [
      '.chat-message', // common Chat UI
      '.message', '.msg', '[data-testid="message"]',
      '.conversation__message', '.message-bubble'
    ];
    const nodes = [];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(n => nodes.push(n));
    });
    const seen = new Set();
    nodes.forEach(n => {
      if (!n) return;
      const text = (n.innerText || n.textContent || '').trim();
      if (!text) return;
      const key = text + '|' + (n.className || '');
      if (seen.has(key)) return;
      seen.add(key);
      const cls = (n.className || '').toLowerCase();
      const author =
        /user|sender|from-user/i.test(cls) ? 'User' :
        /assistant|bot|reply|conversational/i.test(cls) ? 'Assistant' : 'Unknown';
      messages.push({ author, text });
    });
    if (messages.length === 0) {
      const all = document.body.innerText || '';
      if (all) {
        messages.push({ author: 'Unknown', text: all.trim() });
      }
    }
    return messages;
  }

  function init() {
    if (typeof getParser !== 'undefined') {
      currentParser = getParser(window.location.href);
      codeScanner = new CodeScanner();
      codeScanner.setParser(currentParser);
    }

    scanStateManager = new ScanStateManager();
    incrementalMerger = new IncrementalMerger({
      fileNameDetector: codeScanner?.fileNameDetector,
      languageIdentifier: codeScanner?.languageIdentifier
    });
    tabManager = new TabManager();

    setupMessageListener();
    injectStyles();
    setupHighlightObserver();
    loadSettings().then(() => {
      if (liveScanEnabled) {
        startLiveScanner();
      }
    });
  }

  async function loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_SETTINGS' });
      if (response.success && response.data) {
        liveScanEnabled = response.data.liveScan?.enabled ?? true;
      }
    } catch (e) {
      console.warn('[content] Failed to load settings:', e);
    }
  }

  function startLiveScanner() {
    if (!currentParser || !codeScanner) return;

    liveScanner = new LiveScanner({
      debounceMs: 500,
      parser: currentParser,
      scanState: scanStateManager,
      onNewCode: handleNewCodeDetected,
      onError: (error) => {
        console.error('[content] Live scanner error:', error);
      }
    });

    liveScanner.start();
  }

  async function handleNewCodeDetected({ newBlocks, timestamp, source }) {
    if (!currentScanResults || !codeScanner) return;

    try {
      const mergerResult = incrementalMerger.merge(currentScanResults.project, newBlocks);

      if (mergerResult.addedFiles.length > 0 || mergerResult.updatedFiles.length > 0) {
        currentScanResults.project = mergerResult.updatedProject;
        currentScanResults.files = mergerResult.updatedProject.files;

        if (scanStateManager) {
          for (const file of mergerResult.addedFiles) {
            scanStateManager.recordFileAdded(file.fileName, file.path, file.content, file.language);
          }
          for (const file of mergerResult.updatedFiles) {
            scanStateManager.recordFileUpdated(file.fileName, file.path, file.previousContent, file.content, file.updateType);
          }
        }

        chrome.runtime.sendMessage({
          action: 'LIVE_SCAN_UPDATE',
          data: {
            addedFiles: mergerResult.addedFiles,
            updatedFiles: mergerResult.updatedFiles,
            conflicts: mergerResult.conflicts,
            summary: mergerResult.summary,
            project: mergerResult.updatedProject,
            timestamp
          }
        }).catch(() => { });

        if (mergerResult.addedFiles.length > 0) {
          showLiveScanNotification(mergerResult.addedFiles);
        }
      }
  } catch (error) {
      // Guard against extension context invalidation or content script timing issues
      console.error('[content] Live scan merge failed:', error);
      const msg = (error && error.message) ? String(error.message).toLowerCase() : '';
      if (msg.includes('extension context') || msg.includes('context invalidated')) {
        // Silently swallow to avoid crashing the page script; the live scan may be momentarily unstable
        return;
      }
      // Otherwise, log for debugging and continue
  }
  }

  function showLiveScanNotification(addedFiles) {
    const names = addedFiles.map(f => f.fileName || f.path).join(', ');
    const notification = document.createElement('div');
    notification.id = 'code-extractor-live-notification';
    notification.className = 'code-extractor-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">📦</span>
        <div class="notification-text">
          <strong>New code detected!</strong>
          <span class="notification-files">${escapeHtml(names)}</span>
        </div>
        <button class="notification-close">&times;</button>
      </div>
    `;

    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.remove();
    });

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }


  let highlightObserver = null;
  let activeHighlights = { blocks: [], headings: [] };

  function setupHighlightObserver() {
    if (highlightObserver) highlightObserver.disconnect();

    highlightObserver = new MutationObserver((mutations) => {
      if (activeHighlights.blocks.length === 0 && activeHighlights.headings.length === 0) return;
      reapplyHighlights();
    });

    highlightObserver.observe(document.body, { childList: true, subtree: true });

    // Also handle scroll for virtualized lists
    window.addEventListener('scroll', () => {
      if (activeHighlights.blocks.length > 0 || activeHighlights.headings.length > 0) {
        reapplyHighlights();
      }
    }, { passive: true });
  }

  function reapplyHighlights() {
    // Re-verify and re-apply classes
    // Note: In virtualized lists, elements might be removed and re-added.
    // If the element is lost, we might need a more complex way to find it again,
    // but for now, we re-apply to visible elements that still exist.
    activeHighlights.blocks.forEach(el => {
      if (el && document.contains(el)) {
        if (!el.classList.contains('code-extractor-highlight-active')) {
          el.classList.add('code-extractor-highlight-active');
        }
      }
    });
    activeHighlights.headings.forEach(el => {
      if (el && document.contains(el)) {
        if (!el.classList.contains('code-extractor-heading-active')) {
          el.classList.add('code-extractor-heading-active');
        }
      }
    });

    // Strategy for virtualized lists: If elements were replaced, 
    // the previous 'el' might be disconnected.
    // We can try to re-find them by scanning the page again if specifically requested, 
    // but it's resource intensive. For now, this fixes basic scrolling.
  }

  function handleHighlightBlocks(data, sendResponse) {
    try {
      const blocks = data.blocks || [];
      const headings = data.headings || [];

      // Update active highlights
      activeHighlights.blocks = blocks.map(b => b.element).filter(el => !!el);
      activeHighlights.headings = headings.map(h => h.element).filter(el => !!el);

      reapplyHighlights();
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  function handleClearHighlights(sendResponse) {
    try {
      document.querySelectorAll('.code-extractor-highlight-active, .code-extractor-heading-active').forEach(el => {
        el.classList.remove('code-extractor-highlight-active', 'code-extractor-heading-active');
      });
      activeHighlights = { blocks: [], headings: [] };
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const { action, data } = message;

      switch (action) {
        case 'PING':
          sendResponse({ success: true, version: '3.0.0' });
          return true;

        case 'SCAN_PAGE':
          handleScanPage(data, sendResponse);
          return true;

        case 'SCAN_SELECTION':
          handleScanSelection(data, sendResponse);
          return true;

        case 'GENERATE_ZIP':
          handleGenerateZip(data, sendResponse);
          return true;

        case 'HIGHLIGHT_BLOCKS':
          handleHighlightBlocks(data, sendResponse);
          return true;

        case 'CLEAR_HIGHLIGHTS':
          handleClearHighlights(sendResponse);
          return true;

        case 'STOP_HIGHLIGHT':
          handleStopHighlight(sendResponse);
          return true;

        case 'TOGGLE_LIVE_SCAN':
          handleToggleLiveScan(data, sendResponse);
          return true;

        case 'TAB_MANAGER_PING':
          handleTabManagerPing(data, sendResponse);
          return true;

        case 'TAB_MANAGER_REQUEST_PROJECT':
          handleTabManagerRequestProject(data, sendResponse);
          return true;

        case 'TAB_MANAGER_PROJECT_UPDATE':
          handleTabManagerProjectUpdate(data, sendResponse);
          return true;

        case 'CODE_VALIDATE':
          handleCodeValidate(data, sendResponse);
          return true;

        case 'EXTRACT_CONVERSATION':
          try {
            const conv = extractConversationFromDom();
            sendResponse({ success: true, data: conv });
          } catch (e) {
            sendResponse({ success: false, error: e.message });
          }
          return true;

        case 'DUPLICATE_DETECT':
          handleDuplicateDetect(data, sendResponse);
          return true;

        case 'UPDATE_VISIBILITY':
          handleHighlightBlocks(data, sendResponse);
          return true;

        case 'TAB_MANAGER_REGISTER':
          if (tabManager) {
            tabManager.activeTabs.set(data.tabId, {
              id: data.tabId,
              url: data.url,
              title: data.title,
              registeredAt: data.registeredAt,
              lastHeartbeat: Date.now(),
              isAlive: true
            });
          }
          sendResponse({ success: true });
          return true;

        default:
          return false;
      }
    });
  }

  async function handleScanPage(data, sendResponse) {
    if (isScanning) {
      sendResponse({ success: false, error: 'Scan already in progress' });
      return;
    }

    isScanning = true;

    try {
      if (!codeScanner) {
        currentParser = getParser(window.location.href);
        codeScanner = new CodeScanner();
        codeScanner.setParser(currentParser);
      }

      if (scanStateManager) {
        scanStateManager.startSession();
        scanStateManager.markInitialScanComplete();
      }

      const options = {
        fullScan: true,
        highlightBlocks: data?.highlightBlocks ?? true,
        duplicateStrategy: data?.duplicateStrategy || 'latest',
        includeReadme: data?.includeReadme !== false,
        includeGitignore: data?.includeGitignore !== false,
        includeDependencies: data?.includeDependencies !== false,
        projectName: data?.projectName,
        globalHashes: data?.globalHashes || []
      };

      const results = await codeScanner.scanPage(options);

      const projectFileMap = new Map();
      (results.project?.files || []).forEach(f => {
        projectFileMap.set(f.path, f);
        projectFileMap.set(f.fileName, f);
      });

      const enrichedFiles = (results.files || []).map(f => {
        const match = projectFileMap.get(f.path) || projectFileMap.get(f.fileName);
        return { ...f, content: match?.content || null };
      });

      currentScanResults = {
        summary: results.summary,
        files: enrichedFiles,
        project: results.project,
        site: currentParser.getSiteName()
      };

      if (scanStateManager) {
        scanStateManager.takeSnapshot(results.project);
      }

      sendResponse({
        success: true,
        data: currentScanResults
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
        site: currentParser?.getSiteName() || 'Unknown'
      });
    } finally {
      isScanning = false;
    }
  }

  async function handleScanSelection(data, sendResponse) {
    if (isScanning) {
      sendResponse({ success: false, error: 'Scan already in progress' });
      return;
    }

    isScanning = true;

    try {
      if (!codeScanner) {
        currentParser = getParser(window.location.href);
        codeScanner = new CodeScanner();
        codeScanner.setParser(currentParser);
      }

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        sendResponse({ success: false, error: 'No selection found' });
        return;
      }

      const selectedElements = [];
      for (let i = 0; i < selection.rangeCount; i++) {
        const range = selection.getRangeAt(i);
        const container = range.commonAncestorContainer;
        const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
        if (element) {
          const codeElements = element.querySelectorAll('pre, code');
          codeElements.forEach(el => selectedElements.push(el));
        }
      }

      if (selectedElements.length === 0) {
        sendResponse({ success: false, error: 'No code elements in selection' });
        return;
      }

      const blocks = codeScanner.extractor.extractSelected(selectedElements);
      const blocksWithNames = codeScanner.fileNameDetector.detectAll(blocks);
      const blocksWithLangs = codeScanner.languageIdentifier.identifyAll(blocksWithNames);

      sendResponse({
        success: true,
        data: {
          blocks: blocksWithLangs,
          count: blocksWithLangs.length,
          site: currentParser.getSiteName()
        }
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
        site: currentParser?.getSiteName() || 'Unknown'
      });
    } finally {
      isScanning = false;
    }
  }

  async function handleGenerateZip(data, sendResponse) {
    try {
      if (!codeScanner) {
        sendResponse({ success: false, error: 'No scan results available' });
        return;
      }

      const zipFiles = codeScanner.getProjectForZip();
      const zip = new JSZip();

      for (const [path, content] of Object.entries(zipFiles)) {
        zip.file(path, content);
      }

      const compressionLevel = data?.compressionLevel || 'default';
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: compressionLevel === 'high' ? 9 : compressionLevel === 'low' ? 1 : 5 }
      });

      const projectName = data?.projectName || 'extracted-project';
      const fileName = `${projectName}.zip`;

      const url = URL.createObjectURL(blob);
      chrome.runtime.sendMessage({
        action: 'DOWNLOAD_FILE',
        data: { url, fileName, mimeType: 'application/zip' }
      });

      sendResponse({ success: true, fileName, size: blob.size });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  function handleStopHighlight(sendResponse) {
    try {
      if (codeScanner) {
        codeScanner.stopHighlight();
      }
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  function handleToggleLiveScan(data, sendResponse) {
    try {
      if (data?.enabled) {
        if (!liveScanner) {
          startLiveScanner();
        } else {
          liveScanner.resume();
        }
      } else {
        if (liveScanner) {
          liveScanner.pause();
        }
      }
      liveScanEnabled = data?.enabled ?? false;
      sendResponse({ success: true, enabled: liveScanEnabled });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  function handleTabManagerPing(data, sendResponse) {
    sendResponse({
      success: true,
      registeredAt: Date.now(),
      projectData: currentScanResults?.project || null
    });
  }

  function handleTabManagerRequestProject(data, sendResponse) {
    sendResponse({
      success: true,
      project: currentScanResults?.project || null
    });
  }

  function handleTabManagerProjectUpdate(data, sendResponse) {
    console.log('[content] Received project update from tab:', data.fromTab);
    sendResponse({ success: true });
  }

  function handleCodeValidate(data, sendResponse) {
    try {
      const validator = new CodeValidator();
      const files = data.files || [];
      const results = [];

      for (const file of files) {
        const result = validator.validate(file);
        results.push(result);
      }

      const summary = validator.getValidationSummary(results);
      sendResponse({ success: true, results, summary });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  function handleDuplicateDetect(data, sendResponse) {
    try {
      const detector = new SmartDuplicateDetector({
        strategy: data.strategy || 'latest',
        similarityThreshold: data.similarityThreshold || 0.85
      });

      const result = detector.detectDuplicates(data.files || []);
      sendResponse({ success: true, result });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'code-extractor-styles';
    style.textContent = `
      .code-extractor-highlight-active {
        outline: 2px solid #4CAF50 !important;
        outline-offset: 2px !important;
        position: relative !important;
        transition: outline 0.3s ease;
      }
      .code-extractor-heading-active {
        outline: 2px solid #F44336 !important;
        outline-offset: 2px !important;
        position: relative !important;
        transition: outline 0.3s ease;
      }
      .code-extractor-highlight-active::after {
        content: 'EXTRACTED CODE';
        position: absolute;
        top: -18px;
        left: 0;
        background: #4CAF50;
        color: white;
        padding: 0px 6px;
        font-size: 9px;
        font-weight: bold;
        border-radius: 2px;
        z-index: 10000;
        pointer-events: none;
      }
      .code-extractor-heading-active::after {
        content: 'PROJECT MARKER';
        position: absolute;
        top: -18px;
        left: 0;
        background: #F44336;
        color: white;
        padding: 0px 6px;
        font-size: 9px;
        font-weight: bold;
        border-radius: 2px;
        z-index: 10000;
        pointer-events: none;
      }
      .code-extractor-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #1e1e1e;
        color: #fff;
        border: 1px solid #4CAF50;
        border-radius: 8px;
        padding: 12px 16px;
        z-index: 100000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideInRight 0.3s ease-out;
        max-width: 400px;
      }
      .code-extractor-notification .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .code-extractor-notification .notification-icon {
        font-size: 20px;
      }
      .code-extractor-notification .notification-text {
        flex: 1;
      }
      .code-extractor-notification .notification-text strong {
        display: block;
        margin-bottom: 4px;
      }
      .code-extractor-notification .notification-files {
        font-size: 12px;
        color: #aaa;
      }
      .code-extractor-notification .notification-close {
        background: none;
        border: none;
        color: #fff;
        font-size: 18px;
        cursor: pointer;
        padding: 0 4px;
      }
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .code-extractor-shortcut-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.85);
        color: white;
        z-index: 1000000;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        backdrop-filter: blur(4px);
        animation: fadeIn 0.2s ease-out;
      }
      .code-extractor-shortcut-content {
        background: #1e1e1e;
        padding: 40px;
        border-radius: 12px;
        border: 1px solid #333;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      }
      .code-extractor-shortcut-content h2 {
        margin: 0 0 24px 0;
        color: #4CAF50;
        font-size: 24px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .shortcut-grid {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 16px;
        margin-bottom: 24px;
      }
      .shortcut-item {
        display: contents;
      }
      .shortcut-label {
        color: #aaa;
        font-size: 14px;
      }
      .shortcut-key {
        background: #333;
        color: #fff;
        padding: 4px 10px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 13px;
        border-bottom: 2px solid #000;
      }
      .shortcut-footer {
        text-align: center;
        color: #666;
        font-size: 12px;
        margin-top: 20px;
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
    if (!document.getElementById('code-extractor-styles')) {
      (document.head || document.documentElement).appendChild(style);
    }
  }

  function showShortcutOverlay() {
    if (document.getElementById('code-extractor-shortcut-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'code-extractor-shortcut-overlay';
    overlay.className = 'code-extractor-shortcut-overlay';

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmd = isMac ? '⌘' : 'Ctrl';
    const shift = isMac ? '⇧' : 'Shift';

    overlay.innerHTML = `
      <div class="code-extractor-shortcut-content">
        <h2>⌨️ Keyboard Shortcuts</h2>
        <div class="shortcut-grid">
          <div class="shortcut-item">
            <span class="shortcut-label">Open Side Panel</span>
            <span class="shortcut-key">${cmd} + ${shift} + E</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-label">Scan Page for Code</span>
            <span class="shortcut-key">${cmd} + ${shift} + S</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-label">Toggle Live Scanning</span>
            <span class="shortcut-key">${cmd} + ${shift} + L</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-label">Universal Search</span>
            <span class="shortcut-key">${cmd} + ${shift} + F</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-label">Toggle This Overlay</span>
            <span class="shortcut-key">?</span>
          </div>
        </div>
        <div class="shortcut-footer">Press any key to close</div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeOverlay = () => {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.2s ease-out';
      setTimeout(() => overlay.remove(), 200);
      window.removeEventListener('keydown', closeOverlay);
      window.removeEventListener('click', closeOverlay);
    };

    setTimeout(() => {
      window.addEventListener('keydown', (e) => {
        if (e.key !== '?') closeOverlay();
      });
      window.addEventListener('click', closeOverlay);
    }, 100);
  }

  // Add keyboard listener for '?'
  window.addEventListener('keydown', (e) => {
    if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      showShortcutOverlay();
    }
  });

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
