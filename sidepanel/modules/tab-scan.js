// ============================================================
// tab-scan.js — Scan Tab: scanning, results, conflicts, save
// ============================================================

async function startScan(isSelection) {
    showStatus('Scanning page...');
    try {
        let tab = null;
        try {
            const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            tab = activeTab;
        } catch (e) { console.warn('[Scan] Primary tab query failed:', e); }

        if (!tab || !tab.id || !tab.url || tab.url.startsWith('chrome://')) {
            const allTabs = await chrome.tabs.query({
                url: ["*://chatgpt.com/*", "*://chat.openai.com/*", "*://claude.ai/*", "*://gemini.google.com/*", "*://*.outlier.ai/*"]
            });
            if (allTabs.length > 0) tab = allTabs[0];
        }

        if (!tab || !tab.id) throw new Error('No active AI chat tab detected. Please open ChatGPT, Claude, or Outlier.');

        console.log('[Scan] Starting scan handshake for tab:', tab.id);
        const handshakeSuccess = await performHandshakeWithRetry(tab.id);
        if (!handshakeSuccess) {
            console.error('[Scan] Handshake failed');
            showError('Connection failed. Refresh the chat page and try again.');
            return;
        }

        console.log('[Scan] Sending scan action:', isSelection ? 'SCAN_SELECTION' : 'SCAN_PAGE');
        safeSendMessageToTab(tab.id, { action: 'CLEAR_HIGHLIGHTS' }).catch(() => { });

        let globalHashes = [];
        if (CE.dbHelper) {
            try {
                const seenFiles = await CE.dbHelper.query('files', 'by_project', 'global_dedup');
                globalHashes = seenFiles.map(f => f.hash).filter(Boolean);
            } catch (e) { }
        }

        const action = isSelection ? 'SCAN_SELECTION' : 'SCAN_PAGE';
        const response = await safeSendMessageToTab(tab.id, { action, data: { globalHashes } });

        if (response && response.success) {
            switchTab('scan');
            CE.scanResults = response.data;
            if (response.data.duplicateReport?.conflicts?.length > 0) {
                handleScanConflicts(CE.scanResults, response.data.duplicateReport.conflicts);
            } else {
                // Auto-merge broken code blocks if enabled in settings
                const settings = await chrome.storage.local.get('auto_merge_blocks');
                if (settings.auto_merge_blocks !== false && typeof autoMergeSplitBlocks === 'function') {
                    console.log('[Scan] Applying smart merge for split blocks...');
                    response.data.files = autoMergeSplitBlocks(response.data.files || []);
                }

                showResults(response.data);
                updateFilesTab(response.data.files || []);
                saveGlobalHashes(response.data.files || []);

                const hvToggle = document.getElementById('high-visibility-toggle');
                if (hvToggle && hvToggle.checked && response.data.project) {
                    safeSendMessageToTab(tab.id, {
                        action: 'HIGHLIGHT_BLOCKS',
                        data: {
                            blocks: response.data.project.files?.map(f => ({ element: f.element })) || [],
                            headings: response.data.project.headings || []
                        }
                    }).catch(() => { });
                }
            }
        } else {
            showError(response?.error || 'Scan returned no results. Check if the page is fully loaded.');
        }
    } catch (error) {
        showError(error.message || 'Failed to connect. Try refreshing the page.');
    }
}

async function mergeTabs() {
    showStatus('Discovering tabs and merging projects...');
    try {
        const response = await chrome.runtime.sendMessage({ action: 'MERGE_TABS' });
        if (response.success) {
            CE.scanResults = {
                project: response.merged,
                files: response.merged.files || [],
                summary: {
                    totalFiles: response.merged.totalFiles,
                    totalLines: response.merged.totalLines,
                    totalSize: response.merged.totalSize,
                    duplicates: 0
                }
            };
            showResults(CE.scanResults);
            updateFilesTab(CE.scanResults.files);
            showStatus(`Merged ${response.sourceTabs} tabs successfully!`);
            setTimeout(hideStatus, 3000);
        } else {
            showError(response.error || 'Merge failed');
        }
    } catch (error) {
        showError('Failed to merge tabs: ' + error.message);
    }
}

