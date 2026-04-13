(function () {
  'use strict';

  const ToastTypes = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
  };

  const ToastIcons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const ToastDurations = {
    success: 3000,
    error: 5000,
    warning: 4000,
    info: 3000
  };

  let toastContainer = null;

  function getContainer() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'code-extractor-toasts';
      toastContainer.className = 'ce-toast-container';
      document.body.appendChild(toastContainer);
      injectStyles();
    }
    return toastContainer;
  }

  function injectStyles() {
    if (document.getElementById('ce-toast-styles')) return;
    const style = document.createElement('style');
    style.id = 'ce-toast-styles';
    style.textContent = `
      .ce-toast-container {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 100000;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-width: 340px;
        pointer-events: none;
      }
      .ce-toast {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px;
        background: #1e1e3a;
        border: 1px solid #2a2a4a;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        pointer-events: auto;
        animation: ce-toast-in 0.3s ease;
        font-size: 13px;
        color: #eaeaea;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .ce-toast.ce-toast-out {
        animation: ce-toast-out 0.3s ease forwards;
      }
      .ce-toast-icon {
        font-size: 16px;
        flex-shrink: 0;
        margin-top: 1px;
      }
      .ce-toast-content {
        flex: 1;
      }
      .ce-toast-title {
        font-weight: 600;
        margin-bottom: 2px;
      }
      .ce-toast-message {
        color: #a0a0a0;
        font-size: 12px;
        line-height: 1.4;
      }
      .ce-toast-close {
        background: none;
        border: none;
        color: #666688;
        cursor: pointer;
        font-size: 14px;
        padding: 0 2px;
        flex-shrink: 0;
      }
      .ce-toast-close:hover {
        color: #eaeaea;
      }
      .ce-toast.ce-toast-success {
        border-left: 3px solid #4CAF50;
      }
      .ce-toast.ce-toast-error {
        border-left: 3px solid #e74c3c;
      }
      .ce-toast.ce-toast-warning {
        border-left: 3px solid #f39c12;
      }
      .ce-toast.ce-toast-info {
        border-left: 3px solid #3498db;
      }
      @keyframes ce-toast-in {
        from { opacity: 0; transform: translateX(40px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes ce-toast-out {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(40px); }
      }
    `;
    document.head.appendChild(style);
  }

  function showToast(type, message, duration) {
    const container = getContainer();
    const toast = document.createElement('div');
    toast.className = `ce-toast ce-toast-${type}`;

    const titleMap = {
      success: 'Success',
      error: 'Error',
      warning: 'Warning',
      info: 'Info'
    };

    const dur = duration || ToastDurations[type] || 3000;

    toast.innerHTML = `
      <span class="ce-toast-icon">${ToastIcons[type] || 'ℹ️'}</span>
      <div class="ce-toast-content">
        <div class="ce-toast-title">${titleMap[type] || 'Notification'}</div>
        <div class="ce-toast-message">${escapeHtml(message)}</div>
      </div>
      <button class="ce-toast-close">✕</button>
    `;

    container.appendChild(toast);

    const closeBtn = toast.querySelector('.ce-toast-close');
    closeBtn.addEventListener('click', () => removeToast(toast));

    setTimeout(() => removeToast(toast), dur);

    return toast;
  }

  function removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('ce-toast-out');
    toast.addEventListener('animationend', () => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    });
  }

  function clearToasts() {
    if (toastContainer) {
      toastContainer.innerHTML = '';
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  window.showToast = showToast;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { showToast, clearToasts, ToastTypes };
  }
})();
