function createElement(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (key === "className") {
      element.className = value;
    } else if (key === "textContent") {
      element.textContent = value;
    } else if (key === "innerHTML") {
      element.innerHTML = value;
    } else if (key.startsWith("on") && typeof value === "function") {
      element.addEventListener(key.substring(2).toLowerCase(), value);
    } else if (key === "style" && typeof value === "object") {
      Object.assign(element.style, value);
    } else if (key === "dataset" && typeof value === "object") {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        element.dataset[dataKey] = dataValue;
      }
    } else {
      element.setAttribute(key, value);
    }
  }

  for (const child of children) {
    if (typeof child === "string") {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  }

  return element;
}

function qs(selector, parent = document) {
  return parent.querySelector(selector);
}

function qsa(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

function getTextContent(element) {
  if (!element) return "";
  return element.textContent || "";
}

function getVisibleText(element) {
  if (!element) return "";
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const style = window.getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden") {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const texts = [];
  let node;
  while ((node = walker.nextNode())) {
    texts.push(node.textContent.trim());
  }
  return texts.filter((t) => t.length > 0).join(" ");
}

function isVisible(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function getComputedFontFamily(element) {
  return window.getComputedStyle(element).fontFamily;
}

function isMonospaceFont(element) {
  const family = getComputedFontFamily(element).toLowerCase();
  return family.includes("monospace") || family.includes("consolas") || family.includes("courier") || family.includes("menlo");
}

function walkDOM(root, callback) {
  if (!root) return;
  callback(root);
  let child = root.firstChild;
  while (child) {
    walkDOM(child, callback);
    child = child.nextSibling;
  }
}

function getElementPath(element) {
  const path = [];
  let current = element;
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += `#${current.id}`;
    } else if (current.className && typeof current.className === "string") {
      selector += `.${current.className.trim().split(/\s+/).join(".")}`;
    }
    path.unshift(selector);
    current = current.parentElement;
  }
  return path.join(" > ");
}

function getClosestElement(element, selector) {
  return element.closest ? element.closest(selector) : null;
}

function hasClass(element, className) {
  return element.classList ? element.classList.contains(className) : element.className.includes(className);
}

function addClass(element, className) {
  if (element.classList) {
    element.classList.add(className);
  } else if (!hasClass(element, className)) {
    element.className += " " + className;
  }
}

function removeClass(element, className) {
  if (element.classList) {
    element.classList.remove(className);
  } else {
    element.className = element.className.replace(new RegExp(`(^|\\b)${className}(\\b|$)`, "gi"), " ");
  }
}

function insertAfter(newNode, referenceNode) {
  referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function clearChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function getSurroundingText(element, charLimit = 500) {
  const parent = element.parentElement;
  if (!parent) return "";

  let text = "";
  let prev = element.previousSibling;
  while (prev && text.length < charLimit) {
    if (prev.nodeType === Node.TEXT_NODE) {
      text = prev.textContent.trim() + " " + text;
    }
    prev = prev.previousSibling;
  }

  let next = element.nextSibling;
  while (next && text.length < charLimit * 2) {
    if (next.nodeType === Node.TEXT_NODE) {
      text += " " + next.textContent.trim();
    }
    next = next.nextSibling;
  }

  return text.trim().substring(0, charLimit * 2);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    createElement,
    qs,
    qsa,
    getTextContent,
    getVisibleText,
    isVisible,
    getComputedFontFamily,
    isMonospaceFont,
    walkDOM,
    getElementPath,
    getClosestElement,
    hasClass,
    addClass,
    removeClass,
    insertAfter,
    clearChildren,
    getSurroundingText
  };
}
