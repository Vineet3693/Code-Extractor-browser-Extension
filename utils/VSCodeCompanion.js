if (typeof window.VSCodeCompanion === 'undefined') {
  class VSCodeCompanion {
    constructor(options = {}) {
      this.dbHelper = options.dbHelper;
      this.extensionId = options.extensionId || 'code-extractor.vscode-companion';
      this._connection = null;
      this._connected = false;
      this._messageQueue = [];
      this.stats = { projectsSent: 0, filesReceived: 0, errors: 0 };
    }

    async sendProjectToVSCode(project) {
      if (!this._connected) {
        const connected = await this._tryConnect();
        if (!connected) {
          return this._fallbackSendToVSCode(project);
        }
      }

      try {
        const message = {
          type: 'project_data',
          project: {
            id: project.id,
            name: project.name,
            sourceUrl: project.sourceUrl,
            files: project.files,
            summary: project.summary,
            timestamp: Date.now()
          }
        };

        const response = await this._sendMessage(message);
        this.stats.projectsSent++;
        this.stats.filesReceived += project.files?.length || 0;
        return { success: true, response };
      } catch (error) {
        this.stats.errors++;
        return this._fallbackSendToVSCode(project);
      }
    }

    async openProjectInVSCode(project) {
      const files = project.files || [];
      const workspace = {
        folders: [{
          name: project.name || 'extracted-project',
          uri: this._generateWorkspaceUri(project.name)
        }]
      };

      const protocol = {
        type: 'open_project',
        workspace,
        files: files.map(f => ({
          path: f.path || f.fileName,
          content: f.content || '',
          language: f.language || 'text'
        })),
        metadata: {
          source: 'code-extractor-extension',
          sourceUrl: project.sourceUrl,
          timestamp: Date.now()
        }
      };

      return this._openViaProtocol(protocol);
    }

    async sendFileToVSCode(filePath, content, options = {}) {
      const message = {
        type: 'open_file',
        path: filePath,
        content,
        language: options.language || 'text',
        revealLine: options.revealLine || null
      };

      try {
        await this._sendMessage(message);
        return { success: true };
      } catch (error) {
        return this._fallbackOpenFile(filePath, content);
      }
    }

    async getVSCodeStatus() {
      try {
        const connected = await this._tryConnect();
        return {
          connected,
          extensionId: this.extensionId,
          stats: { ...this.stats }
        };
      } catch (error) {
        return {
          connected: false,
          extensionId: this.extensionId,
          error: error.message,
          stats: { ...this.stats }
        };
      }
    }

    async _tryConnect() {
      try {
        const response = await chrome.runtime.sendMessage(this.extensionId, {
          type: 'ping',
          source: 'code-extractor-extension'
        });

        if (response && response.type === 'pong') {
          this._connected = true;
          this._flushMessageQueue();
          return true;
        }
      } catch (e) {
        this._connected = false;
      }
      return false;
    }

    async _sendMessage(message) {
      if (!this._connected) {
        const connected = await this._tryConnect();
        if (!connected) {
          this._messageQueue.push(message);
          throw new Error('VS Code not connected');
        }
      }

      try {
        return await chrome.runtime.sendMessage(this.extensionId, message);
      } catch (error) {
        this._connected = false;
        this._messageQueue.push(message);
        throw error;
      }
    }

    _flushMessageQueue() {
      while (this._messageQueue.length > 0) {
        const message = this._messageQueue.shift();
        chrome.runtime.sendMessage(this.extensionId, message).catch(() => {
          this._messageQueue.unshift(message);
          this._connected = false;
        });
      }
    }

    _fallbackSendToVSCode(project) {
      const files = project.files || [];
      const fileMap = {};

      for (const file of files) {
        const path = file.path || file.fileName || 'unknown.txt';
        fileMap[path] = { content: file.content || '' };
      }

      const readmeGenerator = new ReadmeGenerator();
      const dependencyGenerator = new DependencyGenerator();

      if (project.name) {
        fileMap['README.md'] = {
          content: readmeGenerator.generate({
            name: project.name,
            files,
            tree: this._buildTree(files),
            metadata: {
              sourceSiteName: project.sourceUrl,
              extractedAt: new Date().toISOString()
            }
          })
        };
      }

      const deps = dependencyGenerator.generate({ name: project.name, files });
      if (deps.python) fileMap['requirements.txt'] = { content: deps.python };
      if (deps.node) fileMap['package.json'] = { content: deps.node };

      const payload = {
        type: 'project_data_fallback',
        project: {
          name: project.name || 'extracted-project',
          files: fileMap,
          sourceUrl: project.sourceUrl,
          timestamp: Date.now()
        }
      };

      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      const protocol = this._protocolOverride || 'vscode';
      const url = `${protocol}://code-extractor.vscode-companion/import?data=${encoded}`;

      return this._openViaProtocol({ type: 'fallback', url });
    }

    _fallbackOpenFile(filePath, content) {
      const payload = {
        type: 'open_file_fallback',
        path: filePath,
        content,
        timestamp: Date.now()
      };

      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      const url = `vscode://code-extractor.vscode-companion/open-file?data=${encoded}`;

      return this._openViaProtocol({ url });
    }

    _openViaProtocol(data) {
      if (data.url) {
        window.open(data.url, '_blank');
        return { success: true, method: 'protocol_handler', url: data.url };
      }

      return { success: false, error: 'No protocol URL available' };
    }

    _generateWorkspaceUri(name) {
      const safeName = (name || 'extracted-project').replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
      return `file:///tmp/${safeName}`;
    }

    _buildTree(files) {
      const tree = { name: 'root', children: [] };

      for (const file of files) {
        const path = file.path || file.fileName || 'unknown.txt';
        const parts = path.split('/');
        let current = tree;

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          let child = current.children.find(c => c.name === part);

          if (!child) {
            child = {
              name: part,
              children: i < parts.length - 1 ? [] : null,
              file: i === parts.length - 1 ? file : null
            };
            current.children.push(child);
          }

          current = child;
        }
      }

      return tree;
    }

    getStats() {
      return { ...this.stats, queued: this._messageQueue.length };
    }
  }

  window.VSCodeCompanion = VSCodeCompanion;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { VSCodeCompanion };
  }
}
