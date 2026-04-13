// ============================================
// Utility Functions - Common helpers used across the sidepanel
// ============================================

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(isoString) {
  if (!isoString) return 'Unknown';
  const d = new Date(isoString);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}

function getMimeType(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  const types = {
    js: 'application/javascript', jsx: 'application/javascript',
    ts: 'application/typescript', tsx: 'application/typescript',
    py: 'text/x-python', pyw: 'text/x-python',
    rb: 'text/x-ruby', java: 'text/x-java',
    c: 'text/x-c', cpp: 'text/x-c++',
    h: 'text/x-c-header', hpp: 'text/x-c++-header',
    cs: 'text/x-csharp', go: 'text/x-go',
    rs: 'text/x-rust', swift: 'text/x-swift',
    kt: 'text/x-kotlin', scala: 'text/x-scala',
    php: 'text/x-php', html: 'text/html', htm: 'text/html',
    css: 'text/css', scss: 'text/x-scss', sass: 'text/x-sass',
    less: 'text/x-less', json: 'application/json',
    xml: 'application/xml', yaml: 'text/yaml', yml: 'text/yaml',
    md: 'text/markdown', sql: 'text/x-sql',
    sh: 'text/x-sh', bash: 'text/x-sh', zsh: 'text/x-sh',
    dockerfile: 'text/x-dockerfile', vue: 'text/x-vue',
    svelte: 'text/x-svelte', txt: 'text/plain'
  };
  return types[ext] || 'text/plain';
}

function getFileExtension(language) {
  const map = {
    javascript: '.js', typescript: '.ts', python: '.py', ruby: '.rb',
    java: '.java', csharp: '.cs', cpp: '.cpp', c: '.c', go: '.go',
    rust: '.rs', swift: '.swift', kotlin: '.kt', php: '.php',
    html: '.html', css: '.css', scss: '.scss', json: '.json',
    xml: '.xml', yaml: '.yaml', sql: '.sql', shell: '.sh'
  };
  return map[(language || '').toLowerCase()] || '';
}

function showStatus(text) {
  const statusEl = document.getElementById('scan-status');
  const textEl = document.getElementById('scan-status-text');
  const resultsEl = document.getElementById('scan-results');
  const errorEl = document.getElementById('scan-error');
  if (statusEl && textEl) {
    statusEl.classList.remove('hidden');
    textEl.textContent = text;
  }
  if (errorEl) errorEl.classList.add('hidden');
  if (resultsEl) resultsEl.classList.add('hidden');
}

function hideStatus() {
  const statusEl = document.getElementById('scan-status');
  if (statusEl) statusEl.classList.add('hidden');
}

function showError(text) {
  const errorEl = document.getElementById('scan-error');
  const textEl = document.getElementById('scan-error-text');
  const resultsEl = document.getElementById('scan-results');
  const statusEl = document.getElementById('scan-status');
  if (errorEl && textEl) {
    errorEl.classList.remove('hidden');
    textEl.textContent = text;
  }
  if (statusEl) statusEl.classList.add('hidden');
  if (resultsEl) resultsEl.classList.add('hidden');
}

function hideError() {
  const errorEl = document.getElementById('scan-error');
  if (errorEl) errorEl.classList.add('hidden');
}

function switchTab(tabName) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.toggle('active', tab.id === tabName + '-tab');
  });
  
  // Load data when switching tabs
  if (tabName === 'projects') loadProjects();
  if (tabName === 'templates') loadTemplates();
  if (tabName === 'search') loadSearchLanguages();
  if (tabName === 'analytics') loadAnalytics();
  if (tabName === 'deploy') loadDeployHistory();
  if (tabName === 'team') loadTeamMembers();
  if (tabName === 'parsers') loadParserList();
  if (tabName === 'history') loadHistoryProjects();
}

function buildASCIITree(files) {
  if (!files || files.length === 0) return '';
  
  const tree = {};
  files.forEach(f => {
    const path = f.path || f.fileName || 'unnamed';
    const parts = path.split('/');
    let current = tree;
    parts.forEach((part, idx) => {
      if (!current[part]) {
        current[part] = idx === parts.length - 1 ? null : {};
      }
      current = current[part];
    });
  });

  function render(node, prefix = '', isLast = true) {
    let result = '';
    const keys = Object.keys(node).sort();
    keys.forEach((key, idx) => {
      const isLastItem = idx === keys.length - 1;
      const connector = isLastItem ? '└── ' : '├── ';
      const isDir = node[key] !== null;
      result += prefix + connector + key + (isDir ? '/' : '') + '\n';
      if (isDir) {
        result += render(node[key], prefix + (isLastItem ? '    ' : '│   '), isLastItem);
      }
    });
    return result;
  }
  
  return render(tree);
}

// Global error handler
window.onerror = function (msg, url, lineNo, columnNo, error) {
  console.error('[Global Error]', msg, 'at', lineNo + ':' + columnNo, error);
  return false;
};

window.onunhandledrejection = function (event) {
  console.error('[Unhandled Promise]', event.reason);
};