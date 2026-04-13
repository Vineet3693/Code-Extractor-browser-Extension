// ============================================================
// sidepanel.js — Main Coordinator / UI Event Bindings
// ============================================================

// Global Error Handling
window.onerror = function (msg, url, lineNo, columnNo, error) {
  const errText = `[Global Error] ${msg} at ${lineNo}:${columnNo}`;
  console.error(errText, error);
  showInitializationError(errText);
  return false;
};

window.onunhandledrejection = function (event) {
  const errText = `[Unhandled Promise] ${event.reason}`;
  console.error(errText);
  showInitializationError(errText);
};

function showInitializationError(text) {
  const errDiv = document.getElementById('scan-error');
  const errTextEl = document.getElementById('scan-error-text');
  if (errDiv && errTextEl) {
    errDiv.classList.remove('hidden');
    errTextEl.textContent = "Initialization Error: " + text;
  }
}

// -------------------------------------------------------------
// Core UI Helpers used by modules
// -------------------------------------------------------------
function showStatus(text) {
  const st = document.getElementById('scan-status-text');
  const sd = document.getElementById('scan-status');
  if (st) st.textContent = text;
  if (sd) sd.classList.remove('hidden');
  hideError();
}

function hideStatus() {
  const sd = document.getElementById('scan-status');
  if (sd) sd.classList.add('hidden');
}

function showError(text) {
  const st = document.getElementById('scan-error-text');
  const err = document.getElementById('scan-error');
  if (st) st.textContent = text;
  if (err) err.classList.remove('hidden');
  hideStatus();
}

function hideError() {
  const err = document.getElementById('scan-error');
  if (err) err.classList.add('hidden');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function ensureToastCss() {
  if (document.getElementById('code-extractor-toast-styles')) return;
  const style = document.createElement('style');
  style.id = 'code-extractor-toast-styles';
  style.textContent = `
    .code-extractor-toast {
      position: fixed; bottom: 20px; right: 20px; background: #333; color: #fff;
      padding: 10px 14px; border-radius: 6px; z-index: 99999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3); opacity: 0.95; animation: toastIn 0.2s ease-out;
    }
    @keyframes toastIn { from { transform: translateY(6px); opacity: 0; } to { transform: translateY(0); opacity: 0.95; } }
  `;
  (document.head || document.documentElement).appendChild(style);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
function formatDate(date) { return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
function formatTime(timestamp) { return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function buildProjectTree(files) {
  const tree = { name: 'project', type: 'directory', children: [] };
  for (const file of files) {
    const path = file.path || file.fileName || 'unknown.txt';
    const parts = path.split('/');
    let current = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      let child = current.children.find(c => c.name === part);
      if (!child) {
        const isFile = i === parts.length - 1;
        child = {
          name: part, type: isFile ? 'file' : 'directory', children: isFile ? undefined : [],
          path: isFile ? path : undefined, file: isFile ? file : undefined
        };
        current.children.push(child);
      }
      current = child;
    }
  }
  return tree;
}

function buildASCIITree(files) {
  const tree = {};
  for (const file of files) {
    const path = file.path || file.fileName || 'unknown.txt';
    const parts = path.split('/');
    let current = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!current[part]) current[part] = i === parts.length - 1 ? null : {};
      current = current[part];
    }
  }
  let result = '';
  const render = (node, prefix = '', isLast = true) => {
    const entries = Object.entries(node);
    for (let i = 0; i < entries.length; i++) {
      const [name, value] = entries[i];
      const connector = i === entries.length - 1 ? '└── ' : '├── ';
      const extension = i === entries.length - 1 ? '    ' : '│   ';
      if (value === null) result += `${prefix}${connector}${name}\n`;
      else {
        result += `${prefix}${connector}${name}/\n`;
        render(value, prefix + extension, i === entries.length - 1);
      }
    }
  };
  render(tree);
  return result || '(empty)';
}

function openNoteMakerFromBlock(index) {
  // Simple stub if NoteMaker isn't fully separated
  showToast('Note maker opened for block ' + index);
}

// -------------------------------------------------------------
// App Initialization
// -------------------------------------------------------------
async function initV2Modules() {
  CE.templateManager = new TemplateManager();
  CE.githubIntegration = new GitHubIntegration();
  CE.ideExport = new IDEExport();
  const diffContent = document.getElementById('diff-content');
  if (diffContent) CE.codeDiffViewer = new CodeDiffViewer(diffContent);

  try {
    CE.dbHelper = new IndexedDBHelper();
    await CE.dbHelper.open();
    CE.universalSearch = new UniversalSearch(CE.dbHelper);
    CE.versionHistory = new VersionHistory(CE.dbHelper);
    CE.aiFilenameRefiner = new AIFilenameRefiner();
    CE.teamCollaboration = new TeamCollaboration({ dbHelper: CE.dbHelper });
    CE.cloudSync = new CloudSync({ dbHelper: CE.dbHelper });
    CE.customParserBuilder = new CustomParserBuilder({ dbHelper: CE.dbHelper });
    CE.apiBridge = new APIBridge({ dbHelper: CE.dbHelper });
    CE.vscodeCompanion = new VSCodeCompanion({ dbHelper: CE.dbHelper });
    CE.projectAnalytics = new ProjectAnalytics({ dbHelper: CE.dbHelper });
    CE.deploymentManager = new DeploymentManager({ dbHelper: CE.dbHelper });
    console.log('[sidepanel] IndexedDB V3 initialized');
  } catch (e) {
    console.error('[sidepanel] IndexedDB init failed:', e);
  }
}

// -------------------------------------------------------------
// Tab Switching
// -------------------------------------------------------------
function switchTab(tabName) {
  console.log('[Coordinator] switchTab called for:', tabName);
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const isActive = btn.dataset.tab === tabName;
    btn.classList.toggle('active', isActive);
  });
  document.querySelectorAll('.tab-content').forEach(tab => {
    const isActive = tab.id === `${tabName}-tab`;
    tab.classList.toggle('active', isActive);
    if (isActive) {
      console.log('[Coordinator] Showing tab:', tab.id);
    }
  });

  if (tabName === 'projects' && typeof loadProjects === 'function') loadProjects();
  if (tabName === 'templates' && typeof loadTemplates === 'function') loadTemplates();
  if (tabName === 'search' && typeof loadSearchLanguages === 'function') loadSearchLanguages();
  if (tabName === 'analytics' && typeof loadAnalytics === 'function') loadAnalytics();
  if (tabName === 'deploy' && typeof loadDeployHistory === 'function') loadDeployHistory();
  if (tabName === 'team' && typeof loadTeamMembers === 'function') loadTeamMembers();
  if (tabName === 'parsers' && typeof loadParserList === 'function') loadParserList();
  if (tabName === 'history' && typeof loadHistoryProjects === 'function') loadHistoryProjects();
}

