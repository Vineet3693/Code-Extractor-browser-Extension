// ============================================================
// tab-exports.js — Exports globally available in sidepanel
// ============================================================

function getAvailableFiles() {
    return CE.scanResults?.project?.files || CE.scanResults?.files || [];
}

async function exportToIDE(options) {
    const { ide, format, scope, fileIndex } = options;
    if (!CE.scanResults) { showError('No data to export.'); return; }

    // Determine target files
    let files = [];
    if (scope === 'single') {
        const allFiles = getAvailableFiles();
        if (allFiles[fileIndex]) files = [allFiles[fileIndex]];
    } else {
        files = getAvailableFiles();
        // Filter by extensions if provided
        if (options.selectedExtensions && options.selectedExtensions.length > 0) {
            files = files.filter(f => {
                const name = f.path || f.fileName || '';
                const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : 'no-ext';
                return options.selectedExtensions.includes(ext);
            });
        }
    }

    if (files.length === 0) { showError('No files selected for export.'); return; }

    try {
        // If format is not "folder", we handle it as a direct download
        if (format === 'zip') return downloadAsZIP(files);
        if (format === 'pdf') return downloadAsPDF(files);
        if (format === 'md') return downloadAsMD(files);
        if (format === 'json') return downloadAsJSON(files);
        if (format === 'html') return downloadAsHTML(files);
        if (format === 'docs') return downloadAsDOCS(files);

        // Default: IDE Folder Protocol
        const project = scope === 'single' ? { name: files[0].fileName, files: files } : CE.scanResults.project;

        let result;
        if (CE.vscodeCompanion && (ide === 'vscode' || ide === 'cursor' || ide === 'antigravity')) {
            CE.vscodeCompanion._protocolOverride = ide;
            result = await CE.vscodeCompanion.sendProjectToVSCode(project);
        } else {
            switch (ide) {
                case 'vscode': result = await CE.ideExport.exportToVSCode(project); break;
                case 'cursor': result = await CE.ideExport.exportToCursor(project); break;
                case 'opencode': result = await CE.ideExport.exportToOpenCode(project); break;
                default: result = await CE.ideExport.exportProjectAsZip(project, ide); break;
            }
        }

        if (result && result.success) {
            showStatus(`Exported to ${ide}!`);
            setTimeout(hideStatus, 2000);
        } else {
            showError(`Export failed: ${result?.error || 'Unknown error'}`);
        }
    } catch (error) {
        showError(`Export failed: ` + error.message);
    }
}


async function downloadAsMD(providedFiles) {
    try {
        const files = providedFiles || getAvailableFiles();
        if (files.length === 0) { showError('No files to download.'); return; }
        const md = generateExportContent('markdown', files);
        const projectName = CE.scanResults?.projectName || CE.scanResults?.project?.name || 'extracted-project';
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: `${projectName}.md` });
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showStatus('Markdown file downloaded!');
    } catch (err) { showError('Failed to download MD: ' + err.message); }
}

async function downloadAsDOCS(providedFiles) {
    try {
        const files = providedFiles || getAvailableFiles();
        if (files.length === 0) { showError('No files to download.'); return; }
        const projectName = CE.scanResults?.projectName || CE.scanResults?.project?.name || 'extracted-project';
        const htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${projectName}</title></head><body><h1>Project: ${projectName}</h1>${generateExportContent('html', files)}</body></html>`;
        const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: `${projectName}.doc` });
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showStatus('DOCS file downloaded!');
    } catch (err) { showError('Failed to download DOC: ' + err.message); }
}

async function downloadAsPDF(providedFiles) {
    try {
        const files = providedFiles || getAvailableFiles();
        if (files.length === 0) { showError('No files to download.'); return; }
        const projectName = CE.scanResults?.project?.name || 'extracted-project';
        const asciiTree = buildASCIITree(files);
        let htmlContent = `<h1>📦 ${escapeHtml(projectName)}</h1>`;
        htmlContent += `<p><strong>Source:</strong> ${escapeHtml(CE.scanResults?.sourceUrl || CE.scanResults?.summary?.url || window.location.href)}</p>`;
        htmlContent += `<p><strong>Files:</strong> ${files.length} | <strong>Lines:</strong> ${CE.scanResults?.summary?.totalLines || 0} | <strong>Size:</strong> ${formatBytes(CE.scanResults?.summary?.totalSize || 0)}</p>`;
        htmlContent += `<h2>📁 Project Structure</h2><pre style="font-family:monospace;white-space:pre; background:#f6f8fa; padding:12px; border-radius:6px; border:1px solid #ddd;">${escapeHtml(asciiTree)}</pre><hr style="margin:20px 0;border:none;border-top:2px solid #d0d7de;">`;
        files.forEach(f => {
            htmlContent += `<div style="page-break-inside:avoid;margin-bottom:24px;"><div style="font-weight:bold;font-family:monospace;background:#f6f8fa;padding:8px 12px;border:1px solid #d0d7de;border-bottom:none;border-radius:6px 6px 0 0;font-size:13px;">${escapeHtml(f.path || f.fileName)} <span style="color:#6e7781;font-weight:normal;">(${f.language || 'text'})</span></div><pre style="background:#fff;border:1px solid #ddd;padding:12px 14px;border-top:none; border-radius:0 0 6px 6px; white-space:pre-wrap; font-family:monospace; font-size:12px; margin:0;">${escapeHtml(f.content || '')}</pre></div>`;
        });
        const win = window.open('', '_blank');
        win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(projectName)}</title></head><body>${htmlContent}</body></html>`);
        win.document.close();
        setTimeout(() => { win.focus(); win.print(); }, 200);
        showStatus('PDF generation started. Use the browser print dialog to Save as PDF.');
    } catch (err) { showError('PDF generation failed: ' + err.message); }
}

