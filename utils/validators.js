function isValidFileName(name) {
  if (!name || name.trim().length === 0) return false;
  if (name.length > 255) return false;
  if (/[<>:"/\\|?*\x00-\x1F]/.test(name)) return false;
  if (/^\.+$/.test(name)) return false;
  return true;
}

function isValidFilePath(path) {
  if (!path || path.trim().length === 0) return false;
  if (path.length > 4096) return false;
  if (/[<>:"|?*\x00-\x1F]/.test(path)) return false;
  const parts = path.split(/[\/\\]/);
  return parts.every((part) => part.length > 0 && part.length <= 255);
}

function isValidLanguage(lang) {
  if (!lang || typeof lang !== "string") return false;
  const validLanguages = [
    "python", "javascript", "typescript", "java", "cpp", "c", "csharp",
    "go", "rust", "ruby", "php", "swift", "kotlin", "html", "css",
    "scss", "json", "yaml", "xml", "markdown", "sql", "bash",
    "powershell", "dockerfile", "makefile", "r", "matlab", "scala",
    "perl", "lua", "dart", "vue", "svelte", "graphql", "text"
  ];
  return validLanguages.includes(lang.toLowerCase());
}

function isValidProjectName(name) {
  if (!name || name.trim().length === 0) return false;
  if (name.length > 100) return false;
  if (/[<>:"/\\|?*\x00-\x1F]/.test(name)) return false;
  return true;
}

function isValidCode(code) {
  if (!code || typeof code !== "string") return false;
  if (code.trim().length === 0) return false;
  if (code.trim().length < 3) return false;
  return true;
}

function sanitizeForFileSystem(name) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .substring(0, 255);
}

function validateProjectStructure(project) {
  const errors = [];
  const warnings = [];

  if (!project || !project.files || project.files.length === 0) {
    errors.push("Project has no files");
    return { valid: false, errors, warnings };
  }

  const paths = new Set();
  for (const file of project.files) {
    const path = file.path || file.fileName;

    if (!isValidFilePath(path)) {
      errors.push(`Invalid file path: "${path}"`);
    }

    if (paths.has(path)) {
      warnings.push(`Duplicate file path: "${path}"`);
    }
    paths.add(path);

    if (!isValidCode(file.content)) {
      warnings.push(`Empty or invalid content in: "${path}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    isValidFileName,
    isValidFilePath,
    isValidLanguage,
    isValidProjectName,
    isValidCode,
    sanitizeForFileSystem,
    validateProjectStructure
  };
}
