if (typeof window.DuplicateHandler === 'undefined') {
  window.DuplicateHandler = class DuplicateHandler {

    constructor(strategy = "latest") {
      this.strategy = strategy;
      this.seenFiles = new Map();
      this.duplicates = [];
    }

    setStrategy(strategy) {
      this.strategy = strategy;
    }

    handleDuplicates(files) {
      this.seenFiles.clear();
      this.duplicates = [];

      const uniqueFiles = [];

      for (const file of files) {
        const path = file.path || file.fileName;
        const existing = this.seenFiles.get(path);

        if (existing) {
          this.duplicates.push({
            path,
            existing,
            newFile: file,
            action: this.strategy
          });

          switch (this.strategy) {
            case "latest": {
              this.seenFiles.set(path, file);
              const existingIndex = uniqueFiles.findIndex((f) => (f.path || f.fileName) === path);
              if (existingIndex !== -1) {
                uniqueFiles[existingIndex] = file;
              }
              break;
            }

            case "keep_first":
              break;

            case "keep_both": {
              const ext = this.getExtension(path);
              const base = this.getBaseName(path);
              let newPath = path;
              let counter = 1;
              while (this.seenFiles.has(newPath)) {
                newPath = `${base}_copy${counter}${ext}`;
                counter++;
              }
              const newFile = { ...file, path: newPath, fileName: this.getBaseName(newPath) };
              this.seenFiles.set(newPath, newFile);
              uniqueFiles.push(newFile);
              break;
            }

            case "merge": {
              const merged = {
                ...existing,
                content: existing.content + "\n\n" + file.content,
                size: existing.size + file.size,
                lines: existing.lines + file.lines,
                mergedFrom: [existing, file]
              };
              this.seenFiles.set(path, merged);
              const mergeIndex = uniqueFiles.findIndex((f) => (f.path || f.fileName) === path);
              if (mergeIndex !== -1) {
                uniqueFiles[mergeIndex] = merged;
              }
              break;
            }

            default:
              this.seenFiles.set(path, file);
          }
        } else {
          this.seenFiles.set(path, file);
          uniqueFiles.push(file);
        }
      }

      return uniqueFiles;
    }

    getExtension(path) {
      const lastDot = path.lastIndexOf(".");
      if (lastDot === -1) return "";
      return path.substring(lastDot);
    }

    getBaseName(path) {
      const parts = path.split("/");
      return parts[parts.length - 1];
    }

    findDuplicates(files) {
      const pathCount = new Map();

      for (const file of files) {
        const path = file.path || file.fileName;
        pathCount.set(path, (pathCount.get(path) || 0) + 1);
      }

      const duplicates = [];
      for (const [path, count] of pathCount) {
        if (count > 1) {
          duplicates.push({ path, count });
        }
      }

      return duplicates;
    }

    getDuplicateReport() {
      return {
        totalDuplicates: this.duplicates.length,
        strategy: this.strategy,
        duplicates: this.duplicates.map((d) => ({
          path: d.path,
          action: d.action,
          existingSize: d.existing.size,
          newFileSize: d.newFile.size
        }))
      };
    }

    getSeenFiles() {
      return Array.from(this.seenFiles.values());
    }

    reset() {
      this.seenFiles.clear();
      this.duplicates = [];
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { DuplicateHandler: window.DuplicateHandler };
}
