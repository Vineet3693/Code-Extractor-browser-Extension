// ============================================
// Scan Module - Page scanning and results handling
// ============================================

// Main scan function
async function startScan(isSelection) {
  showStatus('Scanning page...');

  try {
    // Step 1: Identify Target Tab
    let tab = null;
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      tab = activeTab;
      console.log('[Scan] Primary tab:', tab?.id, tab?.url);
    } catch (e) {
      console.warn('[Scan] Primary tab query failed:', e);
    }

    // Fallback: find AI chat tab
    if (!tab || !tab.id || !tab.url || tab.url.startsWith('chrome://')) {
      console.log('[Scan] Attempting fallback tab detection...');
      const allTabs = await chrome.tabs.query({
        url: [
          "*://chatgpt.com/*",
          "*://chat.openai.com/*",
          "*://claude.ai/*",
          "*://gemini.google.com/*",
          "*://*.outlier.ai/*"
        ]
      });

      if (allTabs.length > 0) {
        tab = allTabs[0];
        console.log('[Scan] Fallback matched tab:', tab.id, tab.url);
      }
    }

    if (!tab || !tab.id) {
      throw new Error('No active AI chat tab detected. Please open ChatGPT, Claude, or Outlier.');
    }

    console.log(`[Scan] Final target: Tab ${tab.id} (${tab.url})`);

    // Step 2: Connection Handshake with retries
    const handshakeOk = await performHandshakeWithRetry(tab.id);
    if (!handshakeOk) {
      throw new Error('Failed to connect to page after multiple attempts.');
    }

    // Step 3: Clear existing highlights
    safeSendMessageToTab(tab.id, { action: 'CLEAR_HIGHLIGHTS' }).catch(() => {});

    // Step 4: Get global hashes for duplicate detection
    let globalHashes = [];
    if (dbHelper) {
      try {
        const seenFiles = await dbHelper.query('files', 'by_project', 'global_dedup');
        globalHashes = seenFiles.map(f => f.hash).filter(Boolean);
      } catch (e) { }
    }

    // Step 5: Perform the scan
    const action = isSelection ? 'SCAN_SELECTION' : 'SCAN_PAGE';
    const response = await safeSendMessageToTab(tab.id, { 
      action, 
      data: { globalHashes } 
    });

    if (response && response.success) {
      // Show results in Scan tab
      switchTab('scan');
      scanResults = response.data;
      
      if (response.data.duplicateReport?.conflicts?.length > 0) {
        handleScanConflicts(scanResults, response.data.duplicateReport.conflicts);
      } else {
        showResults(response.data);
        updateFilesTab(response.data.files || []);
        saveGlobalHashes(response.data.files || []);
      }

      // High visibility toggle
      if (highVisibilityToggle && highVisibilityToggle.checked && response.data.project) {
        safeSendMessageToTab(tab.id, {
          action: 'HIGHLIGHT_BLOCKS',
          data: {
            blocks: response.data.project.files?.map(f => ({ element: f.element })) || [],
            headings: response.data.project.headings || []
          }
        }).catch(() => {});
      }
      
      // Note: Do NOT auto-save to projects - only explicit save
      showStatus('Scan complete! ' + (response.data.files?.length || 0) + ' files found.');
    } else {
      showError(response?.error || 'Scan returned no results. Check if the page is fully loaded.');
    }
  } catch (error) {
    console.error('[Scan] Critical failure:', error);
    showError(error.message || 'Failed to connect. Try refreshing the page.');
  }
}

// Handle scan conflicts (duplicates)
function handleScanConflicts(scanResults, conflicts) {
  console.log('[Scan] Handling conflicts:', conflicts.length);
  showResults(scanResults);
  updateFilesTab(scanResults.files || []);
  
  // Show conflict notification
  showStatus(`Scan complete with ${conflicts.length} potential duplicates. Review files in the Files tab.`);
}

// Save global hashes for duplicate detection
async function saveGlobalHashes(files) {
  if (!dbHelper || !files || files.length === 0) return;
  try {
    const items = files.map(f => ({
      id: f.hash || Date.now().toString(36) + Math.random().toString(36).substr(2),
      hash: f.hash,
      name: f.fileName || f.path,
      path: f.path || f.fileName,
      language: f.language,
      projectId: 'global_dedup'
    })).filter(item => item.hash);

    for (const item of items) {
      await dbHelper.update('files', item);
    }
  } catch (e) {
    console.warn('[Scan] Failed to save global hashes:', e);
  }
}

// Merge tabs functionality
async function mergeTabs() {
  showStatus('Merging tabs...');
  try {
    const response = await chrome.runtime.sendMessage({ action: 'MERGE_TABS' });
    if (response?.success?.merged) {
      scanResults = {
        project: {
          name: 'merged-project',
          files: response.success.merged.files || [],
          totalFiles: response.success.merged.totalFiles,
          totalLines: response.success.merged.totalLines,
          totalSize: response.success.merged.totalSize
        },
        files: response.success.merged.files || [],
        summary: {
          totalFiles: response.success.merged.totalFiles,
          totalLines: response.success.merged.totalLines,
          totalSize: response.success.merged.totalSize
        }
      };
      showResults(scanResults);
      updateFilesTab(scanResults.files || []);
      switchTab('scan');
      showStatus('Merged ' + response.success.sourceTabs + ' tabs!');
    } else {
      showError(response?.error || 'No projects found in other tabs');
    }
  } catch (error) {
    console.error('[Scan] Merge tabs failed:', error);
    showError('Failed to merge tabs: ' + error.message);
  }
}