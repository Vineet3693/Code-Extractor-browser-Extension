// ============================================================
// tab-merger.js — Logic for handling broken code blocks
// ============================================================

/**
 * Automatically identifies and merges consecutive code blocks 
 * that appear to belong to the same file.
 */
function autoMergeSplitBlocks(files) {
    if (!files || files.length < 2) return files;

    const merged = [];
    let current = files[0];

    for (let i = 1; i < files.length; i++) {
        const next = files[i];

        // Strategy 1: Same path/filename in same scan
        const isSamePath = (current.path && next.path && current.path === next.path) ||
            (current.fileName && next.fileName && current.fileName === next.fileName);

        // Strategy 2: Continuation Heuristic
        // If the first block ends in a state that looks "open" (no closing brace, mid-line)
        // and the second block starts without header-like content.
        const currentContent = (current.content || current.code || '').trim();
        const nextContent = (next.content || next.code || '').trim();

        const endsOpen = currentContent.endsWith('{') ||
            currentContent.endsWith(',') ||
            currentContent.endsWith('(') ||
            (!currentContent.endsWith('}') && !currentContent.endsWith(';') && currentContent.length > 0);

        const startsContinuing = !nextContent.startsWith('import') &&
            !nextContent.startsWith('class') &&
            !nextContent.startsWith('function') &&
            !nextContent.startsWith('//') &&
            !nextContent.startsWith('/*');

        if (isSamePath || (endsOpen && startsContinuing && current.language === next.language)) {
            console.log('[Merger] Merging detected split blocks for:', current.path || 'unnamed_file');
            current.content = (current.content || current.code || '') + '\n' + (next.content || next.code || '');
            current.code = current.content;
            current.lines = current.content.split('\n').length;
            current.size = new Blob([current.content]).size;
            current.isMerged = true;
        } else {
            merged.push(current);
            current = next;
        }
    }
    merged.push(current);
    return merged;
}

/**
 * Manually merges selected files
 */
function manualMergeFiles(fileIndexes) {
    if (!CE.scanResults || !CE.scanResults.files) return;
    const filesToMerge = fileIndexes.map(i => CE.scanResults.files[i]);

    if (filesToMerge.length < 2) return;

    const base = filesToMerge[0];
    const combinedContent = filesToMerge.map(f => f.content || f.code || '').join('\n');

    base.content = combinedContent;
    base.code = combinedContent;
    // ... update stats ...

    // Remove merged pieces
    CE.scanResults.files = CE.scanResults.files.filter((f, i) => !fileIndexes.slice(1).includes(i));

    showResults(CE.scanResults);
    updateFilesTab(CE.scanResults.files);
    showStatus('Files merged successfully!');
}
