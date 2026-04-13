if (typeof window.TeamCollaboration === 'undefined') {
  class TeamCollaboration {
    constructor(options = {}) {
      this.dbHelper = options.dbHelper;
      this.teamId = options.teamId || null;
      this.userId = this._generateUserId();
      this.role = 'member';
      this.pendingChanges = [];
      this.syncInterval = options.syncInterval || 5000;
      this._syncTimer = null;
    }

    async createTeam(name, desc) {
      if (!this.dbHelper) return { success: false, error: 'Database not initialized' };

      const teamId = this._generateId();
      const team = {
        id: teamId,
        name: name,
        description: desc,
        members: [{
          userId: this.userId,
          role: 'owner',
          joinedAt: Date.now()
        }],
        projects: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      try {
        await this.dbHelper.add('teams', team);
        this.teamId = teamId;
        this.role = 'owner';
        return { success: true, team };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    async joinTeam(code) {
      if (!this.dbHelper) return { success: false, error: 'Database not initialized' };

      const invite = await this._resolveInvite(code);
      if (!invite) return { success: false, error: 'Invalid or expired invite code' };

      const team = await this._getTeam(invite.teamId);
      if (!team) return { success: false, error: 'Team no longer exists' };

      if (team.members.find(m => m.userId === this.userId)) {
        this.teamId = team.id;
        this.role = team.members.find(m => m.userId === this.userId).role;
        return { success: true, team };
      }

      const member = {
        userId: this.userId,
        role: 'member',
        joinedAt: Date.now()
      };

      team.members.push(member);
      team.updatedAt = Date.now();

      try {
        await this.dbHelper.update('teams', team);
        this.teamId = team.id;
        this.role = 'member';
        return { success: true, team };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    async shareProject(projectId) {
      if (!this.teamId) return { success: false, error: 'Not part of a team' };

      const team = await this._getTeam(this.teamId);
      if (!team) return { success: false, error: 'Team not found' };

      if (team.projects.find(p => p.projectId === projectId)) {
        return { success: true, message: 'Project already shared' };
      }

      team.projects.push({
        projectId,
        sharedAt: Date.now(),
        attribution: {
          owner: this.userId,
          contributors: []
        }
      });

      team.updatedAt = Date.now();

      try {
        if (this.dbHelper) {
          await this.dbHelper.update('teams', team);
        }
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    async getTeamProjects() {
      if (!this.teamId) return { success: false, error: 'Not part of a team' };

      const team = await this._getTeam(this.teamId);
      if (!team) return { success: false, error: 'Team not found' };

      return { success: true, projects: team.projects, team };
    }

    async addContribution(projectId, fileName, contribution) {
      if (!this.teamId) return { success: false, error: 'Not part of a team' };

      const team = await this._getTeam(this.teamId);
      const projectShare = team.projects.find(p => p.projectId === projectId);
      if (!projectShare) {
        return { success: false, error: 'Project not shared with team' };
      }

      if (!projectShare.attribution.contributors.find(c => c.userId === this.userId)) {
        projectShare.attribution.contributors.push({
          userId: this.userId,
          contributions: []
        });
      }

      const contributor = projectShare.attribution.contributors.find(c => c.userId === this.userId);
      contributor.contributions.push({
        fileName,
        type: contribution.type || 'edit',
        timestamp: Date.now(),
        description: contribution.description || ''
      });

      team.updatedAt = Date.now();

      if (this.dbHelper) {
        await this.dbHelper.update('teams', team);
      }

      return { success: true };
    }

    async getProjectAttribution(projectId) {
      if (!this.teamId) return { success: false, error: 'Not part of a team' };

      const team = await this._getTeam(this.teamId);
      const projectShare = team.projects.find(p => p.projectId === projectId);
      if (!projectShare) {
        return { success: false, error: 'Project not shared with team' };
      }

      return { success: true, attribution: projectShare.attribution };
    }

    async leaveTeam() {
      if (!this.teamId) return { success: false, error: 'Not part of a team' };

      const team = await this._getTeam(this.teamId);
      if (!team) return { success: false, error: 'Team not found' };

      if (this.role === 'owner') {
        const otherMembers = team.members.filter(m => m.userId !== this.userId);
        if (otherMembers.length > 0) {
          const newOwner = otherMembers[0];
          newOwner.role = 'owner';
        } else {
          if (this.dbHelper) {
            await this.dbHelper.delete('teams', this.teamId);
          }
          this.teamId = null;
          this.role = 'member';
          return { success: true, message: 'Team deleted (no other members)' };
        }
      }

      team.members = team.members.filter(m => m.userId !== this.userId);
      team.updatedAt = Date.now();

      if (this.dbHelper) {
        await this.dbHelper.update('teams', team);
      }

      this.teamId = null;
      this.role = 'member';
      return { success: true, message: 'Left team successfully' };
    }

    async getTeamMembers() {
      if (!this.teamId) return { success: false, error: 'Not part of a team' };

      const team = await this._getTeam(this.teamId);
      if (!team) return { success: false, error: 'Team not found' };

      return { success: true, members: team.members, teamName: team.name };
    }

    async kickMember(userId) {
      if (!this.teamId || this.role !== 'owner') {
        return { success: false, error: 'Only team owners can kick members' };
      }

      const team = await this._getTeam(this.teamId);
      if (!team) return { success: false, error: 'Team not found' };

      team.members = team.members.filter(m => m.userId !== userId);
      team.updatedAt = Date.now();

      if (this.dbHelper) {
        await this.dbHelper.update('teams', team);
      }

      return { success: true };
    }

    async startAutoSync() {
      if (this._syncTimer) return;

      this._syncTimer = setInterval(async () => {
        if (this.pendingChanges.length > 0) {
          await this._syncChanges();
        }
      }, this.syncInterval);
    }

    stopAutoSync() {
      if (this._syncTimer) {
        clearInterval(this._syncTimer);
        this._syncTimer = null;
      }
    }

    queueChange(change) {
      this.pendingChanges.push({
        ...change,
        userId: this.userId,
        teamId: this.teamId,
        timestamp: Date.now()
      });
    }

    async _syncChanges() {
      if (!this.teamId || this.pendingChanges.length === 0) return;

      const changes = [...this.pendingChanges];
      this.pendingChanges = [];

      try {
        if (this.dbHelper) {
          await this.dbHelper.batchAdd('team_changes', changes);
        }

        chrome.runtime.sendMessage({
          action: 'TEAM_SYNC_CHANGES',
          data: { teamId: this.teamId, changes }
        }).catch(() => { });
      } catch (error) {
        this.pendingChanges.unshift(...changes);
        console.error('[TeamCollaboration] Sync failed:', error);
      }
    }

    async _getTeam(teamId) {
      if (!this.dbHelper) return null;
      try {
        return await this.dbHelper.get('teams', teamId);
      } catch (e) {
        return null;
      }
    }

    async _resolveInvite(code) {
      if (!this.dbHelper) return null;
      try {
        const invites = await this.dbHelper.query('invites', 'by_code', code);
        const invite = invites.find(i => i.status === 'pending' && i.expiresAt > Date.now());
        return invite || null;
      } catch (e) {
        return null;
      }
    }

    _generateUserId() {
      const stored = localStorage.getItem('team_user_id');
      if (stored) return stored;
      const id = 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('team_user_id', id);
      return id;
    }

    _generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    _generateInviteCode() {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        if (i > 0 && i % 4 === 0) code += '-';
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      return code;
    }

    getTeamInfo() {
      return { teamId: this.teamId, userId: this.userId, role: this.role };
    }
  }

  window.TeamCollaboration = TeamCollaboration;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { TeamCollaboration };
  }
}