function handleScanConflicts(scanData, conflicts) {
    CE.conflictScanData = scanData;
    CE.conflictList = conflicts;
    CE.currentConflictIndex = 0;
    const wrapper = document.getElementById('duplicate-diff-content-wrapper');
    if (!CE.duplicateDiffViewerInst && typeof CodeDiffViewer !== 'undefined' && wrapper) {
        CE.duplicateDiffViewerInst = new CodeDiffViewer(wrapper);
    }
    showNextConflict();
}

function showNextConflict() {
    const modal = document.getElementById('duplicate-diff-modal');
    if (CE.currentConflictIndex >= CE.conflictList.length) {
        if (modal) modal.classList.add('hidden');
        if (CE.duplicateDiffViewerInst) CE.duplicateDiffViewerInst.clear();
        saveGlobalHashes(CE.conflictScanData?.files || []);
        showResults(CE.conflictScanData);
        updateFilesTab(CE.conflictScanData.files || []);
        saveProject();
        return;
    }
    const conflict = CE.conflictList[CE.currentConflictIndex];
    const oldFile = conflict.files[0];
    const newFile = conflict.files[conflict.files.length - 1];
    const oldCode = oldFile?.content || oldFile?.code || conflict.existing?.content || '';
    const newCode = newFile?.content || newFile?.code || conflict.newFile?.content || '';
    const fileName = conflict.path || oldFile?.fileName || 'unknown.js';
    const msgEl = document.getElementById('duplicate-diff-message');
    if (msgEl) msgEl.textContent = `Conflict for "${fileName}". Review ${CE.currentConflictIndex + 1} of ${CE.conflictList.length}:`;
    if (modal) modal.classList.remove('hidden');
    if (CE.duplicateDiffViewerInst) {
        const diffArray = CE.duplicateDiffViewerInst.computeDiff(oldCode, newCode);
        CE.duplicateDiffViewerInst.renderDiff({ fileName, diff: diffArray });
    }
}

function resolveConflict(choice) {
    const conflict = CE.conflictList[CE.currentConflictIndex];
    if (!conflict) return;
    const oldFile = conflict.files ? conflict.files[0] : conflict.existing;
    const newFile = conflict.files ? conflict.files[conflict.files.length - 1] : conflict.newFile;
    const oldCode = oldFile?.content || oldFile?.code || '';
    const newCode = newFile?.content || newFile?.code || '';
    let chosenContent = choice === 'old' ? oldCode : choice === 'new' ? newCode : oldCode + '\n' + newCode;
    const targetPath = conflict.path || oldFile?.fileName;
    if (CE.conflictScanData.project?.files) {
        for (const f of CE.conflictScanData.project.files) {
            if (f.path === targetPath || f.name === targetPath) { f.content = chosenContent; break; }
        }
    }
    if (CE.conflictScanData.files) {
        for (const f of CE.conflictScanData.files) {
            if (f.path === targetPath || f.fileName === targetPath) { f.content = chosenContent; f.code = chosenContent; break; }
        }
    }
    CE.currentConflictIndex++;
    showNextConflict();
}

