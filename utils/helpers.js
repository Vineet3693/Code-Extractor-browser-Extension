function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function debounce(fn, delay = 300) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

function throttle(fn, limit = 100) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

function deepClone(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map((item) => deepClone(item));
  if (typeof obj === "object") {
    const cloned = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function truncateText(text, max = 50) {
  if (text.length <= max) return text;
  return text.substring(0, max - 3) + "...";
}

function escapeHTML(text) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

function sanitizeFileName(name) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 255);
}

function getFileExtension(name) {
  const parts = name.split(".");
  if (parts.length === 1) return "";
  return "." + parts[parts.length - 1].toLowerCase();
}

function removeFileExtension(name) {
  const lastDot = name.lastIndexOf(".");
  if (lastDot === -1) return name;
  return name.substring(0, lastDot);
}

function isValidFilePath(path) {
  if (!path || path.trim().length === 0) return false;
  if (/[<>:"|?*]/.test(path)) return false;
  if (path.length > 4096) return false;
  return true;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHTMLEntities(text) {
  const entities = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " "
  };
  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, "g"), char);
  }
  return result.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
}

function normalizeWhitespace(text) {
  return text.replace(/\r\n/g, "\n").replace(/\t/g, "  ");
}

function extractImportsFromCode(code, language) {
  const imports = new Set();
  const lines = code.split("\n");

  if (language === "python") {
    for (const line of lines) {
      const match = line.match(/^(?:import\s+([\w.]+)|from\s+([\w.]+)\s+import)/);
      if (match) imports.add(match[1] || match[2]);
    }
  } else if (language === "javascript" || language === "typescript") {
    for (const line of lines) {
      const requireMatch = line.match(/require\(['"]([^'"]+)['"]\)/);
      const importMatch = line.match(/from\s+['"]([^'"]+)['"]/);
      if (requireMatch) imports.add(requireMatch[1]);
      if (importMatch) imports.add(importMatch[1]);
    }
  }

  return Array.from(imports);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    generateId,
    debounce,
    throttle,
    deepClone,
    formatBytes,
    formatDate,
    truncateText,
    escapeHTML,
    sanitizeFileName,
    getFileExtension,
    removeFileExtension,
    isValidFilePath,
    sleep,
    decodeHTMLEntities,
    normalizeWhitespace,
    extractImportsFromCode
  };
}
