const SUPPORTED_SITES = {
  CHATGPT: {
    name: "ChatGPT",
    patterns: [
      /^https?:\/\/chat\.openai\.com\//i,
      /^https?:\/\/chatgpt\.com\//i
    ]
  },
  CLAUDE: {
    name: "Claude",
    patterns: [
      /^https?:\/\/claude\.ai\//i
    ]
  },
  GEMINI: {
    name: "Gemini",
    patterns: [
      /^https?:\/\/gemini\.google\.com\//i
    ]
  },
  OUTLIER: {
    name: "Outlier",
    patterns: [
      /^https?:\/\/app\.outlier\.ai\//i,
      /^https?:\/\/.*\.outlier\.ai\//i
    ]
  },
  MISTRAL: {
    name: "Mistral",
    patterns: [
      /^https?:\/\/chat\.mistral\.ai\//i
    ]
  },
  POE: {
    name: "Poe",
    patterns: [
      /^https?:\/\/poe\.com\//i
    ]
  },
  GITHUB: {
    name: "GitHub",
    patterns: [
      /^https?:\/\/github\.com\//i
    ]
  },
  STACK_OVERFLOW: {
    name: "Stack Overflow",
    patterns: [
      /^https?:\/\/stackoverflow\.com\//i
    ]
  }
};

const LANGUAGE_MAP = {
  python: { extensions: [".py"], indicators: ["import ", "from ", "def ", "class ", "print("] },
  javascript: { extensions: [".js"], indicators: ["const ", "let ", "var ", "function ", "=>", "require("] },
  typescript: { extensions: [".ts", ".tsx"], indicators: ["interface ", "type ", "as ", ": string", ": number"] },
  java: { extensions: [".java"], indicators: ["public class ", "private ", "public static void main", "import java."] },
  cpp: { extensions: [".cpp", ".cc", ".cxx"], indicators: ["#include <", "std::", "cout <<", "using namespace"] },
  c: { extensions: [".c", ".h"], indicators: ["#include <", "printf(", "int main("] },
  csharp: { extensions: [".cs"], indicators: ["using System;", "namespace ", "public class ", "Console.WriteLine"] },
  go: { extensions: [".go"], indicators: ["package main", "func main(", "import (", "fmt.Println"] },
  rust: { extensions: [".rs"], indicators: ["fn main()", "let mut ", "println!", "use std::"] },
  ruby: { extensions: [".rb"], indicators: ["def ", "end", "puts ", "require '", "class "] },
  php: { extensions: [".php"], indicators: ["<?php", "echo ", "$_GET", "$_POST", "function "] },
  swift: { extensions: [".swift"], indicators: ["import ", "func ", "let ", "var ", "class "] },
  kotlin: { extensions: [".kt", ".kts"], indicators: ["fun main(", "val ", "var ", "class ", "import "] },
  html: { extensions: [".html", ".htm"], indicators: ["<!DOCTYPE", "<html", "<head", "<body", "<div"] },
  css: { extensions: [".css"], indicators: ["{", "}", ":", ";", "margin:", "padding:", "color:"] },
  scss: { extensions: [".scss"], indicators: ["&:", "@mixin", "@include", "$", "nesting"] },
  json: { extensions: [".json"], indicators: ["{", "}", ":", ",", "\""] },
  yaml: { extensions: [".yml", ".yaml"], indicators: ["  ", ":", "-", "|", ">"] },
  xml: { extensions: [".xml"], indicators: ["<?xml", "<", ">", "</"] },
  markdown: { extensions: [".md", ".markdown"], indicators: ["#", "**", "*", "```", "["] },
  sql: { extensions: [".sql"], indicators: ["SELECT ", "FROM ", "WHERE ", "INSERT ", "CREATE TABLE"] },
  bash: { extensions: [".sh", ".bash"], indicators: ["#!/bin/bash", "#!/bin/sh", "echo ", "export ", "cd "] },
  powershell: { extensions: [".ps1"], indicators: ["Write-Host", "Get-", "Set-", "$_", "function "] },
  dockerfile: { extensions: ["Dockerfile", "Containerfile"], indicators: ["FROM ", "RUN ", "COPY ", "CMD ", "ENTRYPOINT"] },
  makefile: { extensions: ["Makefile", "makefile"], indicators: [".PHONY:", "\t", "all:", "clean:", "install:"] },
  r: { extensions: [".r", ".R"], indicators: ["library(", "data.frame", "ggplot(", "<-"] },
  matlab: { extensions: [".m"], indicators: ["function ", "end", "fprintf(", "plot("] },
  scala: { extensions: [".scala"], indicators: ["def ", "val ", "object ", "class ", "import "] },
  perl: { extensions: [".pl", ".pm"], indicators: ["use strict;", "my $", "sub ", "print "] },
  lua: { extensions: [".lua"], indicators: ["local ", "function ", "end", "print("] },
  dart: { extensions: [".dart"], indicators: ["void main()", "class ", "import '", "print("] },
  vue: { extensions: [".vue"], indicators: ["<template>", "<script>", "<style>", "export default"] },
  svelte: { extensions: [".svelte"], indicators: ["<script>", "<style>", "{#", "on:"] },
  graphql: { extensions: [".graphql", ".gql"], indicators: ["type ", "query ", "mutation ", "fragment "] },
  protobuf: { extensions: [".proto"], indicators: ["syntax = ", "message ", "package ", "import "] }
};