function showResults(data) {
    console.log('[Scan] showResults called with:', data);
    hideStatus(); hideError();
    if (!data) {
        console.warn('[Scan] showResults called with null data');
        return;
    }
    const summary = data.summary || data.project?.summary || {};
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    console.log('[Scan] Populating summary stats...');
    set('total-files', (summary.totalFiles || summary.files || 0).toLocaleString());
    set('total-lines', (summary.totalLines || summary.lines || 0).toLocaleString());
    set('total-size', formatBytes(summary.totalSize || summary.size || 0));
    set('duplicates', (summary.duplicates || 0).toLocaleString());
    set('total-tokens', (summary.tokens || 0).toLocaleString());

    const scanResultsDiv = document.getElementById('scan-results');
    if (scanResultsDiv) scanResultsDiv.classList.remove('hidden');
    const valResults = document.getElementById('validation-results');
    if (valResults) valResults.classList.add('hidden');
    const projectTreeContainer = document.getElementById('project-tree-container');
    if (projectTreeContainer) { projectTreeContainer.classList.remove('hidden'); projectTreeContainer.style.display = ''; }

    const projectTree = document.getElementById('project-tree');
    if (projectTree && data.project) {
        projectTree.innerHTML = '';
        const files = data.files || [];
        if (!files.length) {
            projectTree.innerHTML = '<p class="empty-state">No files extracted.</p>';
        } else {
            const asciiTree = buildASCIITree(files);
            const treePre = document.createElement('pre');
            treePre.className = 'ce-tree-fallback';
            treePre.style.cssText = 'margin:0;font-size:13px;font-family:Consolas,monospace;line-height:1.5';
            treePre.textContent = asciiTree;
            projectTree.appendChild(treePre);
            try {
                const treeData = buildProjectTree(files);
                const visualizer = new TreeVisualizer();
                const treeHtml = visualizer.toHTML(treeData, { clickable: true, expandable: true, showIcons: true });
                if (treeHtml && treeHtml.children && treeHtml.children.length > 0) {
                    projectTree.innerHTML = '';
                    projectTree.appendChild(treeHtml);
                    const fileList = document.getElementById('file-list');
                    projectTree.addEventListener('ce-tree-file-click', (e) => {
                        const { path } = e.detail;
                        document.querySelector('[data-tab="files"]')?.click();
                        setTimeout(() => {
                            const fileEl = Array.from(fileList?.querySelectorAll('.file-name') || [])
                                .find(el => el.textContent.includes(path))?.closest('.file-item');
                            if (fileEl) {
                                fileEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                if (!fileEl.classList.contains('file-item-open')) fileEl.querySelector('.file-item-header')?.click();
                                fileEl.style.boxShadow = '0 0 0 2px var(--accent)';
                                setTimeout(() => fileEl.style.boxShadow = '', 2000);
                            }
                        }, 300);
                    });
                }
            } catch (e) { console.warn('[Scan] TreeVisualizer failed:', e); }
        }
    }
}

async function saveProject() {
    if (!CE.scanResults) return;
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'SAVE_PROJECT',
            data: {
                name: CE.scanResults.project?.name || 'extracted-project',
                sourceUrl: CE.scanResults.summary?.url || window.location.href,
                files: CE.scanResults.files || [],
                summary: CE.scanResults.summary
            }
        });
        if (response.success) {
            const projectId = response.data?.id || Date.now().toString(36);
            if (CE.versionHistory && CE.scanResults.files) {
                try {
                    await CE.versionHistory.saveBatchVersions(CE.scanResults.files.map(f => ({
                        projectId, fileName: f.fileName || f.path || 'unknown',
                        filePath: f.path || f.fileName || 'unknown', content: f.content || '',
                        metadata: { changeType: 'initial_scan', changeDescription: 'Initial project scan', source: 'code_extractor' }
                    })));
                } catch (e) { console.error('[Scan] Version save failed:', e); }
            }
            if (CE.universalSearch) { try { await CE.universalSearch.reindex(); } catch (e) { } }
            if (CE.currentSettings.autoGenerateReadme !== false && CE.scanResults.project) {
                try {
                    const readmeContent = new ReadmeGenerator().generate({
                        name: CE.scanResults.project.name || 'extracted-project',
                        files: CE.scanResults.files || [],
                        tree: buildProjectTree(CE.scanResults.files || []),
                        metadata: { sourceSiteName: CE.scanResults.site || 'Unknown', extractedAt: new Date().toISOString(), sourceURL: CE.scanResults.summary?.url || '' }
                    });
                    CE.scanResults.files.push({ fileName: 'README.md', path: 'README.md', content: readmeContent, language: 'markdown', lines: readmeContent.split('\n').length, size: new Blob([readmeContent]).size, isAutoGenerated: true });
                } catch (e) { }
            }
            showStatus('Project saved!');
            loadAnalytics();
            setTimeout(hideStatus, 2000);
        } else {
            showError(response.error || 'Save failed');
        }
    } catch (error) {
        showError('Failed to save project');
    }
}

async function saveGlobalHashes(files) {
    if (!CE.dbHelper || !files || !files.length) return;
    try {
        const items = files.map(f => ({
            id: f.hash || Date.now().toString(36) + Math.random().toString(36).substr(2),
            hash: f.hash, name: f.fileName || f.path, path: f.path || f.fileName,
            language: f.language, projectId: 'global_dedup'
        })).filter(item => item.hash);
        for (const item of items) await CE.dbHelper.update('files', item);
    } catch (e) { console.warn('[Scan] Failed to save global hashes:', e); }
}

