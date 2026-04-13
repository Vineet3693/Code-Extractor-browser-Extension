// ============================================================
// tab-history.js — History Tab: version history, diffs
// ============================================================

async function loadHistoryProjects() {
    const select = document.getElementById('history-project-select');
    if (!select) return;
    try {
        const response = await chrome.runtime.sendMessage({ action: 'GET_PROJECTS' });
        if (response.success && response.data) {
            select.innerHTML = '<option value="">Select a project</option>';
            response.data.forEach(p => {
                const option = document.createElement('option');
                option.value = p.id;
                option.textContent = p.name;
                select.appendChild(option);
            });
        }
    } catch (e) { }
}

async function loadHistoryFiles() {
    const projectSelect = document.getElementById('history-project-select');
    const fileSelect = document.getElementById('history-file-select');
    const timeline = document.getElementById('version-timeline');
    const projectId = projectSelect?.value;
    if (!projectId) {
        if (fileSelect) fileSelect.innerHTML = '<option value="">Select a file</option>';
        if (timeline) timeline.innerHTML = '<p class="empty-state">Select a project and file to view version history.</p>';
        return;
    }
    try {
        const response = await chrome.runtime.sendMessage({ action: 'GET_PROJECT', data: { id: projectId } });
        if (response.success && response.data?.files) {
            fileSelect.innerHTML = '<option value="">Select a file</option>';
            response.data.files.forEach(f => {
                const option = document.createElement('option');
                option.value = f.path || f.fileName;
                option.textContent = f.path || f.fileName;
                fileSelect.appendChild(option);
            });
        }
    } catch (e) { }
}

async function loadVersionTimeline() {
    const projectSelect = document.getElementById('history-project-select');
    const fileSelect = document.getElementById('history-file-select');
    const timeline = document.getElementById('version-timeline');
    const projectId = projectSelect?.value;
    const filePath = fileSelect?.value;
    if (!timeline) return;
    if (!projectId || !filePath) {
        timeline.innerHTML = '<p class="empty-state">Select a project and file.</p>';
        return;
    }
    timeline.innerHTML = '<p class="empty-state">Loading versions...</p>';
    try {
        let versions = [];
        if (CE.versionHistory) versions = await CE.versionHistory.getVersions(projectId, filePath);
        if (!versions || !versions.length) {
            const response = await chrome.runtime.sendMessage({ action: 'VERSION_HISTORY_GET', data: { projectId, filePath } });
            if (response.success) versions = response.versions || [];
        }
        if (versions.length > 0) {
            timeline.innerHTML = '';
            versions.forEach((version, index) => {
                const div = document.createElement('div');
                div.className = 'version-entry';
                div.innerHTML = `
          <div class="version-header">
            <span class="version-number">v${versions.length - index}</span>
            <span class="version-date">${formatDate(version.timestamp)}</span>
            <span class="version-type">${version.changeType || 'manual'}</span>
          </div>
          <div class="version-info">
            <span>${version.lines || 0} lines</span>
            <span>${formatBytes(version.size || 0)}</span>
          </div>
        `;
                div.addEventListener('click', () => showVersionDiff(version, versions));
                timeline.appendChild(div);
            });
        } else {
            timeline.innerHTML = '<p class="empty-state">No version history for this file.</p>';
        }
    } catch (e) {
        timeline.innerHTML = '<p class="empty-state">Failed to load version history.</p>';
    }
}

function showVersionDiff(version, allVersions) {
    const versionDiffViewer = document.getElementById('version-diff-viewer');
    const diffContent = document.getElementById('diff-content');
    const index = allVersions.indexOf(version);
    const prevVersion = index < allVersions.length - 1 ? allVersions[index + 1] : null;
    if (versionDiffViewer) versionDiffViewer.classList.remove('hidden');
    if (!prevVersion) {
        if (diffContent) diffContent.innerHTML = '<p class="empty-state">No previous version to compare.</p>';
        return;
    }
    if (CE.codeDiffViewer) {
        const diffData = { fileName: version.filePath, diff: computeDiff(prevVersion.content || '', version.content || '') };
        CE.codeDiffViewer.renderDiff(diffData, { viewMode: 'split' });
    }
}

function computeDiff(oldContent, newContent) {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const lcs = computeLCS(oldLines, newLines);
    const diff = [];
    let i = 0, j = 0, k = 0;
    while (i < oldLines.length || j < newLines.length) {
        if (k < lcs.length && i < oldLines.length && oldLines[i] === lcs[k]) {
            if (j < newLines.length && newLines[j] === lcs[k]) {
                diff.push({ type: 'unchanged', content: newLines[j], lineNum: j + 1 }); j++; i++; k++;
            } else {
                diff.push({ type: 'removed', content: oldLines[i], lineNum: i + 1 }); i++;
            }
        } else if (j < newLines.length) {
            diff.push({ type: 'added', content: newLines[j], lineNum: j + 1 }); j++;
        } else if (i < oldLines.length) {
            diff.push({ type: 'removed', content: oldLines[i], lineNum: i + 1 }); i++;
        }
    }
    return diff;
}

function computeLCS(arr1, arr2) {
    const m = arr1.length, n = arr2.length;
    if (m * n > 10000000) {
        const result = [], set2 = new Set(arr2);
        for (const line of arr1) { if (set2.has(line)) { result.push(line); set2.delete(line); } }
        return result;
    }
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
        dp[i][j] = arr1[i - 1] === arr2[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    const result = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
        if (arr1[i - 1] === arr2[j - 1]) { result.unshift(arr1[i - 1]); i--; j--; }
        else if (dp[i - 1][j] > dp[i][j - 1]) i--; else j--;
    }
    return result;
}

function toggleDiffView() {
    const btn = document.getElementById('diff-view-toggle');
    if (btn) btn.textContent = btn.textContent === 'Split' ? 'Unified' : 'Split';
}

function toggleWhitespaceDiff() {
    document.getElementById('diff-whitespace-toggle')?.classList.toggle('active');
}