async function downloadAsJSON(providedFiles) {
    try {
        const files = providedFiles || getAvailableFiles();
        if (files.length === 0) { showError('No files to download.'); return; }
        const projectName = CE.scanResults?.projectName || CE.scanResults?.project?.name || 'extracted-project';
        const exportData = {
            projectName: projectName, sourceUrl: CE.scanResults?.sourceUrl || CE.scanResults?.summary?.url || '', exportedAt: new Date().toISOString(),
            summary: { totalFiles: files.length, totalLines: CE.scanResults?.summary?.totalLines || 0, totalSize: CE.scanResults?.summary?.totalSize || 0 },
            files: files.map(f => ({ name: f.path || f.fileName || 'unknown', language: f.language || 'text', lines: f.lines || 0, size: f.size || 0, content: f.content || f.code || '' }))
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: `${projectName}.json` });
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showStatus('JSON file downloaded!');
    } catch (err) { showError('Failed to download JSON: ' + err.message); }
}

async function downloadAsHTML(providedFiles) {
    try {
        const files = providedFiles || getAvailableFiles();
        if (files.length === 0) { showError('No files to download.'); return; }
        const projectName = CE.scanResults?.projectName || CE.scanResults?.project?.name || 'extracted-project';
        const asciiTree = buildASCIITree(files);
        let htmlContent = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${escapeHtml(projectName)}</title></head><body><h1>📦 ${escapeHtml(projectName)}</h1><h2>📁 Project Structure</h2><pre>${escapeHtml(asciiTree)}</pre><h2>📄 Files</h2>`;
        files.forEach(f => {
            htmlContent += `<div><h3>${escapeHtml(f.path || f.fileName)} (${escapeHtml(f.language || 'text')})</h3><pre>${escapeHtml(f.content || f.code || '')}</pre></div>`;
        });
        htmlContent += `</body></html>`;
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: `${projectName}.html` });
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showStatus('HTML bundle downloaded!');
    } catch (err) { showError('Failed to download HTML: ' + err.message); }
}

async function downloadAsRealZIP(providedFiles) {
    if (typeof JSZip === 'undefined') { showError('ZIP library not loaded. Falling back to HTML package.'); await downloadAsZIPFallback(providedFiles); return; }
    const files = providedFiles || getAvailableFiles();
    if (!files.length) { showError('No files to download. Please scan a page first.'); return; }
    const projectName = CE.scanResults?.projectName || CE.scanResults?.project?.name || 'extracted-project';
    try {
        const zip = new JSZip();
        files.forEach((f, idx) => {
            const path = f.path || f.fileName || `file_${idx + 1}`;
            const content = f.content || f.code || '';
            if (content) zip.file(path, content);
        });
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        showStatus('ZIP export complete!');
        setTimeout(hideStatus, 2000);
    } catch (err) {
        console.error('[Export] ZIP failed:', err);
        await downloadAsZIPFallback(providedFiles);
    }
}

async function downloadAsZIPFallback(files) { await downloadAsHTML(files); }
function downloadAsZIP(files) { downloadAsRealZIP(files); }

function showQuickStats() {
    const files = getAvailableFiles();
    if (files.length === 0) { showError('No files scanned yet.'); return; }
    const languages = {};
    let totalLines = 0;
    let totalSize = 0;
    files.forEach(f => {
        const lang = f.language || 'unknown';
        languages[lang] = (languages[lang] || 0) + 1;
        totalLines += f.lines || (f.content || '').split('\n').length;
        totalSize += f.size || (f.content || '').length;
    });
    let stats = `📊 Quick Stats:\n\nTotal Files: ${files.length}\nTotal Lines: ${totalLines.toLocaleString()}\nTotal Size: ${formatBytes(totalSize)}\n\nLanguages:\n`;
    Object.entries(languages).sort((a, b) => b[1] - a[1]).forEach(([lang, count]) => { stats += `  • ${lang}: ${count} files\n`; });
    alert(stats);
}

function generateExportContent(format, providedFiles) {
    if (!CE.scanResults) return '';
    const allFiles = providedFiles || CE.scanResults.project?.files || CE.scanResults.files || [];
    if (allFiles.length === 0) return '';
    const asciiTree = buildASCIITree(allFiles);
    if (format === 'html') {
        let html = `<h2>Project Structure</h2><pre>${escapeHtml(asciiTree)}</pre>`;
        html += allFiles.map(f => `<div class="file-section"><div class="file-header">${escapeHtml(f.path || f.fileName)} (${f.language || 'text'})</div><pre>${escapeHtml(f.content || '')}</pre></div>`).join('\n');
        return html;
    } else {
        const projectName = CE.scanResults.project?.name || 'Extracted Project';
        let md = `# Project: ${projectName}\n\nSource: ${CE.scanResults.sourceUrl || CE.scanResults.summary?.url || window.location.href}\n\n`;
        md += `## File Structure\n\`\`\`\n${asciiTree}\n\`\`\`\n\n## Files\n\n`;
        allFiles.forEach(f => { md += `### \`${f.path || f.fileName}\`\n\`\`\`${f.language || 'text'}\n${f.content || ''}\n\`\`\`\n\n`; });
        return md;
    }
}

async function exportSingleFile(file) {
    if (!file) return;
    try {
        console.log('[IDE] Exporting single file:', file.fileName || file.path);
        if (!CE.ideExport) CE.ideExport = new IDEExport();
        const result = await CE.ideExport.exportSingleFile(file);
        if (result && result.success) showStatus('File exported to IDE!');
        else showError('Export failed: ' + (result?.error || 'Unknown error'));
    } catch (error) {
        showError('IDE Export failed: ' + error.message);
    }
}
