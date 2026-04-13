// ============================================================
// tab-deploy.js — Deploy Tab
// ============================================================

async function deployToPlatform(platform) {
    if (!CE.scanResults || !CE.scanResults.project) {
        showError('No project to deploy. Scan a page first.');
        return;
    }

    const statusEl = document.getElementById('deploy-status');
    if (!statusEl) return;
    statusEl.innerHTML = '<p class="empty-state">Deploying...</p>';

    const options = { projectName: CE.scanResults.project.name };

    switch (platform) {
        case 'vercel':
            options.vercelToken = document.getElementById('vercel-token-input')?.value;
            options.projectName = document.getElementById('vercel-project-name')?.value;
            break;
        case 'netlify':
            options.netlifyToken = document.getElementById('netlify-token-input')?.value;
            options.siteId = document.getElementById('netlify-site-id')?.value;
            break;
        case 'railway':
            options.railwayToken = document.getElementById('railway-token-input')?.value;
            options.railwayProjectId = document.getElementById('railway-project-id')?.value;
            break;
        case 'github_pages':
            options.githubToken = CE.githubIntegration?.token;
            options.repoFullName = document.getElementById('gh-pages-repo')?.value;
            options.branch = document.getElementById('gh-pages-branch')?.value || 'gh-pages';
            break;
    }

    let result;
    switch (platform) {
        case 'vercel': result = await CE.deploymentManager.deployToVercel(CE.scanResults.project, options); break;
        case 'netlify': result = await CE.deploymentManager.deployToNetlify(CE.scanResults.project, options); break;
        case 'railway': result = await CE.deploymentManager.deployToRailway(CE.scanResults.project, options); break;
        case 'github_pages': result = await CE.deploymentManager.deployToGitHubPages(CE.scanResults.project, options); break;
    }

    if (result && result.success) {
        statusEl.innerHTML = `
      <div class="deploy-success">
        <p>Deployed to ${platform}!</p>
        <a href="${result.deploymentUrl}" target="_blank">View deployment</a>
      </div>
    `;
        loadDeployHistory();
    } else {
        statusEl.innerHTML = `<div class="deploy-error"><p>Deploy failed: ${result?.error || 'Unknown error'}</p></div>`;
    }
}

async function loadDeployHistory() {
    if (!CE.deploymentManager) return;
    const deployments = CE.deploymentManager.getDeployments();
    const listEl = document.getElementById('deploy-history-list');
    if (!listEl) return;

    if (deployments.length === 0) {
        listEl.innerHTML = '<p class="empty-state">No deployments yet.</p>';
        return;
    }

    listEl.innerHTML = deployments.slice(0, 10).map(d => `
    <div class="deploy-history-item">
      <span class="deploy-platform">${d.platform}</span>
      <span class="deploy-project">${d.projectName}</span>
      <span class="deploy-date">${formatDate(d.deployedAt)}</span>
      <a href="${d.url}" target="_blank">View</a>
    </div>
  `).join('');
}
