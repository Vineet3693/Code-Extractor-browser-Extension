// ============================================================
// tab-templates.js — Templates Tab
// ============================================================

function loadTemplates() {
    if (!CE.templateManager) return;
    const categoryFilter = document.getElementById('template-category-filter');
    const languageFilter = document.getElementById('template-language-filter');
    const templateList = document.getElementById('template-list');
    const templateCreateSection = document.getElementById('template-create-section');
    if (!templateList) return;

    const category = categoryFilter?.value || '';
    const language = languageFilter?.value || '';
    let templates = CE.templateManager.getAllTemplates();
    if (category) templates = templates.filter(t => t.category === category);
    if (language) templates = templates.filter(t => t.language === language.toLowerCase());

    templateList.innerHTML = '';
    if (templates.length === 0) {
        templateList.innerHTML = '<p class="empty-state">No templates found.</p>';
        return;
    }
    templates.forEach(template => {
        const div = document.createElement('div');
        div.className = 'template-card';
        div.innerHTML = `
      <h3 class="template-name">${escapeHtml(template.name)}</h3>
      <p class="template-description">${escapeHtml(template.description || '')}</p>
      <div class="template-meta">
        <span class="lang-badge">${template.language}</span>
        <span class="category-badge">${template.category}</span>
        <span class="file-count">${template.files?.length || 0} files</span>
      </div>
      <div class="template-tags">${(template.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
      <button class="btn btn-primary btn-sm use-template-btn" data-id="${template.id}">Use Template</button>
    `;
        templateList.appendChild(div);
    });
    templateList.querySelectorAll('.use-template-btn').forEach(btn => {
        btn.addEventListener('click', () => selectTemplate(btn.dataset.id));
    });
}

function selectTemplate(templateId) {
    const template = CE.templateManager.getTemplate(templateId);
    if (!template) return;
    const section = document.getElementById('template-create-section');
    const nameInput = document.getElementById('template-project-name');
    const createBtn = document.getElementById('template-create-btn');
    if (section) section.classList.remove('hidden');
    if (nameInput) nameInput.value = template.name.toLowerCase().replace(/\s+/g, '-');
    if (createBtn) createBtn.dataset.templateId = templateId;
}

async function createProjectFromTemplate() {
    const createBtn = document.getElementById('template-create-btn');
    const nameInput = document.getElementById('template-project-name');
    const templateId = createBtn?.dataset.templateId;
    const projectName = nameInput?.value.trim() || 'template-project';
    if (!templateId) { showError('No template selected'); return; }
    try {
        const result = await CE.templateManager.createProjectFromTemplate(templateId, { projectName });
        if (result.success) {
            CE.scanResults = {
                project: result.project,
                files: result.project.files,
                summary: { totalFiles: result.project.totalFiles, totalLines: result.project.totalLines, totalSize: result.project.totalSize, duplicates: 0 }
            };
            showResults(CE.scanResults);
            updateFilesTab(CE.scanResults.files);
            switchTab('scan');
            showStatus(`Created project from template: ${projectName}`);
            setTimeout(hideStatus, 3000);
        }
    } catch (error) {
        showError('Failed to create project: ' + error.message);
    }
}
