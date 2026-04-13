const LANGUAGE_TO_EXTENSION = {
  python: ".py",
  javascript: ".js",
  typescript: ".ts",
  tsx: ".tsx",
  jsx: ".jsx",
  java: ".java",
  cpp: ".cpp",
  "c++": ".cpp",
  c: ".c",
  "c#": ".cs",
  csharp: ".cs",
  go: ".go",
  golang: ".go",
  rust: ".rs",
  ruby: ".rb",
  php: ".php",
  swift: ".swift",
  kotlin: ".kt",
  html: ".html",
  css: ".css",
  scss: ".scss",
  sass: ".sass",
  json: ".json",
  yaml: ".yml",
  yml: ".yml",
  xml: ".xml",
  markdown: ".md",
  md: ".md",
  sql: ".sql",
  bash: ".sh",
  shell: ".sh",
  sh: ".sh",
  powershell: ".ps1",
  ps1: ".ps1",
  dockerfile: "Dockerfile",
  makefile: "Makefile",
  r: ".r",
  matlab: ".m",
  scala: ".scala",
  perl: ".pl",
  lua: ".lua",
  dart: ".dart",
  vue: ".vue",
  svelte: ".svelte",
  graphql: ".graphql",
  proto: ".proto",
  toml: ".toml",
  ini: ".ini",
  txt: ".txt",
  text: ".txt"
};

const EXTENSION_TO_LANGUAGE = {
  ".py": "python",
  ".js": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".jsx": "javascript",
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
  ".R": "r",
  ".m": "matlab",
  ".scala": "scala",
  ".pl": "perl",
  ".pm": "perl",
  ".lua": "lua",
  ".dart": "dart",
  ".vue": "vue",
  ".svelte": "svelte",
  ".graphql": "graphql",
  ".gql": "graphql",
  ".proto": "proto",
  ".toml": "toml",
  ".ini": "ini",
  ".txt": "text"
};

const LANGUAGE_CONTENT_INDICATORS = {
  python: ["import ", "from ", "def ", "class ", "print(", "if __name__", "async def", "await "],
  javascript: ["const ", "let ", "var ", "function ", "=>", "require(", "module.exports", "console.log"],
  typescript: ["interface ", "type ", "as ", ": string", ": number", "enum ", "namespace "],
  java: ["public class ", "private ", "public static void main", "import java.", "System.out."],
  cpp: ["#include <", "std::", "cout <<", "using namespace", "int main("],
  c: ["#include <", "printf(", "int main(", "scanf("],
  csharp: ["using System;", "namespace ", "public class ", "Console.WriteLine"],
  go: ["package main", "func main(", "import (", "fmt.Println"],
  rust: ["fn main()", "let mut ", "println!", "use std::"],
  ruby: ["def ", "end", "puts ", "require '", "class "],
  php: ["<?php", "echo ", "$_GET", "$_POST", "function "],
  swift: ["import ", "func ", "let ", "var ", "class "],
  kotlin: ["fun main(", "val ", "var ", "class ", "import "],
  html: ["<!DOCTYPE", "<html", "<head", "<body", "<div"],
  css: ["{", "}", ":", ";", "margin:", "padding:", "color:", "display:"],
  json: ["{", "}", ":", ",", "\""],
  yaml: ["  ", ":", "-", "|", ">"],
  sql: ["SELECT ", "FROM ", "WHERE ", "INSERT ", "CREATE TABLE", "ALTER TABLE"],
  bash: ["#!/bin/bash", "#!/bin/sh", "echo ", "export ", "cd "],
  dockerfile: ["FROM ", "RUN ", "COPY ", "CMD ", "ENTRYPOINT", "WORKDIR "],
  makefile: [".PHONY:", "all:", "clean:", "install:", "\t"]
};

function getExtensionForLanguage(language) {
  if (!language) return ".txt";
  const lang = language.toLowerCase();
  return LANGUAGE_TO_EXTENSION[lang] || ".txt";
}

function getLanguageForExtension(ext) {
  if (!ext) return "text";
  const extension = ext.startsWith(".") ? ext : "." + ext.toLowerCase();
  return EXTENSION_TO_LANGUAGE[extension] || "text";
}

function detectLanguageFromContent(code) {
  if (!code || code.trim().length === 0) return "text";

  const scores = {};

  for (const [language, indicators] of Object.entries(LANGUAGE_CONTENT_INDICATORS)) {
    scores[language] = 0;
    for (const indicator of indicators) {
      if (code.includes(indicator)) {
        scores[language]++;
      }
    }
  }

  let bestLanguage = "text";
  let bestScore = 0;

  for (const [language, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestLanguage = language;
    }
  }

  return bestScore > 0 ? bestLanguage : "text";
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    LANGUAGE_TO_EXTENSION,
    EXTENSION_TO_LANGUAGE,
    LANGUAGE_CONTENT_INDICATORS,
    getExtensionForLanguage,
    getLanguageForExtension,
    detectLanguageFromContent
  };
}
