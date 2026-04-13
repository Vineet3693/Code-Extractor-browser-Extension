if (typeof window.IncrementalMerger === 'undefined') {
  window.IncrementalMerger = class IncrementalMerger {

    constructor(options = {}) {
      this.fileNameDetector = options.fileNameDetector || null;
      this.languageIdentifier = options.languageIdentifier || null;
      this.similarityThreshold = options.similarityThreshold || 0.5;
    }

    merge(existingProject, newBlocks) {
      const result = {
        updatedProject: JSON.parse(JSON.stringify(existingProject)),
        addedFiles: [],
        updatedFiles: [],
        unchangedFiles: [],
        conflicts: [],
        summary: { added: 0, updated: 0, unchanged: 0, conflicts: 0 }
      };

      if (!existingProject || !existingProject.files) {
        result.updatedProject = { files: [], name: existingProject?.name || 'merged-project', totalFiles: 0, totalLines: 0, totalSize: 0 };
        for (const block of newBlocks) {
          const file = this._createFileFromBlock(block);
          result.updatedProject.files.push(file);
          result.addedFiles.push(file);
          result.summary.added++;
        }
        this._recalculateTotals(result.updatedProject);
        return result;
      }

      const existingFileMap = new Map();
      existingProject.files.forEach((file, index) => {
        const key = (file.path || file.fileName || '').toLowerCase();
        existingFileMap.set(key, { file, index });
      });

      for (const block of newBlocks) {
        let detectedFile;
        if (this.fileNameDetector) {
          const normalizedBlock = {
            code: block.content || block.code || '',
            label: block.label || block.fileName || '',
            textBefore: block.textBefore || '',
            textAfter: block.textAfter || '',
            surroundingText: block.surroundingText || '',
            language: block.language || '',
            index: block.index || 0
          };
          const detectedName = this.fileNameDetector.detectFileName(normalizedBlock);
          detectedFile = { fileName: detectedName, path: block.path || detectedName };
        } else {
          detectedFile = { fileName: block.fileName || block.label || `file_${Date.now()}.txt`, path: block.path || block.fileName || null };
        }

        const fileKey = (detectedFile.path || detectedFile.fileName || '').toLowerCase();
        const existing = existingFileMap.get(fileKey);

        if (!existing) {
          const newFile = this._createFileFromBlock(block, detectedFile);
          result.updatedProject.files.push(newFile);
          result.addedFiles.push(newFile);
          result.summary.added++;
          existingFileMap.set(fileKey, { file: newFile, index: result.updatedProject.files.length - 1 });
        } else {
          const oldContent = existing.file.content || '';
          const newContent = block.content || block.code || '';

          if (oldContent === newContent) {
            result.unchangedFiles.push(existing.file);
            result.summary.unchanged++;
          } else {
            const updateType = this.detectUpdateType(oldContent, newContent);

            if (updateType === 'UNRELATED') {
              const conflict = {
                fileName: detectedFile.fileName || detectedFile.path,
                filePath: detectedFile.path || detectedFile.fileName,
                type: 'content_conflict',
                oldContent,
                newContent,
                oldFile: existing.file,
                newBlock: block,
                resolution: null,
                timestamp: Date.now()
              };
              result.conflicts.push(conflict);
              result.summary.conflicts++;
            } else {
              const updatedFile = {
                ...existing.file,
                content: newContent,
                size: newContent.length,
                lines: newContent.split('\n').length,
                updatedAt: Date.now(),
                updateType,
                previousContent: oldContent
              };

              result.updatedProject.files[existing.index] = updatedFile;
              result.updatedFiles.push(updatedFile);
              result.summary.updated++;
              existingFileMap.set(fileKey, { file: updatedFile, index: existing.index });
            }
          }
        }
      }

      this._recalculateTotals(result.updatedProject);
      return result;
    }

    detectUpdateType(oldContent, newContent) {
      if (!oldContent || !newContent) return 'REPLACEMENT';

      const similarity = this.calculateSimilarity(oldContent, newContent);

      if (newContent.startsWith(oldContent) && newContent.length > oldContent.length) {
        return 'EXTENSION';
      }

      if (oldContent.startsWith(newContent) && oldContent.length > newContent.length) {
        return 'MODIFICATION';
      }

      if (similarity > 0.9) {
        return 'MODIFICATION';
      } else if (similarity > 0.5) {
        return 'MODIFICATION';
      } else if (similarity > 0.2) {
        return 'REPLACEMENT';
      } else {
        return 'UNRELATED';
      }
    }

    calculateSimilarity(text1, text2) {
      if (!text1 || !text2) return 0;
      if (text1 === text2) return 1.0;

      const lines1 = text1.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const lines2 = text2.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      if (lines1.length === 0 && lines2.length === 0) return 1.0;
      if (lines1.length === 0 || lines2.length === 0) return 0;

      const set1 = new Set(lines1);
      const set2 = new Set(lines2);

      let matchingLines = 0;
      for (const line of set1) {
        if (set2.has(line)) {
          matchingLines++;
        }
      }

      const maxLines = Math.max(set1.size, set2.size);
      return matchingLines / maxLines;
    }

    resolveConflict(conflict, resolution) {
      const { KEEP_OLD, USE_NEW, KEEP_BOTH, RENAME_NEW } = resolution;

      switch (resolution) {
        case 'KEEP_OLD':
          return { action: 'keep_old', file: conflict.oldFile };

        case 'USE_NEW':
          const newFile = this._createFileFromBlock(conflict.newBlock, {
            fileName: conflict.fileName,
            path: conflict.filePath
          });
          return { action: 'use_new', file: newFile };

        case 'KEEP_BOTH':
          const mergedContent = conflict.oldContent + '\n\n' + conflict.newContent;
          const mergedFile = {
            ...conflict.oldFile,
            content: mergedContent,
            size: mergedContent.length,
            lines: mergedContent.split('\n').length,
            merged: true,
            mergedFrom: [conflict.oldFile, conflict.newBlock]
          };
          return { action: 'keep_both', file: mergedFile };

        case 'RENAME_NEW':
          const ext = this._getExtension(conflict.fileName);
          const base = this._getBaseName(conflict.fileName);
          const newName = `${base}_v2${ext}`;
          const renamedFile = this._createFileFromBlock(conflict.newBlock, {
            fileName: newName,
            path: conflict.filePath ? conflict.filePath.replace(conflict.fileName, newName) : newName
          });
          return { action: 'rename_new', file: renamedFile };

        default:
          return { action: 'keep_old', file: conflict.oldFile };
      }
    }

    _createFileFromBlock(block, detected = {}) {
      const content = block.content || block.code || '';
      const fileName = detected.fileName || block.fileName || `file_${Date.now()}.txt`;
      const path = detected.path || block.path || fileName;

      return {
        fileName,
        path,
        content,
        language: block.language || this.languageIdentifier?.identify(content) || 'text',
        size: content.length,
        lines: content.split('\n').length,
        source: block.source || 'live_scan',
        timestamp: block.timestamp || Date.now(),
        isNew: true
      };
    }

    _recalculateTotals(project) {
      project.totalFiles = project.files?.length || 0;
      project.totalLines = project.files?.reduce((sum, f) => sum + (f.lines || 0), 0) || 0;
      project.totalSize = project.files?.reduce((sum, f) => sum + (f.size || 0), 0) || 0;
    }

    _getExtension(path) {
      const lastDot = path.lastIndexOf('.');
      return lastDot === -1 ? '' : path.substring(lastDot);
    }

    _getBaseName(path) {
      const parts = path.split('/');
      const fileName = parts[parts.length - 1];
      const ext = this._getExtension(fileName);
      return ext ? fileName.substring(0, fileName.length - ext.length) : fileName;
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { IncrementalMerger: window.IncrementalMerger };
}