const FILE_ICONS = {
  ".py": "🐍",
  ".js": "📜",
  ".ts": "🔷",
  ".tsx": "⚛️",
  ".java": "☕",
  ".cpp": "⚙️",
  ".c": "⚙️",
  ".cs": "🟣",
  ".go": "🔵",
  ".rs": "🦀",
  ".rb": "💎",
  ".php": "🐘",
  ".swift": "🍎",
  ".kt": "🟠",
  ".html": "🌐",
  ".css": "🎨",
  ".scss": "🎨",
  ".json": "📋",
  ".yml": "⚙️",
  ".yaml": "⚙️",
  ".xml": "📄",
  ".md": "📝",
  ".sql": "🗃️",
  ".sh": "💻",
  ".ps1": "💻",
  "Dockerfile": "🐳",
  "Makefile": "🔧",
  ".gitignore": "🚫",
  ".env": "🔒",
  "default": "📄"
};

const DEFAULT_SETTINGS = {
  theme: "dark",
  autoScan: false,
  duplicateStrategy: "latest",
  defaultDownloadFormat: "zip",
  showNotifications: true,
  highlightCodeBlocks: true,
  includeAutoFiles: true,
  maxHistoryItems: 50,
  compressionLevel: "default",
  autoGenerateReadme: true,
  autoGenerateDependencies: true,
  liveScan: {
    enabled: true,
    autoStart: true,
    debounceMs: 500,
    showNotifications: true,
    autoAddToProject: true,
    highlightNewBlocks: true,
    maxLiveBlocks: 50,
    pauseOnPopupOpen: false
  },
  versionHistory: {
    enabled: true,
    maxVersionsPerFile: 20,
    autoSave: true
  },
  codeValidation: {
    enabled: true,
    validateOnSave: true,
    validateOnExport: false
  },
  github: {
    token: null,
    defaultRepo: null,
    autoCreateRepo: false
  },
  ideExport: {
    defaultIDE: "vscode",
    autoGenerateWorkspace: true
  },
  universalSearch: {
    defaultLimit: 50,
    cacheEnabled: true
  },
  aiFilename: {
    enabled: true,
    useChromeAI: true,
    fallbackHeuristic: true
  },
  teamCollaboration: {
    enabled: false,
    teamId: null,
    autoSync: true
  },
  cloudSync: {
    enabled: false,
    endpoint: null,
    apiKey: null,
    autoSync: false,
    interval: 60000
  },
  apiBridge: {
    enabled: false,
    apiKey: null,
    port: 8765
  },
  deployment: {
    vercelToken: null,
    netlifyToken: null,
    railwayToken: null
  }
};

