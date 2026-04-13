if (typeof window.GitHubIntegration === 'undefined') {
  class GitHubIntegration {
    constructor() {
      this.token = null;
      this.username = null;
      this.isAuthenticated = false;
      this.apiBase = 'https://api.github.com';
    }

    async authenticate(token) {
      this.token = token;
      try {
        const response = await this._apiRequest('/user');
        this.username = response.login;
        this.isAuthenticated = true;
        return { success: true, user: response };
      } catch (error) {
        this.isAuthenticated = false;
        this.token = null;
        return { success: false, error: error.message };
      }
    }

    async getRepos() {
      if (!this.isAuthenticated) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        const repos = await this._apiRequest('/user/repos?per_page=100&sort=updated');
        return {
          success: true,
          repos: repos.map(repo => ({
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description,
            isPrivate: repo.private,
            defaultBranch: repo.default_branch,
            updatedAt: repo.updated_at,
            htmlUrl: repo.html_url
          }))
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    async createRepo(name, options = {}) {
      if (!this.isAuthenticated) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        const repo = await this._apiRequest('/user/repos', 'POST', {
          name,
          description: options.description || 'Created by Code Extractor',
          private: options.isPrivate || false,
          autoInit: true
        });

        return {
          success: true,
          repo: {
            name: repo.name,
            fullName: repo.full_name,
            htmlUrl: repo.html_url,
            cloneUrl: repo.clone_url,
            defaultBranch: repo.default_branch
          }
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    async pushProject(repoFullName, project, options = {}) {
      if (!this.isAuthenticated) {
        return { success: false, error: 'Not authenticated' };
      }

      const branch = options.branch || 'main';
      const commitMessage = options.commitMessage || `Add project: ${project.name || 'extracted-project'}`;

      try {
        const files = project.files || [];
        const results = {
          success: true,
          filesPushed: 0,
          errors: [],
          commitUrl: null
        };

        for (const file of files) {
          const filePath = file.path || file.fileName;
          const content = file.content || '';

          try {
            await this._createOrUpdateFile(repoFullName, filePath, content, commitMessage, branch);
            results.filesPushed++;
          } catch (fileError) {
            results.errors.push({
              file: filePath,
              error: fileError.message
            });
          }
        }

        results.repoUrl = `https://github.com/${repoFullName}`;
        results.branchUrl = `https://github.com/${repoFullName}/tree/${branch}`;

        return results;
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    async createGist(project, options = {}) {
      if (!this.isAuthenticated) {
        return { success: false, error: 'Not authenticated' };
      }

      const files = {};
      for (const file of (project.files || [])) {
        const fileName = file.path || file.fileName;
        files[fileName] = { content: file.content || '' };
      }

      try {
        const gist = await this._apiRequest('/gists', 'POST', {
          description: options.description || `Code Extractor: ${project.name || 'Project'}`,
          public: options.isPublic !== false,
          files
        });

        return {
          success: true,
          gistUrl: gist.html_url,
          gistId: gist.id,
          filesCount: Object.keys(files).length
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    async getBranches(repoFullName) {
      if (!this.isAuthenticated) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        const branches = await this._apiRequest(`/repos/${repoFullName}/branches`);
        return {
          success: true,
          branches: branches.map(b => ({
            name: b.name,
            protected: b.protected,
            commitSha: b.commit.sha
          }))
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    async createBranch(repoFullName, branchName, baseBranch = 'main') {
      if (!this.isAuthenticated) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        const baseRef = await this._apiRequest(`/repos/${repoFullName}/git/ref/heads/${baseBranch}`);
        const sha = baseRef.object.sha;

        const newBranch = await this._apiRequest(
          `/repos/${repoFullName}/git/refs`,
          'POST',
          {
            ref: `refs/heads/${branchName}`,
            sha
          }
        );

        return {
          success: true,
          branch: {
            name: branchName,
            sha: newBranch.object.sha
          }
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    async createPullRequest(repoFullName, title, body, head, base = 'main') {
      if (!this.isAuthenticated) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        const pr = await this._apiRequest(
          `/repos/${repoFullName}/pulls`,
          'POST',
          {
            title,
            body,
            head,
            base
          }
        );

        return {
          success: true,
          pr: {
            number: pr.number,
            title: pr.title,
            htmlUrl: pr.html_url,
            state: pr.state
          }
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    async getFileContent(repoFullName, filePath, branch = 'main') {
      if (!this.isAuthenticated) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        const response = await this._apiRequest(
          `/repos/${repoFullName}/contents/${filePath}?ref=${branch}`
        );

        const content = atob(response.content.replace(/\n/g, ''));
        return {
          success: true,
          content,
          sha: response.sha,
          size: response.size
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    logout() {
      this.token = null;
      this.username = null;
      this.isAuthenticated = false;
    }

    getAuthStatus() {
      return {
        isAuthenticated: this.isAuthenticated,
        username: this.username,
        hasToken: !!this.token
      };
    }

    async _createOrUpdateFile(repoFullName, filePath, content, message, branch) {
      try {
        const existing = await this._apiRequest(
          `/repos/${repoFullName}/contents/${filePath}?ref=${branch}`
        );

        await this._apiRequest(
          `/repos/${repoFullName}/contents/${filePath}`,
          'PUT',
          {
            message,
            content: btoa(unescape(encodeURIComponent(content))),
            sha: existing.sha,
            branch
          }
        );
      } catch (error) {
        if (error.status === 404) {
          await this._apiRequest(
            `/repos/${repoFullName}/contents/${filePath}`,
            'PUT',
            {
              message,
              content: btoa(unescape(encodeURIComponent(content))),
              branch
            }
          );
        } else {
          throw error;
        }
      }
    }

    async _apiRequest(endpoint, method = 'GET', body = null) {
      const url = endpoint.startsWith('http') ? endpoint : `${this.apiBase}${endpoint}`;

      const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${this.token}`,
        'Content-Type': 'application/json'
      };

      const options = {
        method,
        headers
      };

      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.message || `HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }

      if (response.status === 204) return null;
      return response.json();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GitHubIntegration };
  }
  window.GitHubIntegration = GitHubIntegration;
}
