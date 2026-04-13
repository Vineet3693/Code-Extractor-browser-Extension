if (typeof window.ScanStateManager === 'undefined') {
  window.ScanStateManager = class ScanStateManager {

    constructor() {
      this.scanId = null;
      this.initialScanComplete = false;
      this.liveMode = false;
      this.scannedElements = new Map();
      this.projectSnapshot = null;
      this.changeLog = [];
      this.startTime = null;
      this.endTime = null;
    }

    startSession(scanId) {
      this.scanId = scanId || `scan_${Date.now().toString(36)}`;
      this.initialScanComplete = false;
      this.liveMode = false;
      this.scannedElements.clear();
      this.changeLog = [];
      this.startTime = Date.now();
      this.endTime = null;
      this.projectSnapshot = null;
      return this.scanId;
    }

    markInitialScanComplete() {
      this.initialScanComplete = true;
      this.recordChange({
        type: 'scan_started',
        source: 'initial_scan',
        timestamp: Date.now()
      });
    }

    enableLiveMode() {
      this.liveMode = true;
      this.recordChange({
        type: 'live_mode_enabled',
        source: 'system',
        timestamp: Date.now()
      });
    }

    disableLiveMode() {
      this.liveMode = false;
      this.recordChange({
        type: 'live_mode_disabled',
        source: 'system',
        timestamp: Date.now()
      });
    }

    markElementScanned(elementId, codeBlock) {
      this.scannedElements.set(elementId, {
        scannedAt: Date.now(),
        codeBlockId: codeBlock?.index || codeBlock?.id || elementId,
        contentHash: this._hashContent(codeBlock?.content || codeBlock?.code || ''),
        language: codeBlock?.language || 'unknown',
        lines: codeBlock?.lines || 0
      });
    }

    isElementScanned(elementId) {
      return this.scannedElements.has(elementId);
    }

    recordChange(change) {
      const entry = {
        id: `change_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        scanId: this.scanId,
        timestamp: Date.now(),
        source: 'initial_scan',
        ...change
      };
      this.changeLog.push(entry);
      return entry.id;
    }

    recordFileAdded(fileName, filePath, content, language) {
      return this.recordChange({
        type: 'file_added',
        fileName,
        filePath,
        content,
        language,
        contentLength: content?.length || 0,
        lineCount: content?.split('\n').length || 0
      });
    }

    recordFileUpdated(fileName, filePath, oldContent, newContent, updateType) {
      return this.recordChange({
        type: 'file_updated',
        fileName,
        filePath,
        previousContent: oldContent,
        newContent,
        updateType,
        oldLength: oldContent?.length || 0,
        newLength: newContent?.length || 0,
        diffSize: (newContent?.length || 0) - (oldContent?.length || 0)
      });
    }

    recordFileRemoved(fileName, filePath) {
      return this.recordChange({
        type: 'file_removed',
        fileName,
        filePath
      });
    }

    recordConflict(fileName, filePath, oldContent, newContent, resolution) {
      return this.recordChange({
        type: 'conflict',
        fileName,
        filePath,
        oldContent,
        newContent,
        resolution,
        resolvedAt: resolution ? Date.now() : null
      });
    }

    takeSnapshot(project) {
      this.projectSnapshot = {
        timestamp: Date.now(),
        project: JSON.parse(JSON.stringify(project)),
        changeCount: this.changeLog.length
      };
    }

    getChangeLog() {
      return [...this.changeLog];
    }

    getChangesByType(type) {
      return this.changeLog.filter(c => c.type === type);
    }

    getChangesForFile(fileName) {
      return this.changeLog.filter(c => c.fileName === fileName);
    }

    getSessionStats() {
      return {
        sessionId: this.scanId,
        startTime: this.startTime,
        endTime: this.endTime,
        duration: this.endTime ? this.endTime - this.startTime : Date.now() - this.startTime,
        totalElementsScanned: this.scannedElements.size,
        totalChanges: this.changeLog.length,
        addedFiles: this.changeLog.filter(c => c.type === 'file_added').length,
        updatedFiles: this.changeLog.filter(c => c.type === 'file_updated').length,
        removedFiles: this.changeLog.filter(c => c.type === 'file_removed').length,
        conflicts: this.changeLog.filter(c => c.type === 'conflict').length,
        isLiveMode: this.liveMode,
        initialScanComplete: this.initialScanComplete
      };
    }

    endSession() {
      this.endTime = Date.now();
      this.liveMode = false;
      return this.getSessionStats();
    }

    reset() {
      this.scanId = null;
      this.initialScanComplete = false;
      this.liveMode = false;
      this.scannedElements.clear();
      this.projectSnapshot = null;
      this.changeLog = [];
      this.startTime = null;
      this.endTime = null;
    }

    _hashContent(content) {
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(36);
    }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ScanStateManager: window.ScanStateManager };
}
