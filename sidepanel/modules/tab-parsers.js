// ============================================================
// tab-parsers.js — Parsers Tab
// ============================================================

function loadParserList() {
    if (!CE.customParserBuilder) return;
    const parsers = CE.customParserBuilder.getAllParsers();
    const listEl = document.getElementById('parser-list');
    if (!listEl) return;

    if (parsers.length === 0) {
        listEl.innerHTML = '<p class="empty-state">No custom parsers yet. Create one to extract code from any website.</p>';
        return;
    }

    listEl.innerHTML = parsers.map(p => `
    <div class="parser-item">
      <div class="parser-info">
        <h4>${escapeHtml(p.name)}</h4>
        <span class="parser-site-pattern">${escapeHtml(p.sitePatterns?.[0] || 'No pattern')}</span>
        <span class="parser-rules-count">${p.extractionRules?.length || 0} rules</span>
      </div>
      <div class="parser-actions">
        <button class="btn btn-text btn-sm parser-edit-btn" data-id="${p.id}">Edit</button>
        <button class="btn btn-text btn-sm parser-export-btn" data-id="${p.id}">Export</button>
        <button class="btn btn-text btn-sm parser-delete-btn" data-id="${p.id}">Delete</button>
      </div>
    </div>
  `).join('');

    listEl.querySelectorAll('.parser-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => editParser(btn.dataset.id));
    });
    listEl.querySelectorAll('.parser-export-btn').forEach(btn => {
        btn.addEventListener('click', () => exportParser(btn.dataset.id));
    });
    listEl.querySelectorAll('.parser-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteParser(btn.dataset.id));
    });
}

function editParser(parserId) {
    const parser = CE.customParserBuilder.getParser(parserId);
    if (!parser) return;
    document.getElementById('parser-editor')?.classList.remove('hidden');
    const title = document.getElementById('parser-editor-title');
    if (title) title.textContent = 'Edit Parser';
    const nameEl = document.getElementById('parser-name');
    if (nameEl) nameEl.value = parser.name;
    const patternEl = document.getElementById('parser-site-pattern');
    if (patternEl) patternEl.value = parser.sitePatterns?.[0] || '';
}

function exportParser(parserId) {
    const result = CE.customParserBuilder.exportParser(parserId);
    if (result.success) {
        const blob = new Blob([result.data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: result.fileName });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

async function deleteParser(parserId) {
    if (!confirm('Delete this parser?')) return;
    await CE.customParserBuilder.deleteParser(parserId);
    loadParserList();
}

function saveParser() {
    const nameEl = document.getElementById('parser-name');
    const patternEl = document.getElementById('parser-site-pattern');
    if (!nameEl || !patternEl) return;

    const name = nameEl.value.trim();
    const sitePattern = patternEl.value.trim();
    if (!name || !sitePattern) { showError('Parser name and site pattern are required'); return; }

    const config = {
        name,
        sitePatterns: [sitePattern],
        extractionRules: [{ id: 'rule_1', selector: 'pre, code', textContent: true, languageAttribute: 'class', contextLines: true }]
    };

    const validation = CE.customParserBuilder.validateParserConfig(config);
    if (!validation.valid) {
        showError(validation.errors.join(', '));
        return;
    }

    const parser = CE.customParserBuilder.createParser(config);
    CE.customParserBuilder.saveParser(parser);
    document.getElementById('parser-editor')?.classList.add('hidden');
    loadParserList();
}
