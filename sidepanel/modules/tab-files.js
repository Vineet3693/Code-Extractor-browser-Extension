// ============================================================
// tab-files.js — Files Tab: file list rendering, filtering, bulk ops
// ============================================================

function updateFilesTab(files) {
    CE.currentFiles = files || [];
    renderFileList(CE.currentFiles);
}

function filterFiles(query) {
    const q = query.toLowerCase();
    const filtered = CE.currentFiles.filter(f =>
        (f.path || f.fileName || '').toLowerCase().includes(q) ||
        (f.content || f.code || '').toLowerCase().includes(q)
    );
    renderFileList(filtered);
}

function renderFileList(files) {
    const list = document.getElementById('file-list');
    if (!list) return;

    if (!files || files.length === 0) {
        list.innerHTML = '<div class="empty-state">No files to show.</div>';
        return;
    }

    list.innerHTML = '';
    files.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.id = `file-item-${index}`;
        item.innerHTML = `
            <div class="file-item-header">
                <input type="checkbox" class="file-checkbox" data-index="${index}" ${file.selected ? 'checked' : ''}>
                <span class="file-expand-icon">▶</span>
                <span class="file-name">${escapeHtml(file.path || file.fileName)}</span>
                <span class="file-info">${file.language} | ${file.lines || 0} lines</span>
                <div class="file-actions-mini">
                    <button class="btn-mini btn-ai" title="AI Refine">✨</button>
                    <button class="btn-mini btn-peek" title="Quick Peek">👁️</button>
                    <button class="btn-mini btn-copy" title="Copy">📋</button>
                    <button class="btn-mini btn-ide" title="Open in IDE">🚀</button>
                </div>
            </div>
            <div class="file-preview hidden">
                <pre class="file-code-block"><code>${escapeHtml(file.content || file.code || '// No content')}</code></pre>
            </div>
        `;

        const header = item.querySelector('.file-item-header');
        const preview = item.querySelector('.file-preview');
        const expandIcon = item.querySelector('.file-expand-icon');

        header.addEventListener('click', (e) => {
            // Don't expand if clicking buttons or checkbox
            if (e.target.closest('.file-actions-mini') || e.target.closest('.file-checkbox')) return;

            const isHidden = preview.classList.contains('hidden');
            if (isHidden) {
                preview.classList.remove('hidden');
                item.classList.add('file-item-open');
                expandIcon.textContent = '▼';
            } else {
                preview.classList.add('hidden');
                item.classList.remove('file-item-open');
                expandIcon.textContent = '▶';
            }
        });

        // AI events
        item.querySelector('.btn-ai').addEventListener('click', async (e) => {
            e.stopPropagation();
            const result = await refineCodeWithAI(file, 'cleanup');
            if (result && result.success) {
                file.content = result.refinedContent;
                file.code = result.refinedContent;
                showToast('Code refined by Gemini!');
                renderFileList(CE.currentFiles); // Re-render to update
            }
        });

        // Checkbox events
        item.querySelector('.file-checkbox').addEventListener('change', (e) => {
            file.selected = e.target.checked;
            updateSelectionBar();
        });

        // Peek events
        item.querySelector('.btn-peek').addEventListener('click', (e) => {
            e.stopPropagation();
            showCodePreview(file);
        });

        // Copy events
        item.querySelector('.btn-copy').addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(file.content || file.code || '');
            if (typeof showToast === 'function') showToast('Copied to clipboard!');
        });

        // IDE events
        item.querySelector('.btn-ide').addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof exportSingleFile === 'function') exportSingleFile(file);
        });

        list.appendChild(item);
    });

    updateSelectionBar();
}

function updateSelectionBar() {
    const bar = document.getElementById('file-actions-bar');
    const countEl = document.getElementById('selected-count');
    const selected = CE.currentFiles.filter(f => f.selected);

    if (bar && countEl) {
        if (selected.length > 0) {
            bar.classList.remove('hidden');
            countEl.textContent = `${selected.length} files selected`;
        } else {
            bar.classList.add('hidden');
        }
    }
}

function showCodePreview(file) {
    const modal = document.getElementById('code-preview-modal');
    const title = document.getElementById('preview-filename');
    const code = document.getElementById('preview-code-block');

    if (modal && title && code) {
        title.textContent = file.path || file.fileName;
        code.textContent = file.content || file.code || '// No content';
        modal.classList.remove('hidden');
    }
}

function renderFileTree() {
    const treeView = document.getElementById('file-tree-view');
    if (!treeView) return;

    if (!CE.currentFiles || CE.currentFiles.length === 0) {
        treeView.innerHTML = '<div class="empty-state">No files to show.</div>';
        return;
    }

    try {
        const treeData = buildProjectTree(CE.currentFiles);
        const visualizer = new TreeVisualizer();
        const treeHtml = visualizer.toHTML(treeData, { clickable: true, expandable: true, showIcons: true });

        treeView.innerHTML = '';
        treeView.appendChild(treeHtml);

        // Handle clicks in tree
        treeView.addEventListener('ce-tree-file-click', (e) => {
            const { path } = e.detail;
            const file = CE.currentFiles.find(f => f.path === path || f.fileName === path);
            if (file) showCodePreview(file);
        });
    } catch (e) {
        console.error('[Files] Tree render failed:', e);
        treeView.innerHTML = '<div class="error-state">Failed to render tree view.</div>';
    }
}

function getFileContent(file) { return file.content || null; }

function highlightCode(code, language) {
    if (!code) return '';
    code = escapeHtml(code);
    const colors = { keyword: '#569cd6', string: '#ce9178', comment: '#6a9955', number: '#b5cea8' };
    const patterns = {
        javascript: [
            { regex: /(\bconst\b|\blet\b|\bvar\b|\bfunction\b|\breturn\b|\bif\b|\belse\b|\bfor\b|\bwhile\b|\bclass\b|\bimport\b|\bexport\b|\bdefault\b)/g, color: colors.keyword },
            { regex: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, color: colors.string },
            { regex: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, color: colors.comment },
            { regex: /\b(\d+)\b/g, color: colors.number }
        ],
        python: [
            { regex: /(\bdef\b|\bclass\b|\breturn\b|\bif\b|\belse\b|\belif\b|\bfor\b|\bwhile\b|\bimport\b|\bfrom\b|True|False|None)/g, color: colors.keyword },
            { regex: /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, color: colors.string },
            { regex: /(#.*$)/gm, color: colors.comment }
        ],
        html: [
            { regex: /(<\/?[\w-]+)/g, color: colors.keyword },
            { regex: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, color: colors.string }
        ],
        css: [
            { regex: /([.#][\w-]+)(?=\s*\{)/g, color: colors.keyword },
            { regex: /(\/\*[\s\S]*?\*\/)/g, color: colors.comment }
        ]
    };
    const langPatterns = patterns[language?.toLowerCase()] || patterns.javascript;
    let result = code;
    langPatterns.forEach(p => { result = result.replace(p.regex, `<span style="color:${p.color}">$1</span>`); });
    return result;
}

