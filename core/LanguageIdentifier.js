if (typeof window.LanguageIdentifier === 'undefined') {
  window.LanguageIdentifier = class LanguageIdentifier {

    constructor() {
      this.languageScores = {};
    }

    identifyLanguage(codeBlock) {
      const { code, language, fileName } = codeBlock;

      if (language && language !== "text") {
        return this.normalizeLanguage(language);
      }

      const fromFileName = fileName ? this.detectFromFileName(fileName) : null;
      if (fromFileName) return fromFileName;

      const detected = this.detectFromContent(code);
      return detected;
    }

    identifyAll(codeBlocks) {
      return codeBlocks.map((block) => ({
        ...block,
        language: this.identifyLanguage(block)
      }));
    }

    normalizeLanguage(lang) {
      const map = {
        js: "javascript",
        ts: "typescript",
        py: "python",
        rb: "ruby",
        rs: "rust",
        cs: "csharp",
        "c++": "cpp",
        "c#": "csharp",
        sh: "bash",
        shell: "bash",
        yml: "yaml",
        md: "markdown",
        html5: "html",
        css3: "css",
        es6: "javascript",
        node: "javascript",
        react: "javascript",
        vuejs: "vue",
        tsx: "typescript",
        jsx: "javascript"
      };
      const normalized = lang.toLowerCase().trim();
      return map[normalized] || normalized;
    }

    detectFromFileName(fileName) {
      const extMap = {
        ".py": "python",
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".java": "java",
        ".cpp": "cpp",
        ".cc": "cpp",
        ".cxx": "cpp",
        ".c": "c",
        ".h": "c",
        ".hpp": "cpp",
        ".cs": "csharp",
        ".go": "go",
        ".rs": "rust",
        ".rb": "ruby",
        ".php": "php",
        ".swift": "swift",
        ".kt": "kotlin",
        ".kts": "kotlin",
        ".html": "html",
        ".htm": "html",
        ".css": "css",
        ".scss": "scss",
        ".sass": "sass",
        ".json": "json",
        ".yml": "yaml",
        ".yaml": "yaml",
        ".xml": "xml",
        ".md": "markdown",
        ".markdown": "markdown",
        ".sql": "sql",
        ".sh": "bash",
        ".bash": "bash",
        ".ps1": "powershell",
        ".r": "r",
        ".m": "matlab",
        ".scala": "scala",
        ".pl": "perl",
        ".lua": "lua",
        ".dart": "dart",
        ".vue": "vue",
        ".svelte": "svelte",
        ".graphql": "graphql",
        ".gql": "graphql",
        ".proto": "proto",
        ".toml": "toml",
        ".ini": "ini"
      };

      const specialFiles = {
        dockerfile: "dockerfile",
        makefile: "makefile",
        ".gitignore": "text",
        ".env": "text",
        "license": "text",
        "readme": "markdown"
      };

      const lower = fileName.toLowerCase();
      const baseName = lower.split("/").pop().split("\\").pop();

      if (specialFiles[baseName]) return specialFiles[baseName];

      const dotIndex = baseName.lastIndexOf(".");
      if (dotIndex !== -1) {
        const ext = baseName.substring(dotIndex).toLowerCase();
        return extMap[ext] || null;
      }

      return null;
    }

    detectFromContent(code) {
      if (!code || code.trim().length === 0) return "text";

      const indicators = {
        python: {
          patterns: ["import ", "from ", "def ", "class ", "print(", "if __name__", "async def", "await ", "self.", "lambda "],
          weight: 2
        },
        javascript: {
          patterns: ["const ", "let ", "var ", "function ", "=>", "require(", "module.exports", "console.log", "document.", "window."],
          weight: 2
        },
        typescript: {
          patterns: ["interface ", "type ", "as ", ": string", ": number", "enum ", "namespace ", "public ", "private "],
          weight: 3
        },
        java: {
          patterns: ["public class ", "private ", "public static void main", "import java.", "System.out.", "@Override"],
          weight: 2
        },
        cpp: {
          patterns: ["#include <", "std::", "cout <<", "using namespace", "int main(", "vector<"],
          weight: 2
        },
        c: {
          patterns: ["#include <", "printf(", "int main(", "scanf(", "malloc(", "free("],
          weight: 2
        },
        csharp: {
          patterns: ["using System;", "namespace ", "public class ", "Console.WriteLine", "[HttpGet]", "async Task"],
          weight: 2
        },
        go: {
          patterns: ["package main", "func main(", "import (", "fmt.Println", "go ", "chan ", "defer "],
          weight: 2
        },
        rust: {
          patterns: ["fn main()", "let mut ", "println!", "use std::", "impl ", "pub fn", "match "],
          weight: 2
        },
        ruby: {
          patterns: ["def ", "end", "puts ", "require '", "class ", "module ", "attr_accessor"],
          weight: 2
        },
        php: {
          patterns: ["<?php", "echo ", "$_GET", "$_POST", "function ", "$this->", "namespace "],
          weight: 2
        },
        swift: {
          patterns: ["import ", "func ", "let ", "var ", "class ", "struct ", "override "],
          weight: 2
        },
        kotlin: {
          patterns: ["fun main(", "val ", "var ", "class ", "import ", "data class ", "companion object"],
          weight: 2
        },
        html: {
          patterns: ["<!DOCTYPE", "<html", "<head", "<body", "<div", "<span", "<p>", "<h1"],
          weight: 1
        },
        css: {
          patterns: ["{", "}", ":", ";", "margin:", "padding:", "color:", "display:", "background:", "font-"],
          weight: 1
        },
        json: {
          patterns: ['"', "{", "}", ":", ",", "[", "]"],
          weight: 1,
          requireAll: false
        },
        yaml: {
          patterns: ["  ", ":", "-", "|", ">"],
          weight: 1
        },
        sql: {
          patterns: ["SELECT ", "FROM ", "WHERE ", "INSERT ", "CREATE TABLE", "ALTER TABLE", "DELETE FROM", "UPDATE "],
          weight: 2
        },
        bash: {
          patterns: ["#!/bin/bash", "#!/bin/sh", "echo ", "export ", "cd ", "chmod ", "sudo "],
          weight: 2
        },
        dockerfile: {
          patterns: ["FROM ", "RUN ", "COPY ", "CMD ", "ENTRYPOINT", "WORKDIR ", "EXPOSE "],
          weight: 3
        },
        makefile: {
          patterns: [".PHONY:", "all:", "clean:", "install:", "\t"],
          weight: 3
        },
        xml: {
          patterns: ["<?xml", "<", ">", "</"],
          weight: 1
        },
        markdown: {
          patterns: ["#", "**", "*", "```", "[", "![", "> "],
          weight: 1
        }
      };

      const scores = {};
      const trimmed = code.trim();

      for (const [lang, config] of Object.entries(indicators)) {
        scores[lang] = 0;
        let matchCount = 0;

        for (const pattern of config.patterns) {
          if (trimmed.includes(pattern)) {
            matchCount++;
            scores[lang] += config.weight;
          }
        }

        if (config.requireAll && matchCount < 2) {
          scores[lang] = 0;
        }

        if (lang === "json") {
          try {
            JSON.parse(trimmed);
            scores[lang] += 10;
          } catch (e) {
            scores[lang] -= 2;
          }
        }

        if (lang === "yaml" && !trimmed.startsWith("{") && !trimmed.startsWith("[")) {
          const yamlLines = trimmed.split("\n").filter((l) => l.includes(": "));
          if (yamlLines.length > trimmed.split("\n").length * 0.5) {
            scores[lang] += 5;
          }
        }
      }

      let bestLang = "text";
      let bestScore = 0;

      for (const [lang, score] of Object.entries(scores)) {
        if (score > bestScore) {
          bestScore = score;
          bestLang = lang;
        }
      }

      return bestScore > 0 ? bestLang : "text";
    }

    getConfidence(code, language) {
      if (language === "text") return 0;
      const indicators = {
        python: ["import ", "from ", "def ", "class "],
        javascript: ["const ", "let ", "function ", "=>"],
        typescript: ["interface ", "type ", ": string", ": number"],
        html: ["<", ">", "</"],
        css: ["{", "}", ":", ";"],
        json: ['"', "{", "}", ","]
      };

      const patterns = indicators[language];
      if (!patterns) return 0.5;

      let matches = 0;
      for (const pattern of patterns) {
        if (code.includes(pattern)) matches++;
      }

      return Math.min(matches / patterns.length, 1);
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { LanguageIdentifier: window.LanguageIdentifier };
}