const MESSAGE_TYPES = {
  SCAN_PAGE: "SCAN_PAGE",
  SCAN_PAGE_RESPONSE: "SCAN_PAGE_RESPONSE",
  SCAN_SELECTION: "SCAN_SELECTION",
  SCAN_SELECTION_RESPONSE: "SCAN_SELECTION_RESPONSE",
  GENERATE_ZIP: "GENERATE_ZIP",
  GENERATE_ZIP_RESPONSE: "GENERATE_ZIP_RESPONSE",
  DOWNLOAD_FILE: "DOWNLOAD_FILE",
  SAVE_PROJECT: "SAVE_PROJECT",
  SAVE_PROJECT_RESPONSE: "SAVE_PROJECT_RESPONSE",
  GET_PROJECTS: "GET_PROJECTS",
  GET_PROJECTS_RESPONSE: "GET_PROJECTS_RESPONSE",
  GET_PROJECT: "GET_PROJECT",
  GET_PROJECT_RESPONSE: "GET_PROJECT_RESPONSE",
  DELETE_PROJECT: "DELETE_PROJECT",
  DELETE_PROJECT_RESPONSE: "DELETE_PROJECT_RESPONSE",
  GET_SETTINGS: "GET_SETTINGS",
  GET_SETTINGS_RESPONSE: "GET_SETTINGS_RESPONSE",
  UPDATE_SETTINGS: "UPDATE_SETTINGS",
  UPDATE_SETTINGS_RESPONSE: "UPDATE_SETTINGS_RESPONSE",
  EXPORT_DATA: "EXPORT_DATA",
  EXPORT_DATA_RESPONSE: "EXPORT_DATA_RESPONSE",
  IMPORT_DATA: "IMPORT_DATA",
  IMPORT_DATA_RESPONSE: "IMPORT_DATA_RESPONSE",
  HIGHLIGHT_BLOCKS: "HIGHLIGHT_BLOCKS",
  STOP_HIGHLIGHT: "STOP_HIGHLIGHT",
  LIVE_SCAN_UPDATE: "LIVE_SCAN_UPDATE",
  LIVE_SCAN_UPDATE_RESPONSE: "LIVE_SCAN_UPDATE_RESPONSE",
  PROJECT_UPDATED: "PROJECT_UPDATED",
  PROJECT_UPDATED_RESPONSE: "PROJECT_UPDATED_RESPONSE",
  TAB_MANAGER_PING: "TAB_MANAGER_PING",
  TAB_MANAGER_PONG: "TAB_MANAGER_PONG",
  TAB_MANAGER_REQUEST_PROJECT: "TAB_MANAGER_REQUEST_PROJECT",
  TAB_MANAGER_PROJECT_UPDATE: "TAB_MANAGER_PROJECT_UPDATE",
  TAB_MANAGER_REGISTER: "TAB_MANAGER_REGISTER",
  MERGE_TABS: "MERGE_TABS",
  MERGE_TABS_RESPONSE: "MERGE_TABS_RESPONSE",
  VERSION_HISTORY_SAVE: "VERSION_HISTORY_SAVE",
  VERSION_HISTORY_GET: "VERSION_HISTORY_GET",
  VERSION_HISTORY_TIMELINE: "VERSION_HISTORY_TIMELINE",
  VERSION_HISTORY_DIFF: "VERSION_HISTORY_DIFF",
  UNIVERSAL_SEARCH: "UNIVERSAL_SEARCH",
  UNIVERSAL_SEARCH_RESPONSE: "UNIVERSAL_SEARCH_RESPONSE",
  CODE_DIFF: "CODE_DIFF",
  CODE_DIFF_RESPONSE: "CODE_DIFF_RESPONSE",
  IDE_EXPORT: "IDE_EXPORT",
  IDE_EXPORT_RESPONSE: "IDE_EXPORT_RESPONSE",
  GITHUB_AUTHENTICATE: "GITHUB_AUTHENTICATE",
  GITHUB_AUTHENTICATE_RESPONSE: "GITHUB_AUTHENTICATE_RESPONSE",
  GITHUB_GET_REPOS: "GITHUB_GET_REPOS",
  GITHUB_GET_REPOS_RESPONSE: "GITHUB_GET_REPOS_RESPONSE",
  GITHUB_PUSH_PROJECT: "GITHUB_PUSH_PROJECT",
  GITHUB_PUSH_PROJECT_RESPONSE: "GITHUB_PUSH_PROJECT_RESPONSE",
  GITHUB_CREATE_GIST: "GITHUB_CREATE_GIST",
  GITHUB_CREATE_GIST_RESPONSE: "GITHUB_CREATE_GIST_RESPONSE",
  TEMPLATE_GET: "TEMPLATE_GET",
  TEMPLATE_GET_RESPONSE: "TEMPLATE_GET_RESPONSE",
  TEMPLATE_CREATE_PROJECT: "TEMPLATE_CREATE_PROJECT",
  TEMPLATE_CREATE_PROJECT_RESPONSE: "TEMPLATE_CREATE_PROJECT_RESPONSE",
  CODE_VALIDATE: "CODE_VALIDATE",
  CODE_VALIDATE_RESPONSE: "CODE_VALIDATE_RESPONSE",
  DUPLICATE_DETECT: "DUPLICATE_DETECT",
  DUPLICATE_DETECT_RESPONSE: "DUPLICATE_DETECT_RESPONSE",
  AI_REFINE_FILENAMES: "AI_REFINE_FILENAMES",
  AI_REFINE_FILENAMES_RESPONSE: "AI_REFINE_FILENAMES_RESPONSE",
  TEAM_CREATE: "TEAM_CREATE",
  TEAM_JOIN: "TEAM_JOIN",
  TEAM_INVITE: "TEAM_INVITE",
  TEAM_SHARE_PROJECT: "TEAM_SHARE_PROJECT",
  TEAM_SYNC_CHANGES: "TEAM_SYNC_CHANGES",
  CLOUD_SYNC_PUSH: "CLOUD_SYNC_PUSH",
  CLOUD_SYNC_PULL: "CLOUD_SYNC_PULL",
  CLOUD_SYNC_ALL: "CLOUD_SYNC_ALL",
  CLOUD_SYNC_STATUS: "CLOUD_SYNC_STATUS",
  CUSTOM_PARSER_CREATE: "CUSTOM_PARSER_CREATE",
  CUSTOM_PARSER_LIST: "CUSTOM_PARSER_LIST",
  CUSTOM_PARSER_DELETE: "CUSTOM_PARSER_DELETE",
  API_BRIDGE_ENABLE: "API_BRIDGE_ENABLE",
  API_BRIDGE_DISABLE: "API_BRIDGE_DISABLE",
  API_BRIDGE_STATUS: "API_BRIDGE_STATUS",
  VSCODE_SEND_PROJECT: "VSCODE_SEND_PROJECT",
  VSCODE_STATUS: "VSCODE_STATUS",
  ANALYTICS_PROJECT: "ANALYTICS_PROJECT",
  ANALYTICS_ALL: "ANALYTICS_ALL",
  ANALYTICS_HISTORY: "ANALYTICS_HISTORY",
  ANALYTICS_SCORE: "ANALYTICS_SCORE",
  DEPLOY_VERCEL: "DEPLOY_VERCEL",
  DEPLOY_NETLIFY: "DEPLOY_NETLIFY",
  DEPLOY_RAILWAY: "DEPLOY_RAILWAY",
  DEPLOY_GITHUB_PAGES: "DEPLOY_GITHUB_PAGES",
  DEPLOY_STATUS: "DEPLOY_STATUS"
};