function bindTabsOnce() {
  if (window.__CodeExtractorTabsBound) return;
  window.__CodeExtractorTabsBound = true;
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const tab = btn.getAttribute('data-tab');
    if (tab) btn.addEventListener('click', () => switchTab(tab));
  });
  switchTab('scan');
}

// -------------------------------------------------------------
// Main Boot
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  ensureToastCss();
  await initV2Modules();
  bindTabsOnce();

  // Load Initial Data
  if (typeof loadSettings === 'function') loadSettings();
  if (typeof loadProjects === 'function') loadProjects();
  if (typeof startLiveStatsUpdater === 'function') startLiveStatsUpdater();

  // Setup extension message listener
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'PROJECT_UPDATED' && typeof handleProjectUpdate === 'function') {
      handleProjectUpdate(message.data);
    }
  });

  // Basic Button Bindings
  const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };

  // Scan Actions
  bind('scan-btn', () => startScan(false));
  bind('scan-selection-btn', () => startScan(true));
  bind('merge-tabs-btn', mergeTabs);
  bind('save-project-btn', saveProject);
  bind('validate-code-btn', validateCode);
  bind('retry-btn', () => startScan(false));

  // File Actions
  bind('export-data-btn', exportData);
  bind('import-data-btn', importData);
  bind('save-settings-btn', saveSettings);
  bind('download-conversation-btn', downloadConversation);

  // Modals
  const ideModal = document.getElementById('ide-export-modal');
  const noteModal = document.getElementById('note-maker-modal');
  bind('open-in-ide-btn', () => {
    console.log('[IDE] Open IDE button clicked');
    if (typeof populateExtensionFilters === 'function') populateExtensionFilters();
    ideModal?.classList.remove('hidden');
  });
  bind('ide-modal-close', () => ideModal?.classList.add('hidden'));
  bind('ide-export-cancel', () => ideModal?.classList.add('hidden'));

  bind('open-note-maker-btn', () => {
    console.log('[Notes] Note maker button clicked');
    noteModal?.classList.remove('hidden');
  });
  bind('note-modal-close', () => noteModal?.classList.add('hidden'));
  bind('note-modal-cancel', () => noteModal?.classList.add('hidden'));

  // Ide Export Submit
  bind('ide-export-confirm', () => {
    const ide = document.querySelector('.ide-card.active')?.dataset.ide || 'vscode';
    const format = document.querySelector('.format-card.active')?.dataset.format || 'folder';
    const scope = document.querySelector('input[name="ide-scope"]:checked')?.value || 'project';
    const fileIndex = document.getElementById('ide-file-select')?.value;

    // Collect selected extensions
    const selectedExtensions = Array.from(document.querySelectorAll('.extension-checkbox:checked')).map(cb => cb.value);

    console.log('[IDE] Exporting:', { ide, format, scope, fileIndex, selectedExtensions });
    exportToIDE({ ide, format, scope, fileIndex, selectedExtensions });
    ideModal?.classList.add('hidden');
  });

  function populateExtensionFilters() {
    const list = document.getElementById('ide-extension-list');
    if (!list || !CE.scanResults) return;
    const files = CE.scanResults.project?.files || CE.scanResults.files || [];
    const extensions = new Set();
    files.forEach(f => {
      const name = f.path || f.fileName || '';
      const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : 'no-ext';
      extensions.add(ext);
    });

    if (extensions.size === 0) {
      list.innerHTML = '<p style="font-size:11px;color:var(--text-secondary)">No files found.</p>';
      return;
    }

    list.innerHTML = Array.from(extensions).sort().map(ext => `
      <label class="extension-item">
        <input type="checkbox" class="extension-checkbox" value="${ext}" checked>
        <span>.${ext}</span>
      </label>
    `).join('');
  }

  // Modal Card Selection
  document.querySelectorAll('.ide-card, .format-card').forEach(card => {
    card.addEventListener('click', () => {
      const p = card.parentElement;
      p.querySelectorAll('.active').forEach(a => a.classList.remove('active'));
      card.classList.add('active');
    });
  });

  // Modal Scope Toggle
  document.querySelectorAll('input[name="ide-scope"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const row = document.getElementById('ide-single-file-row');
      if (row) row.classList.toggle('hidden', e.target.value !== 'single');
      if (e.target.value === 'single') populateIDEModeFileSelect();
    });
  });

  function populateIDEModeFileSelect() {
    const sel = document.getElementById('ide-file-select');
    if (!sel || !CE.scanResults) return;
    const files = CE.scanResults.project?.files || CE.scanResults.files || [];
    sel.innerHTML = files.map((f, i) => `<option value="${i}">${f.path || f.fileName}</option>`).join('');
  }

  // AI Settings Save
  bind('save-ai-settings-btn', async () => {
    const key = document.getElementById('ai-api-key')?.value;
    const provider = document.getElementById('ai-provider')?.value;
    const autoMerge = document.getElementById('auto-merge-toggle')?.checked;

    await chrome.storage.local.set({
      ai_api_key: key,
      ai_provider: provider,
      auto_merge_blocks: autoMerge
    });

    if (typeof initAISettings === 'function') await initAISettings();
    showStatus('AI Settings saved!');
    setTimeout(hideStatus, 2000);
  });

  // Load AI Settings on mount
  chrome.storage.local.get(['ai_api_key', 'ai_provider', 'auto_merge_blocks'], (data) => {
    if (document.getElementById('ai-api-key')) document.getElementById('ai-api-key').value = data.ai_api_key || '';
    if (document.getElementById('ai-provider')) document.getElementById('ai-provider').value = data.ai_provider || 'gemini';
    if (document.getElementById('auto-merge-toggle')) document.getElementById('auto-merge-toggle').checked = data.auto_merge_blocks !== false;
  });

  const ideCards = document.querySelectorAll('.ide-card');
  ideCards.forEach(card => card.addEventListener('click', () => {
    ideCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
  }));

  // Export Buttons
  bind('download-pdf-btn', downloadAsPDF);
  bind('download-docs-btn', downloadAsDOCS);
  bind('download-md-btn', downloadAsMD);
  bind('download-json-btn', downloadAsJSON);
  bind('download-html-btn', downloadAsHTML);
  bind('zip-export-btn', downloadAsZIP);

  // Projects
  bind('refresh-projects-btn', loadProjects);


  document.getElementById('file-search')?.addEventListener('input', filterFiles);
  document.getElementById('lang-filter')?.addEventListener('change', filterFiles);

  // Bulk Actions
  bind('select-all-btn', selectAllFiles);
  bind('deselect-all-btn', deselectAllFiles);
  bind('export-selected-btn', exportSelectedFiles);
  bind('delete-selected-btn', deleteSelectedFiles);

  // Live
  bind('live-toggle-btn', toggleLiveScanning);

  // Search
  bind('universal-search-btn', performUniversalSearch);
  document.getElementById('universal-search-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') performUniversalSearch(); });

  // History
  document.getElementById('history-project-select')?.addEventListener('change', loadHistoryFiles);
  document.getElementById('history-file-select')?.addEventListener('change', loadVersionTimeline);
  bind('diff-view-toggle', toggleDiffView);
  bind('diff-whitespace-toggle', toggleWhitespaceDiff);

  // Templates
  document.getElementById('template-category-filter')?.addEventListener('change', loadTemplates);
  document.getElementById('template-language-filter')?.addEventListener('change', loadTemplates);
  bind('template-create-btn', createProjectFromTemplate);

  // Parsers
  bind('save-parser-btn', saveParser);

  // GitHub
  bind('github-auth-btn', authenticateGitHub);
  bind('github-logout-btn', logoutGitHub);
  bind('github-push-btn', pushToGitHub);
  bind('github-gist-btn', createGitHubGist);

  // Team
  bind('team-create-btn', createTeam);
  bind('team-join-btn', joinTeam);
  bind('share-project-btn', shareProjectWithTeam);

  // File Search
  const searchInput = document.getElementById('file-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      if (typeof filterFiles === 'function') filterFiles(e.target.value);
    });
  }

  // View Toggles
  bind('view-list-btn', () => {
    document.getElementById('view-list-btn').classList.add('active');
    document.getElementById('view-tree-btn').classList.remove('active');
    document.getElementById('file-list').classList.remove('hidden');
    document.getElementById('file-tree-view').classList.add('hidden');
  });

  bind('view-tree-btn', () => {
    document.getElementById('view-tree-btn').classList.add('active');
    document.getElementById('view-list-btn').classList.remove('active');
    document.getElementById('file-list').classList.add('hidden');
    document.getElementById('file-tree-view').classList.remove('hidden');
    if (typeof renderFileTree === 'function') renderFileTree();
  });

  // Preview Modal
  const previewModal = document.getElementById('code-preview-modal');
  bind('preview-modal-close', () => previewModal?.classList.add('hidden'));
  bind('preview-close-btn', () => previewModal?.classList.add('hidden'));

  // Close on background click
  previewModal?.addEventListener('click', (e) => {
    if (e.target === previewModal) previewModal.classList.add('hidden');
  });

  bind('preview-copy-btn', () => {
    const code = document.getElementById('preview-code-block').textContent;
    navigator.clipboard.writeText(code);
    showToast('Code copied to clipboard!');
  });

  // Deploy
  document.querySelectorAll('.deploy-btn').forEach(btn => {
    btn.addEventListener('click', () => deployToPlatform(btn.dataset.platform));
  });

  // High Visibility Toggle
  const hvToggle = document.getElementById('high-visibility-toggle');
  if (hvToggle) {
    hvToggle.addEventListener('change', async (e) => {
      if (!CE.scanResults || !CE.scanResults.project) return;
      const isChecked = e.target.checked;
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab) {
        if (isChecked) {
          safeSendMessageToTab(tab.id, {
            action: 'UPDATE_VISIBILITY',
            data: {
              blocks: CE.scanResults.project.files?.map(f => ({ element: f.element })) || [],
              headings: CE.scanResults.project.headings || []
            }
          }).catch(() => { });
        } else {
          safeSendMessageToTab(tab.id, { action: 'CLEAR_HIGHLIGHTS' }).catch(() => { });
        }
      }
    });
  }

  console.log('[sidepanel] Coordinator initialized successfully. Modules connected.');
});
