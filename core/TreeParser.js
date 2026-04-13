if (typeof window.TreeParser === 'undefined') {
  window.TreeParser = class TreeParser {

    constructor() {
      this.treeStructures = [];
    }

    parseTree(text) {
      const lines = text.split("\n");
      const treeLines = [];

      for (const line of lines) {
        if (this.isTreeLine(line)) {
          treeLines.push(line);
        } else if (treeLines.length >= 2) {
          this.treeStructures.push(this.buildTree(treeLines));
          treeLines.length = 0;
        } else {
          treeLines.length = 0;
        }
      }

      if (treeLines.length >= 2) {
        this.treeStructures.push(this.buildTree(treeLines));
      }

      return this.treeStructures;
    }

    parseFromMessages(messages) {
      const trees = [];

      for (const message of messages) {
        const text = message.textContent || "";
        const lines = text.split("\n");
        let currentTree = [];

        for (const line of lines) {
          const trimmed = line.trim();
          if (this.isTreeLine(trimmed)) {
            currentTree.push(line);
          } else {
            if (currentTree.length >= 2) {
              trees.push(this.buildTree(currentTree));
            }
            currentTree = [];
          }
        }

        if (currentTree.length >= 2) {
          trees.push(this.buildTree(currentTree));
        }
      }

      this.treeStructures = trees;
      return trees;
    }

    isTreeLine(line) {
      const treeChars = ["├", "└", "│", "─", "┬", "┼"];
      const trimmed = line.trim();
      if (trimmed.length === 0) return false;
      return treeChars.some((char) => trimmed.includes(char));
    }

    buildTree(lines) {
      const root = { name: "root", children: [], depth: 0 };
      const stack = [root];

      for (const line of lines) {
        const depth = this.getDepth(line);
        const name = this.extractName(line);

        if (!name) continue;

        const node = { name, children: [], depth };

        while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
          stack.pop();
        }

        stack[stack.length - 1].children.push(node);
        stack.push(node);
      }

      return {
        raw: lines.join("\n"),
        structure: root.children,
        files: this.extractFiles(root),
        directories: this.extractDirectories(root),
        depth: this.getMaxDepth(root)
      };
    }

    getDepth(line) {
      const treeChars = ["│", "├", "└", " ", "─", "┬", "┼"];
      let depth = 0;
      const charsPerLevel = 4;

      for (let i = 0; i < line.length; i += charsPerLevel) {
        const segment = line.substring(i, i + charsPerLevel);
        const hasTreeChar = treeChars.some((char) => segment.includes(char));
        if (hasTreeChar) depth++;
        else break;
      }

      return depth;
    }

    extractName(line) {
      const treePattern = /^[│├└─\s┬┼]*/;
      return line.replace(treePattern, "").trim();
    }

    extractFiles(node, files = []) {
      for (const child of node.children) {
        if (child.children.length === 0) {
          files.push(child.name);
        } else {
          this.extractFiles(child, files);
        }
      }
      return files;
    }

    extractDirectories(node, dirs = []) {
      for (const child of node.children) {
        if (child.children.length > 0) {
          dirs.push(child.name);
          this.extractDirectories(child, dirs);
        }
      }
      return dirs;
    }

    getMaxDepth(node, currentDepth = 0) {
      if (node.children.length === 0) return currentDepth;
      return Math.max(...node.children.map((child) => this.getMaxDepth(child, currentDepth + 1)));
    }

    treeToPaths(tree) {
      const paths = [];

      const traverse = (node, currentPath = "") => {
        const fullPath = currentPath ? `${currentPath}/${node.name}` : node.name;
        if (node.children.length === 0) {
          paths.push(fullPath);
        } else {
          for (const child of node.children) {
            traverse(child, fullPath);
          }
        }
      };

      for (const child of tree.structure) {
        traverse(child);
      }

      return paths;
    }

    treeToMap(tree) {
      const map = {};

      const traverse = (node, currentPath = "") => {
        const fullPath = currentPath ? `${currentPath}/${node.name}` : node.name;
        if (node.children.length === 0) {
          map[fullPath] = { type: "file", name: node.name };
        } else {
          map[fullPath] = { type: "directory", name: node.name };
          for (const child of node.children) {
            traverse(child, fullPath);
          }
        }
      };

      for (const child of tree.structure) {
        traverse(child);
      }

      return map;
    }

    getStructures() {
      return this.treeStructures;
    }

    clear() {
      this.treeStructures = [];
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { TreeParser: window.TreeParser };
}
