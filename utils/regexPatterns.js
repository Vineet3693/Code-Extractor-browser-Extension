const FILE_NAME_REGEX = /(?:^|\s|["'`])([a-zA-Z0-9_][a-zA-Z0-9_.\-]+\.[a-zA-Z0-9]{1,6})(?:["'`]|\s|:|$)/;
const FILE_PATH_REGEX = /(?:^|\s|["'`])([a-zA-Z0-9_\/\\.\-]+\.[a-zA-Z0-9]{1,6})(?:["'`]|\s|:|$)/;
const TREE_LINE_REGEX = /^[│├└─\s┬┼]*[├└│─\s]+(.+)$/;
const TREE_BRANCH_REGEX = /^[│├└─\s┬┼]+/;
const LANGUAGE_CLASS_REGEX = /language-(\w+)/i;
const IMPORT_PYTHON_REGEX = /^(?:import |from )[\w.]+/m;
const IMPORT_JS_REGEX = /(?:require\(|import |from ['"])[\w./-]+/m;
const COMMENT_FILENAME_REGEX = /^(?:\/\/|#|\/\*|--)\s*(?:filename|file|name):\s*([a-zA-Z0-9_\/\\.\-]+\.[a-zA-Z0-9]{1,6})/im;
const CREATE_FILE_TEXT_REGEX = /(?:create|new|save|write|make)\s+(?:the\s+)?(?:file\s+)?([a-zA-Z0-9_\/\\.\-]+\.[a-zA-Z0-9]{1,6})/i;
const MARKDOWN_CODE_REGEX = /```(\w+)?\n([\s\S]*?)```/g;
const HTML_ENTITY_REGEX = /&(amp|lt|gt|quot|#39|nbsp);/g;

const HTML_ENTITY_MAP = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  nbsp: " "
};

function decodeHTMLEntitiesRegex(text) {
  return text.replace(HTML_ENTITY_REGEX, (_, entity) => HTML_ENTITY_MAP[entity] || "");
}

function extractFileNamesFromText(text) {
  const matches = [];
  let match;
  const regex = /([a-zA-Z0-9_][a-zA-Z0-9_.\-\/\\]*\.[a-zA-Z0-9]{1,6})/g;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

function extractTreeLines(text) {
  const lines = text.split("\n");
  return lines.filter((line) => TREE_LINE_REGEX.test(line) || TREE_BRANCH_REGEX.test(line));
}

function isTreeLine(line) {
  return TREE_LINE_REGEX.test(line) || /^[│├└─\s┬┼]+$/.test(line.trim());
}

function extractLanguageFromClass(className) {
  const match = className.match(LANGUAGE_CLASS_REGEX);
  return match ? match[1].toLowerCase() : null;
}

function extractFilenameFromComment(code) {
  const match = code.match(COMMENT_FILENAME_REGEX);
  return match ? match[1] : null;
}

function hasImportPattern(code, language) {
  if (language === "python") return IMPORT_PYTHON_REGEX.test(code);
  if (language === "javascript" || language === "typescript") return IMPORT_JS_REGEX.test(code);
  return false;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    FILE_NAME_REGEX,
    FILE_PATH_REGEX,
    TREE_LINE_REGEX,
    TREE_BRANCH_REGEX,
    LANGUAGE_CLASS_REGEX,
    IMPORT_PYTHON_REGEX,
    IMPORT_JS_REGEX,
    COMMENT_FILENAME_REGEX,
    CREATE_FILE_TEXT_REGEX,
    MARKDOWN_CODE_REGEX,
    HTML_ENTITY_REGEX,
    decodeHTMLEntitiesRegex,
    extractFileNamesFromText,
    extractTreeLines,
    isTreeLine,
    extractLanguageFromClass,
    extractFilenameFromComment,
    hasImportPattern
  };
}
