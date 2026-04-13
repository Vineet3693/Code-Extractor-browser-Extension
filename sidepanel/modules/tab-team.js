// ============================================================
// tab-team.js — Team Tab
// ============================================================

async function createTeam() {
    const name = document.getElementById('team-name-input')?.value?.trim();
    const desc = document.getElementById('team-desc-input')?.value?.trim();
    if (!name) { showError('Team name is required'); return; }
    const result = await CE.teamCollaboration.createTeam(name, desc);
    if (result.success) {
        showTeamMainSection(result.team);
    } else {
        showError(result.error);
    }
}

async function joinTeam() {
    const code = document.getElementById('team-invite-code-input')?.value?.trim();
    if (!code) { showError('Invite code is required'); return; }
    const result = await CE.teamCollaboration.joinTeam(code);
    if (result.success) {
        showTeamMainSection(result.team);
    } else {
        showError(result.error);
    }
}

function showTeamMainSection(team) {
    const authSec = document.getElementById('team-auth-section');
    const mainSec = document.getElementById('team-main-section');
    if (authSec) authSec.classList.add('hidden');
    if (mainSec) mainSec.classList.remove('hidden');

    const nameDisplay = document.getElementById('team-name-display');
    if (nameDisplay) nameDisplay.textContent = team.name;

    const roleDisplay = document.getElementById('team-role-display');
    if (roleDisplay) roleDisplay.textContent = CE.teamCollaboration.role;

    loadTeamMembers();
}

async function loadTeamMembers() {
    if (!CE.teamCollaboration) return;
    const result = await CE.teamCollaboration.getTeamMembers();
    if (!result.success) return;
    const listEl = document.getElementById('team-members-list');
    if (!listEl) return;
    listEl.innerHTML = result.members.map(m => `
    <div class="team-member-item">
      <span class="member-id">${escapeHtml(m.userId)}</span>
      <span class="member-role-badge">${escapeHtml(m.role)}</span>
      <span class="member-joined">${formatDate(m.joinedAt)}</span>
    </div>
  `).join('');
}

async function shareProjectWithTeam() {
    if (!CE.scanResults?.project?.id || !CE.teamCollaboration) return;
    const result = await CE.teamCollaboration.shareProject(CE.scanResults.project.id);
    if (result.success) {
        showStatus('Project shared with team!');
        setTimeout(hideStatus, 2000);
    } else {
        showError(result.error);
    }
}
