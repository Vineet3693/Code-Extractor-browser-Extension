// ============================================
// Download Module - All export and download functionality
// ============================================

// Get available files from scan results
function getAvailableFiles() {
  console.log('[Download] getAvailableFiles called, scanResults:', scanResults ? 'exists' : 'null');
  return scanResults?.project?.files || scanResults?.files || [];
}

// Download as Markdown
async function downloadAsMD() {
  console.log('[Download] downloadAsMD clicked');
  const files = getAvailableFiles();
  console.log('[Download] Files found:', files.length);
  if (files.length === 0) {
    showError('No files to download. Please scan a page first.');
    return;
  }
  
  const md = generateExportContent('markdown');
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const projectName = scanResults?.projectName || scanResults?.project?.name || 'extracted-project';
  const url = URL.createObjectURL(blob);
  
  chrome.downloads.download({ url, filename: `${projectName}.md`, saveAs: true }, () => {
    URL.revokeObjectURL(url);
  });
  
  showStatus('Markdown file downloaded!');
}

// Download as DOC/Word
async function downloadAsDOCS() {
  const files = getAvailableFiles();
  if (files.length === 0) {
    showError('No files to download. Please scan a page first.');
    return;
  }

  const projectName = scanResults?.projectName || scanResults?.project?.name || 'extracted-project';
  const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${projectName}</title></head>
    <body>
      <h1>Project: ${projectName}</h1>
      ${generateExportContent('html')}
    </body>
    </html>
  `;
  const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  
  chrome.downloads.download({ url, filename: `${projectName}.doc`, saveAs: true }, () => {
    URL.revokeObjectURL(url);
  });
  
  showStatus('DOCS file downloaded!');
}

// Download as PDF (via print dialog)
async function downloadAsPDF() {
  const files = getAvailableFiles();
  if (files.length === 0) {
    showError('No files to download. Please scan a page first.');
    return;
  }

  try {
    const projectName = scanResults?.project?.name || 'extracted-project';
    const asciiTree = buildASCIITree(files);
    
    let htmlContent = `<h1>📦 ${escapeHtml(projectName)}</h1>`;
    htmlContent += `<p><strong>Source:</strong> ${escapeHtml(scanResults?.sourceUrl || scanResults?.summary?.url || window.location.href)}</p>`;
    htmlContent += `<p><strong>Files:</strong> ${files.length} | <strong>Lines:</strong> ${scanResults?.summary?.totalLines || 0} | <strong>Size:</strong> ${formatBytes(scanResults?.summary?.totalSize || 0)}</p>`;
    htmlContent += `<h2>📁 Project Structure</h2><pre style="font-family:monospace;white-space:pre; background:#f6f8fa; padding:12px; border-radius:6px; border:1px solid #ddd;">${escapeHtml(asciiTree)}</pre>`;
    htmlContent += `<hr style="margin:20px 0;border:none;border-top:2px solid #d0d7de;">`;
    
    files.forEach(f => {
      htmlContent += `<div style="page-break-inside:avoid;margin-bottom:24px;">` +
        `<div style="font-weight:bold;font-family:monospace;background:#f6f8fa;padding:8px 12px;border:1px solid #d0d7de;border-bottom:none;border-radius:6px 6px 0 0;font-size:13px;">${escapeHtml(f.path || f.fileName)} <span style="color:#6e7781;font-weight:normal;">(${f.language || 'text'})</span></div>` +
        `<pre style="background:#fff;border:1px solid #ddd;padding:12px 14px;border-top:none; border-radius:0 0 6px 6px; white-space:pre-wrap; font-family:monospace; font-size:12px; margin:0;">${escapeHtml(f.content || '')}</pre>` +
        `</div>`;
    });

    const win = window.open('', '_blank');
    win.document.open();
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(projectName)}</title></head><body>${htmlContent}</body></html>`);
    win.document.close();
    
    setTimeout(() => {
      win.focus();
      win.print();
    }, 200);
    
    showStatus('PDF generation started. Use the browser print dialog to Save as PDF.');
  } catch (err) {
    console.error('PDF generation failed:', err);
    showError('PDF generation failed: ' + err.message);
  }
}

// Download folder structure (exports all files as individual files in a folder)
async function exportFolderAsDownloads(projectData, files) {
  console.log('[Download] exportFolderAsDownloads called');
  console.log('[Download] projectData:', projectData);
  console.log('[Download] files:', files ? files.length : 0);
  
  const folderName = (projectData?.name || 'extracted-project').toString().replace(/\s+/g, '_');
  const toDownload = files || [];
  
  if (toDownload.length === 0) {
    console.log('[Download] No files to export!');
    showError('No files to export. Please scan a page first.');
    return;
  }
  
  console.log('[Download] Processing', toDownload.length, 'files to folder:', folderName);
  
  // Merge duplicates by filename
  const seen = new Map();
  const uniqueFiles = [];
  
  for (const f of toDownload) {
    const path = f.path || f.fileName || '';
    const key = path.toLowerCase();
    if (seen.has(key)) {
      const existing = seen.get(key);
      existing.content += '\n\n/* --- MERGED BLOCK --- */\n' + (f.content || f.code || '');
    } else {
      seen.set(key, { ...f });
      uniqueFiles.push(f);
    }
  }
  
  const promises = uniqueFiles.map((f, idx) => {
    const rawPath = f.path || f.fileName || `file_${idx + 1}`;
    let finalPath = rawPath;
    
    // Add extension if missing
    if (!rawPath.includes('.')) {
      const ext = getFileExtension(f.language);
      if (ext) finalPath = rawPath + ext;
    }
    
    const content = f.content || f.code || '';
    if (!content) return Promise.resolve();
    
    const mime = getMimeType(finalPath);
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    
    return new Promise((resolve) => {
      try {
        chrome.downloads.download({ 
          url, 
          filename: `${folderName}/${finalPath}`, 
          saveAs: false 
        }, () => {
          URL.revokeObjectURL(url);
          resolve();
        });
      } catch (e) {
        console.error('[Download] Folder export failed:', e);
        URL.revokeObjectURL(url);
        resolve();
      }
    });
  });
  
  await Promise.all(promises);
  showStatus(`Exported ${uniqueFiles.length} files to folder!`);
}

// Download conversation/chat
async function downloadConversation() {
  try {
    let conversation = scanResults?.conversation || [];
    
    // Try to extract from page if not in scan results
    if (!conversation || conversation.length === 0) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (tab?.id) {
          const resp = await safeSendMessageToTab(tab.id, { action: 'EXTRACT_CONVERSATION' });
          if (resp && resp.success && resp.data) {
            conversation = resp.data;
          }
        }
      } catch (e) {
        console.warn('[Download] Conversation extraction failed:', e);
      }
    }

    if (!conversation || conversation.length === 0) {
      showError('No conversation data available for download.');
      return;
    }

    const mdLines = conversation.map((c, i) => `- ${c.author || 'User'}: ${c.text || c.message || ''}`).join('\n');
    const blob = new Blob([`# Conversation\n\n${mdLines}`], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    chrome.downloads.download({ 
      url, 
      filename: `conversation-${Date.now()}.md`, 
      saveAs: true 
    }, () => {
      URL.revokeObjectURL(url);
    });
  } catch (err) {
    console.error('Conversation download failed:', err);
    showError('Conversation download failed: ' + err.message);
  }
}

// ZIP export (deprecated - now falls back to folder)
async function downloadZip() {
  showError('ZIP export is deprecated. Use Folder export instead.');
}