(function () {
  'use strict';

  let scanResults = null;
  let currentView = 'initial';
  let selectedFileIndex = null;
  let unmappedBlocks = [];
  let historyPage = 0;
  const HISTORY_PAGE_SIZE = 5;

  const backBtn = document.getElementById('back-btn');
  const headerTitle = document.getElementById('header-title');
  const settingsToggle = document.getElementById('settings-toggle');
  const statusBar = document.getElementById('status-bar');
  const statusDot = statusBar.querySelector('.status-dot');
  const statusText = document.getElementById('status-text');

  const scanBtn = document.getElementById('scan-btn');
  const cancelScanBtn = document.getElementById('cancel-scan-btn');
  const downloadZipBtn = document.getElementById('download-zip-btn');
  const saveLibraryBtn = document.getElementById('save-library-btn');
  const rescanBtn = document.getElementById('rescan-btn');
  const recentProjectsBtn = document.getElementById('recent-projects-btn');
  const openSidepanelBtn = document.getElementById('open-sidepanel-btn');
  const loadMoreBtn = document.getElementById('load-more-btn');

  const progressFill = document.getElementById('progress-fill');
  const progressPercent = document.getElementById('progress-percent');
  const liveBlocks = document.getElementById('live-blocks');
  const liveTrees = document.getElementById('live-trees');
  const liveLangs = document.getElementById('live-langs');

  const projectNameEl = document.getElementById('project-name');
  const projectSourceEl = document.getElementById('project-source');
  const projectLangsEl = document.getElementById('project-langs');
  const projectTree = document.getElementById('project-tree');
  const unmappedWarning = document.getElementById('unmapped-warning');
  const unmappedCount = document.getElementById('unmapped-count');
  const viewUnmappedBtn = document.getElementById('view-unmapped-btn');

  const fileDetailName = document.getElementById('file-detail-name');
  const fileDetailPath = document.getElementById('file-detail-path');
  const fileDetailLang = document.getElementById('file-detail-lang');
  const fileDetailLines = document.getElementById('file-detail-lines');
  const fileDetailSize = document.getElementById('file-detail-size');
  const fileDetailConfidence = document.getElementById('file-detail-confidence');
  const codePreview = document.getElementById('code-preview').querySelector('code');
  const copyCodeBtn = document.getElementById('copy-code-btn');
  const renameFileBtn = document.getElementById('rename-file-btn');
  const removeFileBtn = document.getElementById('remove-file-btn');

  const historyList = document.getElementById('history-list');
  const historySearchInput = document.getElementById('history-search-input');
  const historyShowing = document.getElementById('history-showing');
  const historyTotal = document.getElementById('history-total');
  const recentCount = document.getElementById('recent-count');

  const unmappedList = document.getElementById('unmapped-list');
  const doneUnmappedBtn = document.getElementById('done-unmapped-btn');

  const exportDataBtn = document.getElementById('export-data-btn');
  const importDataBtn = document.getElementById('import-data-btn');
  const clearStorageBtn = document.getElementById('clear-storage-btn');
  const storageProjects = document.getElementById('storage-projects');
  const storageUsed = document.getElementById('storage-used');

  scanBtn.addEventListener('click', () => startScan(false));
  cancelScanBtn.addEventListener('click', cancelScan);
  downloadZipBtn.addEventListener('click', downloadZip);
  saveLibraryBtn.addEventListener('click', saveProject);
  rescanBtn.addEventListener('click', () => startScan(false));
  backBtn.addEventListener('click', goBack);
  settingsToggle.addEventListener('click', () => switchView('settings'));
  recentProjectsBtn.addEventListener('click', () => switchView('history'));
  openSidepanelBtn.addEventListener('click', openSidePanel);
  viewUnmappedBtn.addEventListener('click', () => switchView('unmapped'));
  doneUnmappedBtn.addEventListener('click', () => switchView('results'));
  copyCodeBtn.addEventListener('click', copyCode);
  removeFileBtn.addEventListener('click', removeFile);
  historySearchInput.addEventListener('input', filterHistory);
  loadMoreBtn.addEventListener('click', loadMoreHistory);
  exportDataBtn.addEventListener('click', exportData);
  importDataBtn.addEventListener('click', importData);
  clearStorageBtn.addEventListener('click', clearStorage);

  loadSettings();
  loadRecentCount();

  async function startScan() {
    switchView('scanning');
    setScanProgress(0, 'Starting scan...');
    updateScanStep(1, 'active');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'SCAN_PAGE' });

      if (response.success) {
        scanResults = response.data;
        unmappedBlocks = response.data.unmapped || [];
        processResults(response.data);
      } else {
        showError(response.error || 'Scan failed');
        switchView('initial');
      }
    } catch (error) {
      showError('Failed to connect to page. Try refreshing.');
      switchView('initial');
    }
  }

  function cancelScan() {
    switchView('initial');
    setStatus('ready', 'Ready to scan');
  }

  function processResults(data) {
    const summary = data.summary || {};
    const files = data.files || [];
    const project = data.project || {};

    projectNameEl.textContent = project.name || 'extracted-project';
    projectSourceEl.textContent = summary.site || summary.url || '-';

    const languages = {};
    files.forEach(f => {
      if (f.language) languages[f.language] = (languages[f.language] || 0) + 1;
    });
    projectLangsEl.textContent = Object.keys(languages).map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(', ') || 'Unknown';

    renderTree(project.treeString || generateTreeString(files));

    if (unmappedBlocks.length > 0) {
      unmappedCount.textContent = unmappedBlocks.length;
      unmappedWarning.classList.remove('hidden');
    } else {
      unmappedWarning.classList.add('hidden');
    }

    switchView('results');
    setStatus('success', `Scan complete • ${summary.totalFiles || files.length} files • ${summary.totalLines || 0} lines`);
  }

  function renderTree(treeString) {
    projectTree.innerHTML = '';
    if (!treeString || treeString.trim().length === 0) {
      projectTree.innerHTML = '<p class="empty-tree">No tree structure available</p>';
      return;
    }

    const lines = treeString.trim().split('\n');
    lines.forEach(line => {
      const div = document.createElement('div');
      div.className = 'tree-line';

      const isDir = line.includes('/');
      const isAuto = line.includes('README') || line.includes('.gitignore') || line.includes('requirements') || line.includes('package.json');

      div.innerHTML = `
        <span class="tree-prefix">${escapeHtml(line.match(/^[│├└─\s┬┼]*/)?.[0] || '')}</span>
        <span class="tree-icon">${isDir ? '📁' : '📄'}</span>
        <span class="tree-name">${escapeHtml(line.replace(/^[│├└─\s┬┼]*/, '').replace(/\/$/, ''))}</span>
        ${isAuto ? '<span class="tree-auto">⚡</span>' : '<span class="tree-check">✅</span>'}
      `;

      if (!isDir) {
        const name = line.replace(/^[│├└─\s┬┼]*/, '').replace(/\/$/, '').trim();
        div.addEventListener('click', () => openFileDetail(name));
        div.classList.add('tree-line-clickable');
      }

      projectTree.appendChild(div);
    });
  }

  function generateTreeString(files) {
    const tree = {};
    files.forEach(f => {
      const path = f.path || f.fileName;
      const parts = path.split('/');
      let current = tree;
      parts.forEach((part, i) => {
        if (!current[part]) current[part] = i === parts.length - 1 ? null : {};
        current = current[part];
      });
    });
    return renderTreeStr(tree);
  }

  function renderTreeStr(tree, prefix = '', isLast = true, isRoot = true) {
    let result = '';
    const entries = Object.entries(tree);
    for (let i = 0; i < entries.length; i++) {
      const [name, value] = entries[i];
      const connector = i === entries.length - 1 ? '└── ' : '├── ';
      const extension = i === entries.length - 1 ? '    ' : '│   ';
      if (value === null) {
        result += `${prefix}${connector}${name}\n`;
      } else {
        result += `${prefix}${connector}${name}/\n`;
        result += renderTreeStr(value, prefix + extension, i === entries.length - 1, false);
      }
    }
    return result;
  }

  function openFileDetail(fileName) {
    const files = scanResults?.files || [];
    const file = files.find(f => (f.fileName || f.path) === fileName);
    if (!file) return;

    selectedFileIndex = files.indexOf(file);
    fileDetailName.textContent = file.fileName || file.path;
    fileDetailPath.textContent = file.path || file.fileName;
    fileDetailLang.textContent = (file.language || 'text').charAt(0).toUpperCase() + (file.language || 'text').slice(1);
    fileDetailLines.textContent = file.lines || 0;
    fileDetailSize.textContent = formatBytes(file.size || 0);
    fileDetailConfidence.textContent = 'Auto-detected';

    codePreview.textContent = file.content || '';

    switchView('file-detail');
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(codePreview.textContent);
      copyCodeBtn.textContent = '✅ Copied!';
      setTimeout(() => { copyCodeBtn.innerHTML = '<span class="btn-icon">📋</span> Copy'; }, 2000);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = codePreview.textContent;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copyCodeBtn.textContent = '✅ Copied!';
      setTimeout(() => { copyCodeBtn.innerHTML = '<span class="btn-icon">📋</span> Copy'; }, 2000);
    }
  }

  async function removeFile() {
    if (!scanResults || selectedFileIndex === null) return;
    scanResults.files.splice(selectedFileIndex, 1);
    switchView('results');
    renderTree(scanResults.project?.treeString || generateTreeString(scanResults.files));
  }

  async function downloadZip() {
    if (!scanResults) return;
    setStatus('loading', 'Generating ZIP...');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'GENERATE_ZIP',
        data: { projectName: scanResults.project?.name || 'extracted-project' }
      });

      if (response.success) {
        setStatus('success', 'Download started!');
        setTimeout(() => { setStatus('success', `Scan complete • ${scanResults.summary?.totalFiles || 0} files`); }, 2000);
      } else {
        setStatus('error', response.error || 'Download failed');
      }
    } catch (error) {
      setStatus('error', 'Failed to generate ZIP');
    }
  }

  async function saveProject() {
    if (!scanResults) return;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'SAVE_PROJECT',
        data: {
          name: scanResults.project?.name || 'extracted-project',
          sourceUrl: scanResults.summary?.url || window.location.href,
          files: scanResults.files || [],
          summary: scanResults.summary
        }
      });

      if (response.success) {
        setStatus('success', 'Project saved!');
        loadRecentCount();
        setTimeout(() => { setStatus('success', `Scan complete • ${scanResults.summary?.totalFiles || 0} files`); }, 2000);
      } else {
        setStatus('error', response.error || 'Save failed');
      }
    } catch (error) {
      setStatus('error', 'Failed to save project');
    }
  }

  async function loadHistory() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_PROJECTS' });
      if (response.success) {
        renderHistory(response.data || []);
      }
    } catch (e) {
      historyList.innerHTML = '<p class="empty-state">Failed to load projects.</p>';
    }
  }

  function renderHistory(projects) {
    historyList.innerHTML = '';
    const query = historySearchInput.value.toLowerCase();
    const filtered = projects.filter(p =>
      (p.name || '').toLowerCase().includes(query) ||
      (p.sourceUrl || '').toLowerCase().includes(query)
    );

    historyTotal.textContent = filtered.length;
    const page = filtered.slice(0, (historyPage + 1) * HISTORY_PAGE_SIZE);
    historyShowing.textContent = page.length;

    if (page.length === 0) {
      historyList.innerHTML = '<p class="empty-state">No projects found.</p>';
      loadMoreBtn.classList.add('hidden');
      return;
    }

    page.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    page.forEach(project => {
      const item = document.createElement('div');
      item.className = 'history-item';
      const summary = project.summary || {};
      item.innerHTML = `
        <div class="history-item-info">
          <span class="history-item-name">📁 ${escapeHtml(project.name)}</span>
          <span class="history-item-meta">${project.sourceUrl ? project.sourceUrl.replace(/https?:\/\//, '') : '-'} • ${summary.totalFiles || 0} files • ${formatBytes(summary.totalSize || 0)}</span>
          <span class="history-item-date">${formatDate(project.createdAt)}</span>
        </div>
        <div class="history-item-actions">
          <button class="btn-text-inline load-history-project" data-id="${project.id}">👁️ View</button>
          <button class="btn-text-inline delete-history-project" data-id="${project.id}">🗑️</button>
        </div>
      `;
      historyList.appendChild(item);
    });

    historyList.querySelectorAll('.load-history-project').forEach(btn => {
      btn.addEventListener('click', () => loadProject(btn.dataset.id));
    });
    historyList.querySelectorAll('.delete-history-project').forEach(btn => {
      btn.addEventListener('click', () => deleteProject(btn.dataset.id));
    });

    if (page.length < filtered.length) {
      loadMoreBtn.classList.remove('hidden');
    } else {
      loadMoreBtn.classList.add('hidden');
    }
  }

  function filterHistory() {
    loadHistory();
  }

  function loadMoreHistory() {
    historyPage++;
    loadHistory();
  }

  async function loadProject(id) {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_PROJECT', data: { id } });
      if (response.success) {
        scanResults = response.data;
        processResults(response.data);
      }
    } catch (e) {
      setStatus('error', 'Failed to load project');
    }
  }

  async function deleteProject(id) {
    if (!confirm('Delete this project?')) return;
    try {
      await chrome.runtime.sendMessage({ action: 'DELETE_PROJECT', data: { id } });
      loadHistory();
      loadRecentCount();
    } catch (e) {
      setStatus('error', 'Failed to delete project');
    }
  }

  async function loadRecentCount() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_PROJECTS' });
      if (response.success) {
        recentCount.textContent = (response.data || []).length;
      }
    } catch (e) {
      recentCount.textContent = '0';
    }
  }

  function switchView(view) {
    document.querySelectorAll('.state').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(`state-${view}`);
    if (target) target.classList.remove('hidden');

    backBtn.classList.toggle('hidden', view === 'initial' || view === 'results');

    if (view === 'settings') {
      headerTitle.textContent = '📦 Settings';
      loadSettings();
      loadStorageInfo();
    } else if (view === 'history') {
      headerTitle.textContent = '📦 Project History';
      historyPage = 0;
      loadHistory();
    } else if (view === 'unmapped') {
      headerTitle.textContent = '📦 Unmapped Blocks';
      renderUnmappedBlocks();
    } else if (view === 'file-detail') {
      headerTitle.textContent = '📦 File Detail';
    } else if (view === 'results') {
      headerTitle.textContent = '📦 Code Extractor';
    } else {
      headerTitle.textContent = '📦 Code Extractor';
    }

    currentView = view;
  }

  function goBack() {
    if (currentView === 'settings' || currentView === 'history' || currentView === 'unmapped' || currentView === 'file-detail') {
      switchView('results');
    } else {
      switchView('initial');
    }
  }

  function renderUnmappedBlocks() {
    unmappedList.innerHTML = '';
    if (unmappedBlocks.length === 0) {
      unmappedList.innerHTML = '<p class="empty-state">No unmapped blocks.</p>';
      return;
    }

    unmappedBlocks.forEach((block, index) => {
      const item = document.createElement('div');
      item.className = 'unmapped-item';
      const ext = getExtensionForLanguage(block.language);
      item.innerHTML = `
        <div class="unmapped-header">Block #${index + 1} (${(block.language || 'text').charAt(0).toUpperCase() + (block.language || 'text').slice(1)}, ${block.lines || 0} lines)</div>
        <pre class="unmapped-code">${escapeHtml((block.code || '').substring(0, 200))}${(block.code || '').length > 200 ? '...' : ''}</pre>
        <div class="unmapped-inputs">
          <div class="input-row">
            <label>File name:</label>
            <input type="text" class="unmapped-filename" value="file_${index + 1}${ext}" data-index="${index}">
          </div>
          <div class="input-row">
            <label>Path:</label>
            <input type="text" class="unmapped-path" value="" data-index="${index}" placeholder="src/">
          </div>
        </div>
        <div class="unmapped-actions">
          <button class="btn btn-secondary btn-sm assign-block" data-index="${index}">✅ Assign</button>
          <button class="btn btn-text btn-sm skip-block" data-index="${index}">⏭️ Skip</button>
          <button class="btn btn-text btn-sm discard-block" data-index="${index}">🗑️ Discard</button>
        </div>
      `;
      unmappedList.appendChild(item);
    });

    unmappedList.querySelectorAll('.assign-block').forEach(btn => {
      btn.addEventListener('click', () => assignBlock(parseInt(btn.dataset.index)));
    });
    unmappedList.querySelectorAll('.skip-block').forEach(btn => {
      btn.addEventListener('click', () => { btn.closest('.unmapped-item').style.display = 'none'; });
    });
    unmappedList.querySelectorAll('.discard-block').forEach(btn => {
      btn.addEventListener('click', () => {
        unmappedBlocks.splice(parseInt(btn.dataset.index), 1);
        btn.closest('.unmapped-item').remove();
      });
    });
  }

  function assignBlock(index) {
    const item = unmappedList.querySelectorAll('.unmapped-item')[index];
    if (!item) return;
    const filename = item.querySelector('.unmapped-filename').value;
    const path = item.querySelector('.unmapped-path').value;
    const fullPath = path ? `${path}/${filename}` : filename;

    if (scanResults && scanResults.files && unmappedBlocks[index]) {
      scanResults.files.push({
        ...unmappedBlocks[index],
        fileName: filename,
        path: fullPath
      });
    }

    item.style.display = 'none';
    unmappedBlocks.splice(index, 1);
  }

  function getExtensionForLanguage(lang) {
    const map = { python: '.py', javascript: '.js', typescript: '.ts', html: '.html', css: '.css', json: '.json', yaml: '.yml', markdown: '.md', sql: '.sql', bash: '.sh', java: '.java', cpp: '.cpp', go: '.go', rust: '.rs', ruby: '.rb', php: '.php' };
    return map[lang?.toLowerCase()] || '.txt';
  }

  async function loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_SETTINGS' });
      if (response.success) {
        const s = response.data || {};
        if (s.theme) document.querySelector(`input[name="theme"][value="${s.theme}"]`)?.click();
        if (s.duplicateStrategy) document.querySelector(`input[name="duplicate-strategy"][value="${s.duplicateStrategy}"]`)?.click();
        if (typeof s.highlightCodeBlocks === 'boolean') document.getElementById('setting-highlight').checked = s.highlightCodeBlocks;
        if (typeof s.autoScan === 'boolean') document.getElementById('setting-autoscan').checked = s.autoScan;
        if (s.scanTimeout) document.getElementById('setting-timeout').value = s.scanTimeout;
        if (typeof s.autoGenerateReadme === 'boolean') document.getElementById('setting-readme').checked = s.autoGenerateReadme;
        if (typeof s.autoGenerateDependencies === 'boolean') document.getElementById('setting-dependencies').checked = s.autoGenerateDependencies;
      }
    } catch (e) { }
  }

  async function loadStorageInfo() {
    try {
      const projectsResp = await chrome.runtime.sendMessage({ action: 'GET_PROJECTS' });
      const projects = projectsResp?.success ? (projectsResp.data || []) : [];
      storageProjects.textContent = projects.length;
      const totalSize = projects.reduce((sum, p) => sum + (p.summary?.totalSize || 0), 0);
      storageUsed.textContent = formatBytes(totalSize);
    } catch (e) { }
  }

  async function exportData() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'EXPORT_DATA' });
      if (response.success) {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `code-extractor-export-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) { }
  }

  async function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await chrome.runtime.sendMessage({ action: 'IMPORT_DATA', data });
        loadSettings();
        loadRecentCount();
      } catch (err) { }
    };
    input.click();
  }

  async function clearStorage() {
    if (!confirm('Clear all stored data?')) return;
    try {
      await chrome.storage.local.clear();
      loadRecentCount();
      loadStorageInfo();
    } catch (e) { }
  }

  async function openSidePanel() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      if (chrome.sidePanel && chrome.sidePanel.open) {
        await chrome.sidePanel.open({ tabId: tab.id });
      } else {
        await chrome.runtime.sendMessage({ action: 'OPEN_SIDE_PANEL', tabId: tab.id });
      }
      window.close();
    } catch (e) {
      console.error('[popup] Failed to open sidepanel:', e);
    }
  }

  function setScanProgress(percent, text) {
    progressFill.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    if (text) statusText.textContent = text;
  }

  function updateScanStep(stepNum, state) {
    const steps = document.querySelectorAll('.scan-step');
    steps.forEach((step, i) => {
      const icon = step.querySelector('.step-icon');
      const n = i + 1;
      if (n < stepNum) {
        icon.textContent = '✅';
        step.classList.remove('active');
        step.classList.add('done');
      } else if (n === stepNum) {
        icon.textContent = state === 'active' ? '🔄' : '○';
        step.classList.add('active');
        step.classList.remove('done');
      } else {
        icon.textContent = '○';
        step.classList.remove('active', 'done');
      }
    });
  }

  function setStatus(type, text) {
    statusDot.className = `status-dot ${type}`;
    statusText.textContent = text;
  }

  function showError(msg) {
    setStatus('error', msg);
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }


  window.startScan = startScan;
})();
