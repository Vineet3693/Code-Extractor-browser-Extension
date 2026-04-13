// ============================================
// Messaging Module - Safe communication with content scripts
// ============================================

// Safe message sender with retry logic
async function safeSendMessageToTab(tabId, message, options = {}) {
  const { retryLimit = 4, delay = 800, timeout = 30000 } = options;

  for (let attempt = 0; attempt < retryLimit; attempt++) {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('REQUEST_TIMEOUT: Response took too long')), timeout);
      });

      // Race the message against the timeout
      return await Promise.race([
        chrome.tabs.sendMessage(tabId, message),
        timeoutPromise
      ]);
    } catch (err) {
      if (err.message === 'REQUEST_TIMEOUT: Response took too long') {
        console.warn('[Messaging] Timeout on attempt', attempt + 1);
        if (attempt < retryLimit - 1) {
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error('Scan timed out. The page might be too large or unresponsive.');
      }

      const isTransient = /Receiving end does not exist|Could not establish connection/.test(err?.message || '');
      if (isTransient && attempt < retryLimit - 1) {
        const retryMsg = `Content script not ready. Retrying (${attempt + 1}/${retryLimit})...`;
        console.log('[Messaging]', retryMsg);
        if (typeof showToast === 'function') showToast(retryMsg);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

// Handshake with retry - specifically for scan initialization
async function performHandshakeWithRetry(tabId) {
  const maxAttempts = 4;
  const delay = 800;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'PING' });
      console.log('[Messaging] Handshake successful.');
      return true;
    } catch (e) {
      if (attempt < maxAttempts - 1) {
        const msg = `Connecting to page (${attempt + 1}/${maxAttempts})...`;
        console.log('[Messaging]', msg);
        if (typeof showToast === 'function') showToast(msg);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.error('[Messaging] Handshake failed after', maxAttempts, 'attempts:', e);
        throw new Error(`Cannot connect to page. The content script may not be loaded. Try refreshing the page.`);
      }
    }
  }
  return false;
}