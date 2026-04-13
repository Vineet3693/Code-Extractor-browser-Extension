// ============================================================
// tab-live.js — Live Tab: live scanning, log, stats
// ============================================================

function toggleLiveScanning() {
    CE.liveScannerActive = !CE.liveScannerActive;
    const indicator = document.getElementById('live-status-indicator');
    const statusText = document.getElementById('live-status-text');
    const toggleBtn = document.getElementById('live-toggle-btn');
    if (CE.liveScannerActive) {
        if (indicator) indicator.className = 'live-dot active';
        if (statusText) statusText.textContent = 'Live scanning is active';
        if (toggleBtn) toggleBtn.textContent = 'Stop Live Scanning';
        CE.liveScanStats.startTime = Date.now();
        addLiveLogEntry('Live scanning started');
    } else {
        if (indicator) indicator.className = 'live-dot inactive';
        if (statusText) statusText.textContent = 'Live scanning is off';
        if (toggleBtn) toggleBtn.textContent = 'Start Live Scanning';
        addLiveLogEntry('Live scanning stopped');
    }
}

async function handleProjectUpdate(data) {
    if (data.addedFiles) {
        CE.liveScanStats.added += data.addedFiles.length;
        const el = document.getElementById('live-added-count');
        if (el) el.textContent = CE.liveScanStats.added;
        data.addedFiles.forEach(f => addLiveLogEntry(`Added: ${f.fileName || f.path}`));
    }
    if (data.updatedFiles) {
        CE.liveScanStats.updated += data.updatedFiles.length;
        const el = document.getElementById('live-updated-count');
        if (el) el.textContent = CE.liveScanStats.updated;
        data.updatedFiles.forEach(f => addLiveLogEntry(`Updated: ${f.fileName || f.path}`));
    }
    if (CE.scanResults) {
        CE.scanResults.project = data.project || CE.scanResults.project;
        CE.scanResults.files = data.project?.files || CE.scanResults.files;
        updateFilesTab(CE.scanResults.files);
    }
    if (CE.versionHistory && CE.scanResults?.project?.id) {
        const projectId = CE.scanResults.project.id;
        const versionsToSave = [];
        (data.addedFiles || []).forEach(f => versionsToSave.push({
            projectId, fileName: f.fileName || f.path || 'unknown',
            filePath: f.path || f.fileName || 'unknown', content: f.content || '',
            metadata: { changeType: 'live_scan_add', changeDescription: `Added: ${f.fileName || f.path}`, source: 'live_scan' }
        }));
        (data.updatedFiles || []).forEach(f => versionsToSave.push({
            projectId, fileName: f.fileName || f.path || 'unknown',
            filePath: f.path || f.fileName || 'unknown', content: f.content || '',
            metadata: { changeType: f.updateType || 'live_scan_update', changeDescription: `Updated: ${f.fileName || f.path}`, source: 'live_scan' }
        }));
        if (versionsToSave.length > 0) {
            try { await CE.versionHistory.saveBatchVersions(versionsToSave); } catch (e) { }
        }
    }
}

function addLiveLogEntry(message) {
    CE.liveScanStats.detected++;
    const detectedEl = document.getElementById('live-detected-count');
    if (detectedEl) detectedEl.textContent = CE.liveScanStats.detected;
    CE.liveLogEntries.push({ timestamp: Date.now(), message });
    if (CE.liveLogEntries.length > 50) CE.liveLogEntries = CE.liveLogEntries.slice(-50);
    renderLiveLog();
}

function renderLiveLog() {
    const liveLog = document.getElementById('live-log');
    if (!liveLog) return;
    if (CE.liveLogEntries.length === 0) {
        liveLog.innerHTML = '<p class="empty-state">No live detections yet.</p>';
        return;
    }
    liveLog.innerHTML = '';
    CE.liveLogEntries.slice().reverse().forEach(entry => {
        const div = document.createElement('div');
        div.className = 'live-log-entry';
        div.innerHTML = `<span class="live-log-time">${formatTime(entry.timestamp)}</span><span class="live-log-message">${escapeHtml(entry.message)}</span>`;
        liveLog.appendChild(div);
    });
}

function startLiveStatsUpdater() {
    setInterval(() => {
        if (CE.liveScannerActive && CE.liveScanStats.startTime) {
            const uptime = Math.floor((Date.now() - CE.liveScanStats.startTime) / 1000);
            const el = document.getElementById('live-uptime');
            if (el) el.textContent = `${uptime}s`;
        }
    }, 1000);
}
