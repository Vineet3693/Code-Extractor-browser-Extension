if (typeof window.TreeVisualizer === 'undefined') {
  window.TreeVisualizer = class TreeVisualizer {

    toASCII(treeNode, prefix = '', isLast = true, isRoot = true) {
      if (!treeNode) return '';

      let result = '';

      if (isRoot) {
        const name = treeNode.name || 'project';
        result += `${name}/\n`;
        const children = treeNode.children || [];
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          const last = i === children.length - 1;
          result += this.renderNode(child, '', last, false);
        }
        return result;
      }

      return this.renderNode(treeNode, prefix, isLast, false);
    }

    renderNode(node, prefix, isLast, isRoot) {
      if (!node) return '';

      const connector = isLast ? '└── ' : '├── ';
      const extension = isLast ? '    ' : '│   ';
      const name = node.name || 'unknown';
      const isDir = node.type === 'directory' || (node.children && node.children.length > 0) || name.endsWith('/');

      let result = `${prefix}${connector}${name}${isDir && !name.endsWith('/') ? '/' : ''}\n`;

      if (node.children && node.children.length > 0) {
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];
          result += this.renderNode(child, prefix + extension, i === node.children.length - 1, false);
        }
      }

      return result;
    }

    toHTML(treeNode, options = {}) {
      const { clickable = false, expandable = true, showIcons = true } = options;

      if (!treeNode) return '';

      const container = document.createElement('div');
      container.className = 'ce-tree-container';

      if (treeNode.children && treeNode.children.length > 0) {
        const rootName = treeNode.name || 'project';
        const rootEl = this.createTreeNodeElement(rootName, true, showIcons, clickable, expandable);
        container.appendChild(rootEl);

        const childContainer = document.createElement('div');
        childContainer.className = 'ce-tree-children';

        for (const child of treeNode.children) {
          childContainer.appendChild(this.buildTreeElement(child, '', showIcons, clickable, expandable));
        }

        container.appendChild(childContainer);
      }

      return container;
    }

    buildTreeElement(node, prefix, showIcons, clickable, expandable) {
      const container = document.createElement('div');
      container.className = 'ce-tree-node';

      const isDir = node.type === 'directory' || (node.children && node.children.length > 0) || (node.name || '').endsWith('/');
      const name = (node.name || '').replace(/\/$/, '');

      const row = document.createElement('div');
      row.className = 'ce-tree-row';

      if (showIcons) {
        const icon = document.createElement('span');
        icon.className = 'ce-tree-icon';
        icon.textContent = isDir ? '📁' : this.getFileIcon(name);
        row.appendChild(icon);
      }

      const nameEl = document.createElement('span');
      nameEl.className = 'ce-tree-name';
      nameEl.textContent = name;

      if (clickable && !isDir) {
        nameEl.classList.add('ce-tree-name-clickable');
        nameEl.addEventListener('click', () => {
          const event = new CustomEvent('ce-tree-file-click', {
            detail: { node, name, path: node.path || name }
          });
          nameEl.dispatchEvent(event);
        });
      }

      row.appendChild(nameEl);
      container.appendChild(row);

      if (isDir && node.children && node.children.length > 0 && expandable) {
        const childContainer = document.createElement('div');
        childContainer.className = 'ce-tree-children';

        for (const child of node.children) {
          childContainer.appendChild(this.buildTreeElement(child, prefix, showIcons, clickable, expandable));
        }

        container.appendChild(childContainer);
      }

      return container;
    }

    createTreeNodeElement(name, isDir, showIcons, clickable, expandable) {
      const row = document.createElement('div');
      row.className = 'ce-tree-row';

      if (showIcons) {
        const icon = document.createElement('span');
        icon.className = 'ce-tree-icon';
        icon.textContent = isDir ? '📁' : '📄';
        row.appendChild(icon);
      }

      const nameEl = document.createElement('span');
      nameEl.className = 'ce-tree-name';
      nameEl.textContent = name;
      row.appendChild(nameEl);

      return row;
    }

    toJSON(treeNode) {
      if (!treeNode) return null;

      const result = {
        name: treeNode.name || 'project',
        type: treeNode.type || (treeNode.children ? 'directory' : 'file'),
        path: treeNode.path || treeNode.name || '',
        language: treeNode.language || null,
        extension: treeNode.extension || null
      };

      if (treeNode.children && treeNode.children.length > 0) {
        result.children = treeNode.children.map(child => this.toJSON(child));
      }

      return result;
    }

    toFlatList(treeNode, basePath = '') {
      if (!treeNode) return [];

      const items = [];
      const name = treeNode.name || '';
      const path = basePath ? `${basePath}/${name}` : name;

      if (treeNode.children && treeNode.children.length > 0) {
        for (const child of treeNode.children) {
          items.push(...this.toFlatList(child, path));
        }
      } else {
        items.push({
          name,
          path,
          type: treeNode.type || 'file',
          language: treeNode.language || null,
          extension: treeNode.extension || null
        });
      }

      return items;
    }

    getFileIcon(fileName) {
      const ext = '.' + fileName.split('.').pop().toLowerCase();
      const icons = {
        '.py': '🐍',
        '.js': '📜',
        '.ts': '📘',
        '.tsx': '⚛️',
        '.jsx': '⚛️',
        '.html': '🌐',
        '.css': '🎨',
        '.scss': '🎨',
        '.json': '📋',
        '.yml': '⚙️',
        '.yaml': '⚙️',
        '.xml': '📄',
        '.md': '📝',
        '.sql': '🗃️',
        '.sh': '💻',
        '.ps1': '💻',
        '.java': '☕',
        '.go': '🔷',
        '.rs': '🦀',
        '.rb': '💎',
        '.php': '🐘',
        '.swift': '🐦',
        '.kt': '🔮',
        '.vue': '💚',
        '.svelte': '🔥',
        '.env': '🔐',
        '.gitignore': '🔒',
        '.txt': '📄',
        '.log': '📜'
      };

      const baseName = fileName.split('/').pop().toLowerCase();
      const specialIcons = {
        'dockerfile': '🐳',
        'makefile': '🔧',
        'jenkinsfile': '🔧',
        'vagrantfile': '📦',
        'gemfile': '💎',
        'license': '📜',
        'readme': '📝'
      };

      return specialIcons[baseName] || icons[ext] || '📄';
    }

    fromASCII(asciiText) {
      if (!asciiText || !asciiText.trim()) return null;

      const lines = asciiText.trim().split('\n');
      const root = { name: 'project', type: 'directory', children: [] };
      const stack = [{ node: root, depth: -1 }];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const treeChars = ['├', '└', '│', '─'];
        const depth = this.calculateDepth(line);
        const name = this.extractName(line);

        if (!name) continue;

        const isDir = name.endsWith('/') || !name.includes('.');
        const cleanName = name.replace(/\/$/, '');

        const node = {
          name: cleanName,
          type: isDir ? 'directory' : 'file',
          children: isDir ? [] : null,
          path: '',
          language: this.detectLanguageFromExt(cleanName),
          extension: this.getExtension(cleanName)
        };

        while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
          stack.pop();
        }

        const parent = stack[stack.length - 1].node;
        if (parent.children) {
          parent.children.push(node);
        }

        stack.push({ node, depth });
      }

      this.calculatePaths(root);
      return root;
    }

    calculateDepth(line) {
      const levelChars = ['│', '├', '└', ' '];
      const charsPerLevel = 4;
      let depth = 0;

      for (let i = 0; i < line.length; i += charsPerLevel) {
        const segment = line.substring(i, i + charsPerLevel);
        if (segment.trim().length === 0) {
          depth++;
          continue;
        }

        const hasTreeChar = levelChars.some(char => segment.includes(char));
        if (hasTreeChar) {
          depth++;
        } else {
          break;
        }
      }

      return depth - 1;
    }

    extractName(line) {
      const treePattern = /^[│├└─\s┬┼]*/;
      let name = line.replace(treePattern, '').trim();

      const commentMatch = name.match(/^(.+?)\s+#.*$/);
      if (commentMatch) {
        name = commentMatch[1].trim();
      }

      return name;
    }

    calculatePaths(node, basePath = '') {
      const currentPath = basePath ? `${basePath}/${node.name}` : node.name;
      node.path = currentPath;

      if (node.children) {
        for (const child of node.children) {
          this.calculatePaths(child, currentPath);
        }
      }
    }

    detectLanguageFromExt(fileName) {
      const ext = this.getExtension(fileName);
      const extMap = {
        '.py': 'python',
        '.js': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.jsx': 'javascript',
        '.html': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.json': 'json',
        '.yml': 'yaml',
        '.yaml': 'yaml',
        '.xml': 'xml',
        '.md': 'markdown',
        '.sql': 'sql',
        '.sh': 'bash',
        '.java': 'java',
        '.go': 'go',
        '.rs': 'rust',
        '.rb': 'ruby',
        '.php': 'php',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.vue': 'vue',
        '.svelte': 'svelte'
      };

      return extMap[ext] || null;
    }

    getExtension(fileName) {
      const lastDot = fileName.lastIndexOf('.');
      if (lastDot === -1) return '';
      return fileName.substring(lastDot).toLowerCase();
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { TreeVisualizer: window.TreeVisualizer };
}
