const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

let currentLevel = LogLevel.DEBUG;
const isDev = typeof process !== "undefined" && process.env?.NODE_ENV === "development";

if (!isDev) {
  currentLevel = LogLevel.WARN;
}

function formatMessage(component, message, data) {
  const prefix = `[CodeExtractor][${component}]`;
  if (data !== undefined) {
    return [prefix, message, data];
  }
  return [prefix, message];
}

function log(component, message, data = undefined) {
  if (currentLevel <= LogLevel.DEBUG) {
    console.log(...formatMessage(component, message, data));
  }
}

function info(component, message, data = undefined) {
  if (currentLevel <= LogLevel.INFO) {
    console.info(...formatMessage(component, message, data));
  }
}

function warn(component, message, data = undefined) {
  if (currentLevel <= LogLevel.WARN) {
    console.warn(...formatMessage(component, message, data));
  }
}

function error(component, message, err = undefined) {
  if (currentLevel <= LogLevel.ERROR) {
    console.error(...formatMessage(component, message, err));
  }
}

function group(label) {
  if (currentLevel <= LogLevel.DEBUG) {
    console.group(label);
  }
}

function groupEnd() {
  if (currentLevel <= LogLevel.DEBUG) {
    console.groupEnd();
  }
}

const timers = new Map();

function time(label) {
  if (currentLevel <= LogLevel.DEBUG) {
    timers.set(label, performance.now());
    console.time(`[CodeExtractor] ${label}`);
  }
}

function timeEnd(label) {
  if (currentLevel <= LogLevel.DEBUG && timers.has(label)) {
    console.timeEnd(`[CodeExtractor] ${label}`);
    timers.delete(label);
  }
}

function setLogLevel(level) {
  currentLevel = level;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    LogLevel,
    log,
    info,
    warn,
    error,
    group,
    groupEnd,
    time,
    timeEnd,
    setLogLevel
  };
}
