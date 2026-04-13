if (typeof window.CodeBlockExtractor === 'undefined') {
  window.CodeBlockExtractor = class CodeBlockExtractor {

    constructor(parser) {
      this.parser = parser;
      this.extractedBlocks = [];
    }

    extractAll(doc = document) {
      const blocks = this.parser.extractCodeBlocks(doc);
      this.extractedBlocks = blocks.map((block, index) => ({
        code: block.code,
        language: block.language,
        label: block.label,
        surroundingText: block.surroundingText,
        textBefore: block.textBefore,
        textAfter: block.textAfter,
        index,
        source: this.parser.getSiteName(),
        url: window.location.href,
        timestamp: Date.now(),
        size: block.code.length,
        lines: block.code.split("\n").length
      }));
      return this.extractedBlocks;
    }

    extractSelected(elements) {
      const blocks = [];
      for (const element of elements) {
        const code = element.textContent || "";
        if (!code.trim() || code.trim().length < 10) continue;

        const language = this.parser.getLanguageFromElement(element) || "text";
        const label = this.parser.getLabelFromElement(element) || null;
        const surroundingText = this.parser.getSurroundingText(element, 500);
        const textBefore = this.parser.getTextBefore(element, 300);
        const textAfter = this.parser.getTextAfter(element, 300);

        blocks.push({
          code: code.trim(),
          language: language.toLowerCase(),
          label,
          surroundingText,
          textBefore,
          textAfter,
          index: blocks.length,
          source: this.parser.getSiteName(),
          url: window.location.href,
          timestamp: Date.now(),
          size: code.length,
          lines: code.split("\n").length
        });
      }
      this.extractedBlocks = blocks;
      return blocks;
    }

    getBlocks() {
      return this.extractedBlocks;
    }

    getBlocksByLanguage(language) {
      return this.extractedBlocks.filter((b) => b.language === language.toLowerCase());
    }

    getBlocksByKeyword(keyword) {
      const lower = keyword.toLowerCase();
      return this.extractedBlocks.filter(
        (b) =>
          b.code.toLowerCase().includes(lower) ||
          (b.label && b.label.toLowerCase().includes(lower)) ||
          b.surroundingText.toLowerCase().includes(lower)
      );
    }

    getTotalSize() {
      return this.extractedBlocks.reduce((sum, b) => sum + b.size, 0);
    }

    getTotalLines() {
      return this.extractedBlocks.reduce((sum, b) => sum + b.lines, 0);
    }

    clear() {
      this.extractedBlocks = [];
    }

    getSummary() {
      const languages = {};
      for (const block of this.extractedBlocks) {
        languages[block.language] = (languages[block.language] || 0) + 1;
      }
      return {
        totalBlocks: this.extractedBlocks.length,
        totalSize: this.getTotalSize(),
        totalLines: this.getTotalLines(),
        languages,
        source: this.parser.getSiteName(),
        url: window.location.href
      };
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CodeBlockExtractor: window.CodeBlockExtractor };
}