const DB_CONFIG = {
  name: "CodeExtractorDB",
  version: 3,
  stores: {
    projects: {
      name: "projects",
      keyPath: "id",
      indexes: [
        { name: "sourceUrl", keyPath: "sourceUrl" },
        { name: "createdAt", keyPath: "createdAt" },
        { name: "name", keyPath: "name" }
      ]
    },
    files: {
      name: "files",
      keyPath: "id",
      indexes: [
        { name: "projectId", keyPath: "projectId" },
        { name: "fileName", keyPath: "fileName" }
      ]
    },
    settings: {
      name: "settings",
      keyPath: "key",
      indexes: []
    },
    version_history: {
      name: "version_history",
      keyPath: "id",
      indexes: [
        { name: "projectId", keyPath: "projectId" },
        { name: "filePath", keyPath: "filePath" },
        { name: "timestamp", keyPath: "timestamp" }
      ]
    },
    templates: {
      name: "templates",
      keyPath: "id",
      indexes: [
        { name: "category", keyPath: "category" },
        { name: "language", keyPath: "language" }
      ]
    },
    search_index: {
      name: "search_index",
      keyPath: "id",
      indexes: [
        { name: "type", keyPath: "type" },
        { name: "projectId", keyPath: "projectId" }
      ]
    },
    teams: {
      name: "teams",
      keyPath: "id",
      indexes: [
        { name: "ownerId", keyPath: "ownerId" },
        { name: "name", keyPath: "name" }
      ]
    },
    invites: {
      name: "invites",
      keyPath: "id",
      indexes: [
        { name: "teamId", keyPath: "teamId" },
        { name: "code", keyPath: "code" },
        { name: "status", keyPath: "status" }
      ]
    },
    custom_parsers: {
      name: "custom_parsers",
      keyPath: "id",
      indexes: [
        { name: "name", keyPath: "name" },
        { name: "isEnabled", keyPath: "isEnabled" }
      ]
    },
    deployments: {
      name: "deployments",
      keyPath: "id",
      indexes: [
        { name: "platform", keyPath: "platform" },
        { name: "deployedAt", keyPath: "deployedAt" },
        { name: "projectName", keyPath: "projectName" }
      ]
    },
    team_changes: {
      name: "team_changes",
      keyPath: "id",
      indexes: [
        { name: "teamId", keyPath: "teamId" },
        { name: "userId", keyPath: "userId" },
        { name: "timestamp", keyPath: "timestamp" }
      ]
    }
  }
};

