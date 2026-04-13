// ============================================================
// state.js — Shared global state for all sidepanel modules
// All tab modules read/write window.CE to share data.
// ============================================================

window.CE = window.CE || {};

Object.assign(window.CE, {
    // Scan state
    scanResults: null,
    currentSettings: {},
    chartInstances: { languages: null, timeline: null },

    // Live scanner state
    liveScannerActive: false,
    liveScanStats: { detected: 0, added: 0, updated: 0, startTime: null },
    liveLogEntries: [],

    // Diff conflict state
    conflictScanData: null,
    conflictList: [],
    currentConflictIndex: 0,
    duplicateDiffViewerInst: null,

    // Bulk file selection
    selectedFiles: new Set(),

    // IDE export modal state
    selectedIde: 'vscode',
    selectedExportFormat: 'folder',

    // Module instances (set by initV2Modules)
    templateManager: null,
    githubIntegration: null,
    ideExport: null,
    codeDiffViewer: null,
    dbHelper: null,
    universalSearch: null,
    versionHistory: null,
    aiFilenameRefiner: null,
    teamCollaboration: null,
    cloudSync: null,
    customParserBuilder: null,
    apiBridge: null,
    vscodeCompanion: null,
    projectAnalytics: null,
    deploymentManager: null,

    // Saved notes
    savedNotes: []
});