async function validateCode() {
    const scanResults = CE.scanResults;
    if (!scanResults || !scanResults.files) { showError('No files to validate. Scan a page first.'); return; }
    try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab) return;
        const response = await safeSendMessageToTab(tab.id, { action: 'CODE_VALIDATE', data: { files: scanResults.files } });
        if (response && response.success) {
            renderValidationResults(response.results || [], response.summary || { total: 0, valid: 0, invalid: 0, totalErrors: 0, totalWarnings: 0, passRate: '0%' });
        }
    } catch (error) {
        let totalErrors = 0, totalWarnings = 0;
        scanResults.files.forEach(file => {
            const v = validateSyntaxLocal(file.content || file.code || '', file.language);
            totalErrors += v.errors.length; totalWarnings += v.warnings.length;
        });
        const passRate = scanResults.files.length > 0
            ? Math.round(((scanResults.files.length - (totalErrors > 0 ? 1 : 0)) / scanResults.files.length) * 100) + '%' : '0%';
        renderValidationResults([], { total: scanResults.files.length, valid: totalErrors === 0 ? scanResults.files.length : 0, invalid: totalErrors > 0 ? 1 : 0, totalErrors, totalWarnings, passRate });
    }
}

function validateSyntaxLocal(code, language) {
    const results = { errors: [], warnings: [] };
    if (!code) return results;
    if (language === 'javascript' || language === 'typescript') {
        if ((code.match(/\{/g) || []).length !== (code.match(/\}/g) || []).length) results.errors.push({ line: 1, message: 'Unbalanced braces' });
        if ((code.match(/\(/g) || []).length !== (code.match(/\)/g) || []).length) results.errors.push({ line: 1, message: 'Unbalanced parentheses' });
    }
    return results;
}

function renderValidationResults(results, summary) {
    const validationResults = document.getElementById('validation-results');
    const validationSummary = document.getElementById('validation-summary');
    const validationDetails = document.getElementById('validation-details');
    if (!validationResults) return;
    validationResults.classList.remove('hidden');
    validationSummary.innerHTML = `
    <div class="validation-stat ${summary.invalid > 0 ? 'stat-error' : 'stat-success'}"><span class="stat-value">${summary.passRate}</span><span class="stat-label">Pass Rate</span></div>
    <div class="validation-stat"><span class="stat-value">${summary.valid}/${summary.total}</span><span class="stat-label">Files Valid</span></div>
    <div class="validation-stat stat-error"><span class="stat-value">${summary.totalErrors}</span><span class="stat-label">Errors</span></div>
    <div class="validation-stat stat-warning"><span class="stat-value">${summary.totalWarnings}</span><span class="stat-label">Warnings</span></div>
  `;
    validationDetails.innerHTML = '';
    results.forEach(result => {
        if (result.errors.length > 0 || result.warnings.length > 0) {
            const div = document.createElement('div');
            div.className = 'validation-file-result';
            div.innerHTML = `<h4>${escapeHtml(result.fileName)} <span class="lang-badge">${result.language}</span></h4>
        ${result.errors.map(e => `<div class="validation-error">❌ Line ${e.line || '?'}: ${escapeHtml(e.message)}</div>`).join('')}
        ${result.warnings.map(w => `<div class="validation-warning">⚠️ Line ${w.line || '?'}: ${escapeHtml(w.message)}</div>`).join('')}`;
            validationDetails.appendChild(div);
        }
    });
}

async function downloadConversation() {
    try {
        let conversation = CE.scanResults?.conversation || [];
        if (!conversation.length) {
            try {
                const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
                if (tab?.id) {
                    const resp = await safeSendMessageToTab(tab.id, { action: 'EXTRACT_CONVERSATION' });
                    if (resp?.success && resp.data) conversation = resp.data;
                }
            } catch (e) { }
        }
        if (!conversation.length) { showError('No conversation data available.'); return; }
        const md = conversation.map(c => `- ${c.author || 'User'}: ${c.text || c.message || ''}`).join('\n');
        const blob = new Blob([`# Conversation\n\n${md}`], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({ url, filename: `conversation-${Date.now()}.md`, saveAs: true }, () => URL.revokeObjectURL(url));
    } catch (err) {
        showError('Conversation download failed: ' + err.message);
    }
}
