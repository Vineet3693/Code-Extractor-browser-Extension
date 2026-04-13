// ============================================================
// tab-github.js — GitHub Tab
// ============================================================

async function authenticateGitHub() {
    const input = document.getElementById('github-token-input');
    if (!input) return;
    const token = input.value.trim();
    if (!token) { showError('Please enter a GitHub token'); return; }
    try {
        const result = await CE.githubIntegration.authenticate(token);
        if (result.success) {
            document.getElementById('github-auth-section')?.classList.add('hidden');
            document.getElementById('github-main-section')?.classList.remove('hidden');
            const un = document.getElementById('github-username');
            if (un) un.textContent = `@${result.user.login}`;
            await chrome.runtime.sendMessage({ action: 'GITHUB_AUTHENTICATE', data: { token } });
            await loadGitHubRepos();
        } else {
            showError(`Authentication failed: ${result.error}`);
        }
    } catch (error) {
        showError('Authentication failed: ' + error.message);
    }
}

async function loadGitHubRepos() {
    try {
        const result = await CE.githubIntegration.getRepos();
        if (result.success) {
            const select = document.getElementById('github-repo-select');
            if (!select) return;
            select.innerHTML = '<option value="">Select repository</option>';
            result.repos.forEach(repo => {
                const option = document.createElement('option');
                option.value = repo.fullName;
                option.textContent = repo.name;
                select.appendChild(option);
            });
        }
    } catch (e) { }
}

async function logoutGitHub() {
    CE.githubIntegration?.logout();
    document.getElementById('github-auth-section')?.classList.remove('hidden');
    document.getElementById('github-main-section')?.classList.add('hidden');
    const input = document.getElementById('github-token-input');
    if (input) input.value = '';
}

async function pushToGitHub() {
    if (!CE.scanResults || !CE.scanResults.project) {
        showError('No project to push. Scan a page first.');
        return;
    }
    const repoFullName = document.getElementById('github-repo-select')?.value;
    if (!repoFullName) { showError('Please select a repository'); return; }

    const pushBtn = document.getElementById('github-push-btn');
    if (pushBtn) { pushBtn.disabled = true; pushBtn.textContent = 'Pushing...'; }

    try {
        const result = await CE.githubIntegration.pushProject(repoFullName, CE.scanResults.project, {
            branch: document.getElementById('github-branch-input')?.value || 'main',
            commitMessage: document.getElementById('github-commit-msg-input')?.value || `Add project: ${CE.scanResults.project.name}`
        });

        if (result.success) {
            const resDiv = document.getElementById('github-result');
            if (resDiv) {
                resDiv.classList.remove('hidden');
                resDiv.innerHTML = `
          <div class="github-success">
            <p>✅ Successfully pushed ${result.filesPushed} files!</p>
            <a href="${result.repoUrl}" target="_blank">View on GitHub</a>
          </div>
        `;
            }
        } else {
            showError(`Push failed: ${result.error}`);
        }
    } catch (error) {
        showError('Push failed: ' + error.message);
    } finally {
        if (pushBtn) { pushBtn.disabled = false; pushBtn.textContent = 'Push Project'; }
    }
}

async function createGitHubGist() {
    if (!CE.scanResults || !CE.scanResults.project) {
        showError('No project to create gist from. Scan a page first.');
        return;
    }

    const gistBtn = document.getElementById('github-gist-btn');
    if (gistBtn) { gistBtn.disabled = true; gistBtn.textContent = 'Creating...'; }

    try {
        const result = await CE.githubIntegration.createGist(CE.scanResults.project, {
            description: document.getElementById('github-gist-desc-input')?.value || `Code Extractor: ${CE.scanResults.project.name}`,
            isPublic: document.getElementById('github-gist-public')?.checked || false
        });

        if (result.success) {
            const resDiv = document.getElementById('github-result');
            if (resDiv) {
                resDiv.classList.remove('hidden');
                resDiv.innerHTML = `
          <div class="github-success">
            <p>✅ Gist created with ${result.filesCount} files!</p>
            <a href="${result.gistUrl}" target="_blank">View Gist</a>
          </div>
        `;
            }
        } else {
            showError(`Gist creation failed: ${result.error}`);
        }
    } catch (error) {
        showError('Gist creation failed: ' + error.message);
    } finally {
        if (gistBtn) { gistBtn.disabled = false; gistBtn.textContent = 'Create Gist'; }
    }
}
