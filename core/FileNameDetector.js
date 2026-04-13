if (typeof window.FileNameDetector === 'undefined') {
  window.FileNameDetector = class FileNameDetector {

    constructor() {
      this.detectedNames = new Map();
    }

    detectFileName(codeBlock) {
      const { code, label, textBefore, textAfter, surroundingText, language, index } = codeBlock;

      // Detect from heading FIRST before falling through to generic patterns
      const headingResult = this.detectFromHeading(textBefore, surroundingText);

      let fileName = this.detectFromLabel(label) ||
        this.detectFromComment(code) ||
        this.detectFromTextBefore(textBefore) ||
        this.detectFromTextAfter(textAfter) ||
        this.detectFromSurrounding(surroundingText) ||
        this.detectFromCreatePattern(code) ||
        this.detectFromImportPattern(code, language) ||
        this.detectFromMarkdownFence(code) ||
        this.detectFromContentPatterns(code, language) ||
        (headingResult ? this._buildNameFromHeading(headingResult, language, index) : null) ||
        this.generateFromLanguage(language, index);

      fileName = this.sanitizeFileName(fileName);
      this.detectedNames.set(fileName, (this.detectedNames.get(fileName) || 0) + 1);

      const count = this.detectedNames.get(fileName);
      if (count > 1) {
        const ext = this.getFileExtension(fileName);
        const base = this.removeExtension(fileName);
        fileName = `${base}_${count}${ext}`;
      }

      return fileName;
    }

    detectFromLabel(label) {
      if (!label) return null;
      const match = label.match(/([a-zA-Z0-9_][a-zA-Z0-9_.\-\/\\]*\.[a-zA-Z0-9]{1,6})/);
      if (match) return match[1];
      if (label.length < 50 && !label.includes("\n")) return label;
      return null;
    }

    detectFromComment(code) {
      if (!code) return null;
      const lines = code.split("\n").slice(0, 5);
      for (const line of lines) {
        const commentMatch = line.match(/^(?:\/\/|#|\/\*|--)\s*(?:filename|file|name):\s*([a-zA-Z0-9_\/\\.\-]+\.[a-zA-Z0-9]{1,6})/i);
        if (commentMatch) return commentMatch[1];
      }
      return null;
    }

    detectFromTextBefore(text) {
      if (!text) return null;
      const lines = text.split("\n").slice(-3);
      for (const line of lines) {
        const pathMatch = line.match(/([a-zA-Z0-9_][a-zA-Z0-9_.\-\/\\]*\.[a-zA-Z0-9]{1,6})/);
        if (pathMatch) return pathMatch[1];
      }
      return null;
    }

    detectFromTextAfter(text) {
      if (!text) return null;
      const lines = text.split("\n").slice(0, 3);
      for (const line of lines) {
        const pathMatch = line.match(/([a-zA-Z0-9_][a-zA-Z0-9_.\-\/\\]*\.[a-zA-Z0-9]{1,6})/);
        if (pathMatch) return pathMatch[1];
      }
      return null;
    }

    /**
     * Reads block headings like:
     *   "Block 2: Import Libraries"
     *   "Step 3 - Set API Key"
     *   "### Install Dependencies"
     * Returns { blockNum, title } or null.
     */
    detectFromHeading(textBefore, surroundingText) {
      const sources = [textBefore, surroundingText].filter(Boolean);
      for (const text of sources) {
        const lines = text.split('\n').slice(-6); // look at last 6 lines above the block
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (!line) continue;

          // "Block 2: Import Libraries" or "Step 3 - Set API Key"
          const blockMatch = line.match(/^(?:block|step|section|part)\s+(\d+)\s*[:\-]\s*(.+)$/i);
          if (blockMatch) {
            return { blockNum: parseInt(blockMatch[1]), title: blockMatch[2].trim() };
          }

          // Markdown headings: "### Import Libraries" or "## 2. Set API Key"
          const mdMatch = line.match(/^#{1,4}\s+(?:(\d+)[.\)]\s+)?(.+)$/);
          if (mdMatch) {
            return { blockNum: mdMatch[1] ? parseInt(mdMatch[1]) : null, title: mdMatch[2].trim() };
          }

          // Plain numbered title: "2. Import Libraries" or "2) Set API Key"
          const numberedMatch = line.match(/^(\d+)[.):]\s+(.+)$/);
          if (numberedMatch) {
            return { blockNum: parseInt(numberedMatch[1]), title: numberedMatch[2].trim() };
          }

          // Lenient fallback: If it's a short text line (<= 70 chars, <= 10 words)
          // e.g., "Import libraries" or "Import libraries:"
          if (line.length > 2 && line.length <= 70 && line.split(/\s+/).length <= 10) {
            let cleanLine = line.replace(/[:;-]/g, '').trim();
            // Ignore generic conversational filler
            if (!/^(here|sure|certainly|yes|below|the code|this code|example|updated|following|let's)/i.test(cleanLine) && !cleanLine.includes('```')) {
              return { blockNum: null, title: cleanLine };
            }
          }
        }
      }
      return null;
    }

    /** Converts a heading result into a filename, e.g. { blockNum:2, title:'Import Libraries' } + python → import_libraries_2.py */
    _buildNameFromHeading(heading, language, index) {
      const ext = this._getExtForLanguage(language);
      const slug = heading.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 40);
      if (!slug) return null;

      // Remove the redundant index here because detectFileName() already 
      // handles numbering for uniqueness. Only keep blockNum if explicitly detected.
      const num = heading.blockNum != null ? `_${heading.blockNum}` : '';
      return `${slug}${num}${ext}`;
    }

    _getExtForLanguage(language) {
      const extMap = {
        python: '.py', javascript: '.js', typescript: '.ts', java: '.java',
        cpp: '.cpp', c: '.c', csharp: '.cs', go: '.go', rust: '.rs',
        ruby: '.rb', php: '.php', swift: '.swift', kotlin: '.kt',
        html: '.html', css: '.css', scss: '.scss', json: '.json',
        yaml: '.yml', xml: '.xml', markdown: '.md', sql: '.sql',
        bash: '.sh', powershell: '.ps1', dockerfile: '', makefile: ''
      };
      return extMap[language?.toLowerCase()] || '.txt';
    }

    detectFromSurrounding(text) {
      if (!text) return null;
      const match = text.match(/(?:create|new|save|write|make)\s+(?:the\s+)?(?:file\s+)?([a-zA-Z0-9_\/\\.\-]+\.[a-zA-Z0-9]{1,6})/i);
      if (match) return match[1];
      const pathMatch = text.match(/([a-zA-Z0-9_][a-zA-Z0-9_.\-\/\\]*\.[a-zA-Z0-9]{1,6})/);
      if (pathMatch) return pathMatch[1];
      return null;
    }

    detectFromCreatePattern(code) {
      const match = code.match(/(?:create|new|save|write|make)\s+(?:the\s+)?(?:file\s+)?([a-zA-Z0-9_\/\\.\-]+\.[a-zA-Z0-9]{1,6})/i);
      if (match) return match[1];
      return null;
    }

    detectFromImportPattern(code, language) {
      if (!language || language === "text") return null;
      const lines = code.split("\n");
      for (const line of lines) {
        if (language === "python") {
          // Only match local imports (relative paths with / or .)
          const match = line.match(/^from\s+(\.[\.\w\/]+)\s+import|^import\s+(\.[\.\w\/]+)/);
          if (match) return (match[1] || match[2]).replace(/\./g, "/").replace(/^\//, '') + ".py";
        } else if (language === "javascript" || language === "typescript") {
          const match = line.match(/from\s+['"]([^'"]+)['"]/);
          // ONLY use as filename if it's a local relative path (starts with . or contains /)
          if (match && (match[1].startsWith(".") || match[1].includes("/"))) {
            const ext = language === "typescript" ? ".ts" : ".js";
            const base = match[1].replace(/^.*\//, '');  // keep only the last segment
            if (base) return base.endsWith(ext) ? base : base + ext;
          }
        }
      }
      return null;
    }

    detectFromMarkdownFence(code) {
      if (code.startsWith("```")) {
        const lines = code.split("\n");
        if (lines.length > 0) {
          const firstLine = lines[0].trim();
          const match = firstLine.match(/```\s*(\w+)\s*(.*)/);
          if (match && match[2]) return match[2].trim();
        }
      }
      return null;
    }

    detectFromContentPatterns(code, language) {
      const trimmed = code.trim();

      // Tree / directory structure
      const treeChars = ['├', '└', '│', '─'];
      const treeLineCount = trimmed.split('\n').filter(l => treeChars.some(c => l.includes(c))).length;
      if (treeLineCount >= 3) return 'project-structure.txt';

      // JSON fingerprints
      if (language === 'json' || trimmed.startsWith('{')) {
        if (/"manifest_version"\s*:/.test(trimmed)) return 'manifest.json';
        if (/"compilerOptions"\s*:/.test(trimmed)) return 'tsconfig.json';
        if (/"eslintConfig"\s*:|"eslintIgnore"\s*:/.test(trimmed)) return '.eslintrc.json';
        if (/"prettier"\s*:/.test(trimmed)) return '.prettierrc.json';
        if (/"jest"\s*:/.test(trimmed) && /"testMatch"\s*:|"testEnvironment"\s*:/.test(trimmed)) return 'jest.config.json';
        if (/"scripts"\s*:/.test(trimmed) && /"dependencies"\s*:|"devDependencies"\s*:|"name"\s*:/.test(trimmed)) return 'package.json';
        if (/"dependencies"\s*:/.test(trimmed) && /"version"\s*:/.test(trimmed) && !/"scripts"/.test(trimmed)) return 'package-lock.json';
        if (/"babelrc"\s*:|"presets"\s*:\s*\[/.test(trimmed)) return '.babelrc';
        if (/"launch"\s*:|"configurations"\s*:\s*\[/.test(trimmed)) return 'launch.json';
        if (/"recommendations"\s*:\s*\[/.test(trimmed)) return 'extensions.json';
        if (/"editor\./.test(trimmed) || /"workbench\./.test(trimmed)) return 'settings.json';
      }

      // YAML fingerprints
      if (language === 'yaml') {
        if (/^name:\s*\S+/m.test(trimmed) && /^on:/m.test(trimmed)) return 'workflow.yml';
        if (/^services:/m.test(trimmed)) return 'docker-compose.yml';
        if (/^version:/m.test(trimmed) && /^dependencies:/m.test(trimmed)) return 'pubspec.yaml';
      }

      // Dockerfile
      if (/^FROM\s+\S+/m.test(trimmed)) return 'Dockerfile';

      // .gitignore / .dockerignore patterns
      if (language === 'text' || !language) {
        const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
        const ignorePatterns = lines.filter(l => /^[#*!]|node_modules|\.env|\.DS_Store|dist\/|build\//.test(l));
        if (ignorePatterns.length >= 3 && lines.length > 0 && ignorePatterns.length / lines.length > 0.5) {
          return trimmed.includes('docker') ? '.dockerignore' : '.gitignore';
        }
      }

      // Markdown: README
      if (language === 'markdown') {
        if (/^#\s+(README|Getting Started|Installation|Overview|Introduction)/im.test(trimmed)) return 'README.md';
        if (/^#\s+CHANGELOG|^##\s+\d+\.\d+/m.test(trimmed)) return 'CHANGELOG.md';
        if (/^#\s+(Contributing|How to Contribute)/im.test(trimmed)) return 'CONTRIBUTING.md';
        if (/^#\s+(License|MIT License|Apache)/im.test(trimmed)) return 'LICENSE.md';
        return 'README.md';
      }

      // Shell / bash
      if (language === 'bash' && /^#!\/bin\/(ba)?sh/m.test(trimmed)) return 'setup.sh';

      // CSS/SCSS: detect common entry files
      if (language === 'css' && (/:root\s*{/.test(trimmed) || /^\*\s*{/m.test(trimmed))) return 'index.css';
      if (language === 'scss' && /^\$[a-z]+-[a-z]+:/m.test(trimmed)) return '_variables.scss';

      // HTML
      if (language === 'html') {
        if (/<!DOCTYPE html>/i.test(trimmed)) {
          if (/<title>\s*index/i.test(trimmed) || /<main|<app-root|id="root"|id="app"/i.test(trimmed)) return 'index.html';
        }
      }

      // Python
      if (language === 'python') {
        if (/^if __name__\s*==\s*['"]__main__['"]$/m.test(trimmed)) return 'main.py';
        if (/^class.*\(.*TestCase\)/m.test(trimmed) || /^def test_/m.test(trimmed)) return 'test_suite.py';
        if (/^from setuptools import|^setup\(/m.test(trimmed)) return 'setup.py';
      }

      // SQL
      if (language === 'sql') {
        if (/CREATE TABLE/i.test(trimmed)) return 'schema.sql';
        if (/INSERT INTO/i.test(trimmed)) return 'seed.sql';
      }

      return null;
    }

    generateFromLanguage(language, index) {
      const extMap = {
        python: ".py",
        javascript: ".js",
        typescript: ".ts",
        java: ".java",
        cpp: ".cpp",
        c: ".c",
        csharp: ".cs",
        go: ".go",
        rust: ".rs",
        ruby: ".rb",
        php: ".php",
        swift: ".swift",
        kotlin: ".kt",
        html: ".html",
        css: ".css",
        scss: ".scss",
        json: ".json",
        yaml: ".yml",
        xml: ".xml",
        markdown: ".md",
        sql: ".sql",
        bash: ".sh",
        powershell: ".ps1",
        dockerfile: "Dockerfile",
        makefile: "Makefile"
      };
      const ext = extMap[language?.toLowerCase()] || ".txt";
      const langPrefix = language ? language.toLowerCase() : "snippet";
      // Dockerfile / Makefile are standalone (no extension suffix)
      if (ext === "Dockerfile" || ext === "Makefile") return ext;
      return `${langPrefix}_${index + 1}${ext}`;
    }

    sanitizeFileName(name) {
      return name
        // Allow forward slash for folder paths, replace backward slash and illegal chars
        .replace(/[<>:"\\|?*\x00-\x1F]/g, "_")
        // Remove leading/trailing dots but DO NOT remove all dots
        .replace(/^\.+|\.+$/g, "")
        .replace(/\s+/g, "_")
        .replace(/_{2,}/g, "_")
        .substring(0, 255) || "unnamed_file.txt";
    }

    getFileExtension(name) {
      const parts = name.split(".");
      if (parts.length === 1) return "";
      return "." + parts[parts.length - 1].toLowerCase();
    }

    removeExtension(name) {
      const lastDot = name.lastIndexOf(".");
      if (lastDot === -1) return name;
      return name.substring(0, lastDot);
    }

    detectAll(codeBlocks) {
      this.detectedNames = new Map();
      this.projectTreeMap = new Map();
      this._parseProjectTrees(codeBlocks);

      return codeBlocks.map((block) => {
        let fileName = this.detectFileName(block);

        // Reconstruct path if missing and found in tree map
        if (fileName && !fileName.includes('/')) {
          const fullPath = this.projectTreeMap.get(fileName);
          if (fullPath) {
            fileName = fullPath;
            // Re-sanitize just in case tree had weird characters, but keep slashes
            fileName = this.sanitizeFileName(fileName);
          }
        }

        return {
          ...block,
          fileName
        };
      });
    }

    _parseProjectTrees(codeBlocks) {
      for (const block of codeBlocks) {
        if (!block.code) continue;
        // High probability it's a tree
        if (block.code.includes('├──') || block.code.includes('└──') || /^\s*\|-\s+/m.test(block.code)) {
          this._buildMapFromTree(block.code);
        }
      }
    }

    _buildMapFromTree(treeText) {
      const lines = treeText.split('\n');
      let stack = [];

      // regex gets the indent (including tree drawing chars), and the bare name
      // e.g. "│   ├── utils" -> indent: "│   ├── ", name: "utils"
      const regex = /^([│├└─|\s\-]*)(.+)$/;

      for (const line of lines) {
        if (!line.trim()) continue;
        const match = line.match(regex);
        if (!match) continue;

        let [, indentStr, name] = match;
        name = name.trim();

        // Clean up common tree suffixes/prefixes like trailing slashes
        const isDir = name.endsWith('/');
        name = name.replace(/\/$/, '').trim();

        // Indent level is roughly the string length of the formatting
        // We'll normalize by removing tree characters and just counting spaces/tabs roughly
        let level = indentStr.length;

        // Unwind stack to find parent
        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }

        const parentPath = stack.length > 0 ? stack[stack.length - 1].path : '';
        const fullPath = parentPath ? `${parentPath}/${name}` : name;

        if (isDir || !name.includes('.')) {
          // Assume dir if no extension or has trailing slash
          stack.push({ level, path: fullPath });
        } else {
          // File
          this.projectTreeMap.set(name, fullPath);
        }
      }
    }

    getDetectedNames() {
      return Array.from(this.detectedNames.entries()).map(([name, count]) => ({ name, count }));
    }

    reset() {
      this.detectedNames.clear();
      if (this.projectTreeMap) this.projectTreeMap.clear();
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { FileNameDetector: window.FileNameDetector };
}
