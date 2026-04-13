if (typeof window.BaseParser === 'undefined') {
  window.BaseParser = class BaseParser {

    canHandle(url) {
      throw new Error("Method 'canHandle(url)' must be implemented");
    }

    getCodeBlockElements(document) {
      throw new Error("Method 'getCodeBlockElements()' must be implemented");
    }

    getLanguageFromElement(element) {
      throw new Error("Method 'getLanguageFromElement()' must be implemented");
    }

    getLabelFromElement(element) {
      throw new Error("Method 'getLabelFromElement()' must be implemented");
    }

    getMessageContainers(document) {
      throw new Error("Method 'getMessageContainers()' must be implemented");
    }

    extractCodeBlocks(doc = document) {
      const codeElements = this.getCodeBlockElements(doc);
      const blocks = [];

      for (const element of codeElements) {
        const code = element.textContent || "";
        if (!code.trim() || code.trim().length < 10) continue;

        const language = this.getLanguageFromElement(element) || "text";
        const label = this.getLabelFromElement(element) || null;
        const surroundingText = this.getSurroundingText(element, 500);
        const textBefore = this.getTextBefore(element, 300);
        const textAfter = this.getTextAfter(element, 300);

        blocks.push({
          code: code.trim(),
          language: language.toLowerCase(),
          label,
          surroundingText,
          textBefore,
          textAfter,
          element: element,
          index: blocks.length
        });
      }

      return blocks;
    }

    extractTreeStructures(doc = document) {
      const messages = this.getMessageContainers(doc);
      const trees = [];

      for (const message of messages) {
        const textContent = message.textContent || "";
        const lines = textContent.split("\n");
        let currentTree = [];
        let inTree = false;

        for (const line of lines) {
          const trimmed = line.trim();
          if (this.isTreeStructure(trimmed)) {
            inTree = true;
            currentTree.push(line);
          } else {
            if (inTree && currentTree.length >= 2) {
              trees.push(currentTree.join("\n"));
            }
            currentTree = [];
            inTree = false;
          }
        }

        if (inTree && currentTree.length >= 2) {
          trees.push(currentTree.join("\n"));
        }
      }

      return trees;
    }

    getSurroundingText(element, charLimit = 500) {
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

    getTextBefore(element, charLimit = 300) {
      let text = "";

      // Walk siblings at the element's own level first
      let prev = element.previousSibling;
      while (prev && text.length < charLimit) {
        if (prev.nodeType === Node.TEXT_NODE) {
          text = prev.textContent.trim() + "\n" + text;
        } else if (prev.nodeType === Node.ELEMENT_NODE) {
          text = prev.textContent.trim() + "\n" + text;
        }
        prev = prev.previousSibling;
      }

      // Climb up to find a heading (h1-h4, strong, bold) from parent siblings
      // This catches headings outside the direct code block container
      let ancestor = element.parentElement;
      let climbs = 0;
      while (ancestor && climbs < 5) {
        let sibling = ancestor.previousElementSibling;
        let checked = 0;
        while (sibling && checked < 4) {
          const tag = sibling.tagName ? sibling.tagName.toLowerCase() : '';
          const isHeading = /^h[1-4]$/.test(tag);
          const isBoldPara = tag === 'p' &&
            (sibling.querySelector('strong, b') || /^\*{1,2}[^*]+\*{1,2}/.test(sibling.textContent));

          if (isHeading || isBoldPara) {
            const headingText = sibling.textContent.trim();
            if (headingText) {
              text = headingText + "\n" + text;
              break; // found the nearest heading — stop
            }
          }
          sibling = sibling.previousElementSibling;
          checked++;
        }
        ancestor = ancestor.parentElement;
        climbs++;
      }

      return text.trim().substring(0, charLimit);
    }

    getTextAfter(element, charLimit = 300) {
      let text = "";
      let next = element.nextSibling;
      while (next && text.length < charLimit) {
        if (next.nodeType === Node.TEXT_NODE) {
          text += " " + next.textContent.trim();
        } else if (next.nodeType === Node.ELEMENT_NODE) {
          const elemText = next.textContent.trim();
          text += " " + elemText;
        }
        next = next.nextSibling;
      }
      return text.trim().substring(0, charLimit);
    }

    isTreeStructure(text) {
      const treeChars = ["├", "└", "│", "─", "┬", "┼"];
      const hasTreeChars = treeChars.some((char) => text.includes(char));
      if (!hasTreeChars) return false;

      const lines = text.split("\n");
      if (lines.length < 2) return false;

      const treeLineCount = lines.filter((line) => {
        const trimmed = line.trim();
        return treeChars.some((char) => trimmed.includes(char));
      }).length;

      return treeLineCount >= 2;
    }

    getSiteName() {
      return "Unknown";
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { BaseParser: window.BaseParser };
}
