// ============================================================
// tab-projects.js — Projects Tab
// ============================================================

async function loadProjects() {
    const listEl = document.getElementById('project-list');
    if (!listEl) return;

    try {
        const response = await chrome.runtime.sendMessage({ action: 'GET_PROJECTS' });
        if (response.success && response.data) {
            if (response.data.length === 0) {
                listEl.innerHTML = '<p class="empty-state">No saved projects.</p>';
                return;
            }

            listEl.innerHTML = response.data.map(p => `
        <div class="project-card">
          <div class="project-header">
            <h3>${escapeHtml(p.name)}</h3>
            <span class="project-date">${formatDate(p.createdAt || Date.now())}</span>
          </div>
          <p class="project-url">${escapeHtml(p.sourceUrl || '')}</p>
          <div class="project-stats">
            <span>${p.summary?.totalFiles || 0} files</span>
            <span>${p.summary?.totalLines || 0} lines</span>
          </div>
          <div class="project-actions">
            <button class="btn btn-sm btn-primary btn-load-project" data-id="${p.id}">Load</button>
            <button class="btn btn-sm btn-danger btn-delete-project" data-id="${p.id}">Delete</button>
          </div>
        </div>
      `).join('');

            listEl.querySelectorAll('.btn-load-project').forEach(btn => {
                btn.addEventListener('click', () => loadProject(btn.dataset.id));
            });
            listEl.querySelectorAll('.btn-delete-project').forEach(btn => {
                btn.addEventListener('click', () => deleteProject(btn.dataset.id));
            });
        }
    } catch (error) {
        listEl.innerHTML = '<p class="empty-state">Failed to load projects.</p>';
    }
}

async function loadProject(projectId) {
    console.log('[Projects] Loading project:', projectId);
    try {
        const response = await chrome.runtime.sendMessage({ action: 'GET_PROJECT', data: { id: projectId } });
        if (response.success && response.data) {
            console.log('[Projects] Project data received:', response.data);
            CE.scanResults = {
                project: response.data,
                files: response.data.files || [],
                summary: response.data.summary || {
                    totalFiles: response.data.files?.length || 0,
                    totalLines: response.data.totalLines || 0,
                    totalSize: response.data.totalSize || 0
                }
            };

            switchTab('scan');
            showResults(CE.scanResults);
            updateFilesTab(CE.scanResults.files);

            showStatus('Project loaded successfully!');
            setTimeout(hideStatus, 2000);
        } else {
            console.error('[Projects] Failed to load project:', response.error);
            showError('Failed to load project data: ' + (response.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('[Projects] Error during load:', error);
        showError('Error loading project: ' + error.message);
    }
}

async function deleteProject(projectId) {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
        const response = await chrome.runtime.sendMessage({ action: 'DELETE_PROJECT', data: { id: projectId } });
        if (response.success) {
            loadProjects();
            showToast('Project deleted');
        } else {
            showError('Failed to delete project');
        }
    } catch (error) {
        showError('Error deleting project: ' + error.message);
    }
}