const REGEX_PATTERNS = {
  FILE_NAME: /(?:^|\s|["'`])([a-zA-Z0-9_][a-zA-Z0-9_.\-]+\.[a-zA-Z0-9]{1,6})(?:["'`]|\s|:|$)/,
  FILE_PATH: /(?:^|\s|["'`])([a-zA-Z0-9_\/\\.\-]+\.[a-zA-Z0-9]{1,6})(?:["'`]|\s|:|$)/,
  TREE_LINE: /^[│├└─\s┬┼]*[├└│─\s]+(.+)$/,
  TREE_BRANCH: /^[│├└─\s┬┼]+/,
  LANGUAGE_CLASS: /language-(\w+)/i,
  IMPORT_PYTHON: /^(?:import |from )[\w.]+/m,
  IMPORT_JS: /(?:require\(|import |from ['"])[\w./-]+/m,
  COMMENT_FILENAME: /^(?:\/\/|#|\/\*|--)\s*(?:filename|file|name):\s*([a-zA-Z0-9_\/\\.\-]+\.[a-zA-Z0-9]{1,6})/im,
  CREATE_FILE_TEXT: /(?:create|new|save|write|make)\s+(?:the\s+)?(?:file\s+)?([a-zA-Z0-9_\/\\.\-]+\.[a-zA-Z0-9]{1,6})/i,
  MARKDOWN_CODE: /```(\w+)?\n([\s\S]*?)```/g,
  HTML_ENTITIES: {
    amp: /&amp;/g,
    lt: /&lt;/g,
    gt: /&gt;/g,
    quot: /&quot;/g,
    apos: /&#39;/g,
    nbsp: /&nbsp;/g
  }
};

const AUTO_FILES = {
  README: `# {PROJECT_NAME}

Generated by Code Extractor & Project Builder

## Project Structure
\`\`\`
{TREE_STRUCTURE}
\`\`\`

## Files
{FILE_LIST}

## Getting Started
{GETTING_STARTED}

---
*Generated on {TIMESTAMP} from {SOURCE_URL}*
`,
  GITIGNORE: `# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
.venv/
*.egg-info/
dist/
build/

# Node
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
dist/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
.env.*.local

# Logs
*.log
logs/
`,
  REQUIREMENTS_TXT: `# Auto-generated dependencies
# Review and update versions as needed
{DEPENDENCIES}
`,
  PACKAGE_JSON: `{
  "name": "{PROJECT_NAME}",
  "version": "1.0.0",
  "description": "Generated by Code Extractor",
  "main": "{MAIN_FILE}",
  "scripts": {
    "start": "node {MAIN_FILE}",
    "test": "echo \\"Error: no test specified\\" && exit 1"
  },
  "dependencies": {
{DEPENDENCIES}
  }
}
`
};

const MAX_LIMITS = {
  MAX_CODE_BLOCK_SIZE: 500000,
  MAX_PROJECT_SIZE: 50000000,
  MAX_FILES_PER_PROJECT: 500,
  MAX_SCAN_TIME_MS: 30000,
  MAX_HISTORY_ITEMS: 100,
  MAX_ZIP_SIZE_MB: 100,
  MAX_FILE_NAME_LENGTH: 255,
  MAX_PATH_LENGTH: 4096
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SUPPORTED_SITES,
    LANGUAGE_MAP,
    FILE_ICONS,
    DEFAULT_SETTINGS,
    MESSAGE_TYPES,
    DB_CONFIG,
    REGEX_PATTERNS,
    AUTO_FILES,
    MAX_LIMITS
  };
}
