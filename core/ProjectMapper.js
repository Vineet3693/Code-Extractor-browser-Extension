if (typeof window.ProjectMapper === 'undefined') {
  window.ProjectMapper = class ProjectMapper {

    constructor() {
      this.fileMap = new Map();
    }

    mapFiles(codeBlocks) {
      this.fileMap.clear();

      for (const block of codeBlocks) {
        const fileName = block.fileName || `file_${block.index + 1}.txt`;
        const path = this.determinePath(block, fileName);

        this.fileMap.set(path, {
          path,
          fileName: this.getBaseName(fileName),
          content: block.code || block.content || "",
          language: block.language,
          source: block.source || "Unknown",
          url: block.url || "",
          timestamp: block.timestamp || Date.now(),
          size: (block.code || block.content || "").length,
          lines: (block.code || block.content || "").split("\n").length,
          label: block.label || null,
          hash: block.hash || null
        });
      }

      return this.getFileStructure();
    }

    determinePath(block, fileName) {
      if (block.fileName && block.fileName.includes("/")) {
        return this.normalizePath(block.fileName);
      }

      if (block.fileName && block.fileName.includes("\\")) {
        return this.normalizePath(block.fileName.replace(/\\/g, "/"));
      }

      const langDir = this.getLanguageDirectory(block.language);
      if (langDir) {
        return `${langDir}/${fileName}`;
      }

      return fileName;
    }

    getLanguageDirectory(language) {
      const dirMap = {
        python: "src",
        javascript: "src",
        typescript: "src",
        html: "public",
        css: "public/css",
        scss: "src/styles",
        json: "config",
        yaml: "config",
        sql: "database",
        bash: "scripts",
        powershell: "scripts",
        dockerfile: "",
        makefile: ""
      };
      return dirMap[language?.toLowerCase()] || null;
    }

    normalizePath(path) {
      const parts = path.split("/");
      const normalized = [];

      for (const part of parts) {
        if (part === "." || part === "") continue;
        if (part === "..") {
          if (normalized.length > 0) normalized.pop();
          continue;
        }
        normalized.push(part);
      }

      return normalized.join("/");
    }

    getBaseName(path) {
      const parts = path.split("/");
      return parts[parts.length - 1];
    }

    getFileStructure() {
      const structure = {
        files: [],
        directories: new Set(),
        tree: {}
      };

      for (const [path, fileInfo] of this.fileMap) {
        structure.files.push(fileInfo);

        const parts = path.split("/");
        if (parts.length > 1) {
          for (let i = 0; i < parts.length - 1; i++) {
            structure.directories.add(parts.slice(0, i + 1).join("/"));
          }
        }

        this.addToTree(structure.tree, path, fileInfo);
      }

      structure.directories = Array.from(structure.directories);
      return structure;
    }

    addToTree(tree, path, fileInfo) {
      const parts = path.split("/");
      let current = tree;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = i === parts.length - 1 ? { __file__: fileInfo } : {};
        }
        current = current[part];
      }
    }

    getTreeString(tree = null, prefix = "", isLast = true, isRoot = true) {
      if (isRoot) {
        tree = this.getFileStructure().tree;
        prefix = "";
        isLast = true;
      }

      let result = "";
      const entries = Object.entries(tree).filter(([key]) => key !== "__file__");

      for (let i = 0; i < entries.length; i++) {
        const [name, value] = entries[i];
        const connector = i === entries.length - 1 ? "└── " : "├── ";
        const extension = i === entries.length - 1 ? "    " : "│   ";

        if (value.__file__) {
          result += `${prefix}${connector}${name}\n`;
        } else {
          result += `${prefix}${connector}${name}/\n`;
          result += this.getTreeString(value, prefix + extension, i === entries.length - 1, false);
        }
      }

      return result;
    }

    getFlatList() {
      return Array.from(this.fileMap.entries()).map(([path, info]) => ({
        path,
        fileName: info.fileName,
        language: info.language,
        size: info.size,
        lines: info.lines,
        source: info.source
      }));
    }

    getSummary() {
      const structure = this.getFileStructure();
      const languages = {};
      const sources = {};

      for (const file of structure.files) {
        languages[file.language] = (languages[file.language] || 0) + 1;
        sources[file.source] = (sources[file.source] || 0) + 1;
      }

      return {
        totalFiles: structure.files.length,
        totalDirectories: structure.directories.length,
        totalSize: structure.files.reduce((sum, f) => sum + f.size, 0),
        totalLines: structure.files.reduce((sum, f) => sum + f.lines, 0),
        languages,
        sources,
        treeString: this.getTreeString()
      };
    }

    clear() {
      this.fileMap.clear();
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ProjectMapper: window.ProjectMapper };
}
