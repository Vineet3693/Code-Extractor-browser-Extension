function sendMessage(action, data = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, data }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function sendToTab(tabId, action, data = {}) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { action, data }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function sendToBackground(action, data = {}) {
  return sendMessage(action, data);
}

function onMessage(action, callback) {
  const listener = (message, sender, sendResponse) => {
    if (message.action === action) {
      const result = callback(message.data, sender);
      if (result instanceof Promise) {
        result.then(sendResponse).catch((err) => {
          sendResponse({ error: err.message });
        });
        return true;
      }
      sendResponse(result);
    }
  };

  chrome.runtime.onMessage.addListener(listener);

  return () => chrome.runtime.onMessage.removeListener(listener);
}

function onTabMessage(action, callback) {
  const listener = (message, sender, sendResponse) => {
    if (message.action === action) {
      const result = callback(message.data, sender);
      if (result instanceof Promise) {
        result.then(sendResponse).catch((err) => {
          sendResponse({ error: err.message });
        });
        return true;
      }
      sendResponse(result);
    }
  };

  chrome.runtime.onMessage.addListener(listener);

  return () => chrome.runtime.onMessage.removeListener(listener);
}

function createMessageRouter(handlers) {
  const listener = (message, sender, sendResponse) => {
    const handler = handlers[message.action];
    if (handler) {
      const result = handler(message.data, sender);
      if (result instanceof Promise) {
        result.then(sendResponse).catch((err) => {
          sendResponse({ error: err.message });
        });
        return true;
      }
      sendResponse(result);
    }
  };

  chrome.runtime.onMessage.addListener(listener);

  return () => chrome.runtime.onMessage.removeListener(listener);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    sendMessage,
    sendToTab,
    sendToBackground,
    onMessage,
    onTabMessage,
    createMessageRouter
  };
}
