if (typeof window.CodeScanner === 'undefined') {
  window.CodeScanner = class CodeScanner {

    constructor() {
      this.parser = null;
      this.extractor = null;
      this.fileNameDetector = new FileNameDetector();
      this.languageIdentifier = new LanguageIdentifier();
      this.treeParser = new TreeParser();
      this.projectMapper = new ProjectMapper();
      // Swapping to V2.0 advanced Duplicate Detector
      this.duplicateDetector = new SmartDuplicateDetector();
      this.projectAssembler = new ProjectAssembler();
      this.scanResults = null;
    }

    setParser(parser) {
      this.parser = parser;
      this.extractor = new CodeBlockExtractor(parser);
    }

    async scanPage(options = {}) {
      const {
        fullScan = true,
        selection = null,
        highlightBlocks = false
      } = options;

      const startTime = performance.now();

      if (!this.parser) {
        throw new Error("No parser set. Call setParser() first.");
      }

      let blocks;
      if (selection && selection.length > 0) {
        blocks = this.extractor.extractSelected(selection);
      } else {
        blocks = this.extractor.extractAll();
      }

      const trees = this.treeParser.parseFromMessages(this.parser.getMessageContainers());

      const blocksWithNames = this.fileNameDetector.detectAll(blocks);
      const blocksWithLangs = this.languageIdentifier.identifyAll(blocksWithNames);

      const duplicateStrategy = options.duplicateStrategy || "latest";
      this.duplicateDetector.strategy = duplicateStrategy;
      this.duplicateDetector.globalHashes = new Set(options.globalHashes || []);
      const dedupResult = this.duplicateDetector.detectDuplicates(blocksWithLangs);
      const uniqueBlocks = dedupResult.uniqueFiles;
      const conflicts = dedupResult.duplicates.filter(d => Object.keys(d).length > 0 && d.type !== 'exact' && d.files && d.files.length > 1);

      const fileStructure = this.projectMapper.mapFiles(uniqueBlocks);

      const projectName = options.projectName || this.generateProjectName();
      const project = this.projectAssembler.assemble(fileStructure, {
        projectName,
        includeReadme: options.includeReadme !== false,
        includeGitignore: options.includeGitignore !== false,
        includeDependencies: options.includeDependencies !== false,
        treeStructure: trees.length > 0 ? this.treeParser.getTreeString() : null,
        sourceUrl: window.location.href,
        timestamp: new Date().toISOString()
      });

      if (highlightBlocks) {
        this.highlightCodeBlocks();
      }

      const duration = performance.now() - startTime;

      this.scanResults = {
        project,
        summary: {
          totalBlocks: blocks.length,
          uniqueFiles: uniqueBlocks.length,
          duplicates: dedupResult.stats.duplicateFiles,
          trees: trees.length,
          totalLines: project.totalLines,
          totalSize: project.totalSize,
          totalFiles: project.totalFiles,
          autoFiles: project.autoFiles,
          duration: Math.round(duration),
          site: this.parser.getSiteName(),
          url: window.location.href
        },
        files: this.projectMapper.getFlatList(),
        duplicateReport: {
          totalDuplicates: dedupResult.stats.duplicateFiles,
          strategy: duplicateStrategy,
          conflicts: conflicts // used by sidepanel to trigger UI
        },
        trees: this.treeParser.getStructures()
      };

      return this.scanResults;
    }

    generateProjectName() {
      // 1. Try to find a high-level heading that looks like a project/topic name
      const h1s = Array.from(document.querySelectorAll('h1')).map(h => h.innerText.trim()).filter(t => t.length > 2 && t.length < 50);
      const h2s = Array.from(document.querySelectorAll('h2')).map(h => h.innerText.trim()).filter(t => t.length > 2 && t.length < 50);

      // Combine and find the most relevant one
      const headings = [...h1s, ...h2s];
      let projectContext = '';

      // Platforms like Outlier often have the project name in an H1 or H2
      // We want to avoid generic names like "Dashboard" or "Chat"
      const genericNames = ['dashboard', 'chat', 'project', 'home', 'overview', 'untitled', 'new chat'];
      projectContext = headings.find(h => !genericNames.includes(h.toLowerCase())) || '';

      // 2. Identify the platform
      let platform = 'Web';
      const host = window.location.hostname;
      if (host.includes('outlier')) platform = 'Outlier';
      else if (host.includes('chatgpt') || host.includes('openai')) platform = 'ChatGPT';
      else if (host.includes('claude') || host.includes('anthropic')) platform = 'Claude';
      else if (host.includes('github')) platform = 'GitHub';
      else if (host.includes('stackoverflow')) platform = 'StackOverflow';
      else if (host.includes('google') || host.includes('gemini')) platform = 'Gemini';

      // 3. Construct final name
      if (projectContext) {
        // Format: [Platform] Project Name
        return `[${platform}] ${projectContext}`;
      }

      // Fallback to title with platform
      const pageTitle = document.title
        .replace(/ - ChatGPT/i, '')
        .replace(/ - Claude/i, '')
        .replace(/ - Gemini/i, '')
        .replace(/ \| Outlier/i, '')
        .trim();

      const finalTitle = pageTitle.replace(/[^a-zA-Z0-9 _-]/g, "").trim();
      return `[${platform}] ${finalTitle || 'Extracted Project'}`;
    }

    highlightCodeBlocks() {
      // Highlight Code Blocks (Green)
      const blocks = this.parser.getCodeBlockElements();
      blocks.forEach((block, index) => {
        const element = block.element || block;
        element.style.outline = "2px solid #4CAF50";
        element.style.outlineOffset = "2px";
        element.style.borderRadius = "4px";
        element.dataset.codeExtractorIndex = index;
        element.classList.add('code-extractor-highlight-active');
      });

      // Highlight Headings (Red) - to show project structure markers
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach((heading, index) => {
        // Check if it's likely a relevant heading (not empty, visible)
        if (heading.innerText.trim() && heading.offsetWidth > 0) {
          heading.style.outline = "2px solid #F44336";
          heading.style.outlineOffset = "2px";
          heading.style.borderRadius = "2px";
          heading.dataset.codeExtractorHeadingIndex = index;
          heading.classList.add('code-extractor-heading-active');
        }
      });
    }

    stopHighlight() {
      // Clear Code Blocks
      const highlightedBlocks = document.querySelectorAll("[data-code-extractor-index], .code-extractor-highlight-active");
      highlightedBlocks.forEach((el) => {
        el.style.outline = "";
        el.style.outlineOffset = "";
        el.style.borderRadius = "";
        delete el.dataset.codeExtractorIndex;
        el.classList.remove('code-extractor-highlight-active');
      });

      // Clear Headings
      const highlightedHeadings = document.querySelectorAll("[data-code-extractor-heading-index], .code-extractor-heading-active");
      highlightedHeadings.forEach((el) => {
        el.style.outline = "";
        el.style.outlineOffset = "";
        el.style.borderRadius = "";
        delete el.dataset.codeExtractorHeadingIndex;
        el.classList.remove('code-extractor-heading-active');
      });
    }

    getResults() {
      return this.scanResults;
    }

    getProjectForZip() {
      return this.projectAssembler.getProjectForZip();
    }

    getProject() {
      return this.projectAssembler.getProject();
    }

    reset() {
      this.extractor = null;
      this.fileNameDetector.reset();
      this.treeParser.clear();
      this.projectMapper.clear();
      // duplicateDetector doesn't need explicit reset if we instantiate per-scan or it self-resets on detectDuplicates
      this.projectAssembler.reset();
      this.scanResults = null;
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CodeScanner: window.CodeScanner };
}
