const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'https://chatgpt.com',
  runScripts: 'dangerously',
  resources: 'usable'
});

global.document = dom.window.document;
global.window = dom.window;
global.navigator = dom.window.navigator;
global.Node = dom.window.Node;
global.NodeFilter = dom.window.NodeFilter;

global.chrome = {
  runtime: {
    sendMessage: (msg, cb) => cb && cb({ success: true }),
    onMessage: { addListener: () => {} },
    lastError: null
  },
  storage: {
    sync: {
      get: (keys, cb) => cb && cb({}),
      set: (data, cb) => cb && cb()
    },
    local: {
      get: (keys, cb) => cb && cb({}),
      set: (data, cb) => cb && cb(),
      getBytesInUse: (cb) => cb && cb(0),
      clear: (cb) => cb && cb()
    },
    onChanged: { addListener: () => {} }
  },
  tabs: {
    query: (opts, cb) => cb && cb([{ id: 1, url: 'https://chatgpt.com' }])
  },
  downloads: {
    download: (opts, cb) => cb && cb(1)
  }
};

global.JSZip = class JSZip {
  constructor() { this.files = {}; }
  folder(name) { return { folder: () => this, file: (n, c) => { this.files[n] = c; } }; }
  file(name, content) { this.files[name] = content; }
  generateAsync() { return Promise.resolve({ size: 100 }); }
};

global.saveAs = () => {};

global.indexedDB = {
  open: () => ({ onerror: null, onsuccess: null, onupgradeneeded: null, result: null })
};

global.IDBKeyRange = { bound: () => ({}) };

const tests = [];
let currentDescribe = null;
const results = { total: 0, passed: 0, failed: 0, errors: [] };

global.describe = function(name, fn) {
  currentDescribe = name;
  fn();
  currentDescribe = null;
};

global.it = function(name, fn) {
  tests.push({ name: currentDescribe ? `${currentDescribe} › ${name}` : name, fn });
};

global.expect = function(value) {
  return {
    toBe(expected) {
      if (value !== expected) throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(value)}`);
    },
    toEqual(expected) {
      if (JSON.stringify(value) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(value)}`);
    },
    toContain(item) {
      if (!value.includes(item)) throw new Error(`Expected ${JSON.stringify(value)} to contain ${JSON.stringify(item)}`);
    },
    toHaveLength(n) {
      if (value.length !== n) throw new Error(`Expected length ${n} but got ${value.length}`);
    },
    toBeTruthy() {
      if (!value) throw new Error(`Expected truthy but got ${JSON.stringify(value)}`);
    },
    toBeFalsy() {
      if (value) throw new Error(`Expected falsy but got ${JSON.stringify(value)}`);
    },
    toBeNull() {
      if (value !== null) throw new Error(`Expected null but got ${JSON.stringify(value)}`);
    },
    toBeGreaterThan(n) {
      if (!(value > n)) throw new Error(`Expected ${value} > ${n}`);
    },
    toBeLessThan(n) {
      if (!(value < n)) throw new Error(`Expected ${value} < ${n}`);
    },
    toMatch(regex) {
      if (!regex.test(value)) throw new Error(`Expected ${JSON.stringify(value)} to match ${regex}`);
    },
    toBeInstanceOf(C) {
      if (!(value instanceof C)) throw new Error(`Expected instance of ${C.name}`);
    },
    toHaveProperty(key, val) {
      if (!(key in value)) throw new Error(`Missing property "${key}"`);
      if (val !== undefined && value[key] !== val) throw new Error(`Property "${key}" expected ${JSON.stringify(val)} got ${JSON.stringify(value[key])}`);
    }
  };
};

global.TestRunner = { describe: global.describe, it: global.it, expect: global.expect, results };

function loadScript(filePath) {
  try {
    let code = fs.readFileSync(filePath, 'utf8');

    code = code.replace(/^import\s+.*from\s+['"].*['"];?\s*/gm, '');
    code = code.replace(/^export\s+\{[^}]*\};?\s*/gm, '');
    code = code.replace(/^export\s+default\s+/gm, '');

    const sandbox = {
      module: { exports: {} },
      exports: {},
      console: global.console,
      document: global.document,
      window: global.window,
      navigator: global.navigator,
      Node: global.Node,
      NodeFilter: global.NodeFilter,
      chrome: global.chrome,
      JSZip: global.JSZip,
      saveAs: global.saveAs,
      indexedDB: global.indexedDB,
      IDBKeyRange: global.IDBKeyRange
    };

    Object.keys(global).forEach(key => {
      if (!(key in sandbox)) sandbox[key] = global[key];
    });

    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: filePath });

    const exported = sandbox.module.exports;
    if (exported && typeof exported === 'object') {
      Object.keys(exported).forEach(key => {
        if (!global[key]) {
          global[key] = exported[key];
        }
      });
    }

    return true;
  } catch (e) {
    console.error(`  ❌ ${path.basename(filePath)}: ${e.message.split('\n')[0]}`);
    return false;
  }
}

console.log('📦 Loading modules...\n');

const baseDir = path.resolve(__dirname, '..');

const modules = [
  'utils/constants.js',
  'utils/helpers.js',
  'utils/domUtils.js',
  'utils/regexPatterns.js',
  'utils/languageMap.js',
  'utils/validators.js',
  'utils/errorHandler.js',
  'utils/logger.js',
  'utils/messageHandler.js',
  'parsers/BaseParser.js',
  'parsers/ChatGPTParser.js',
  'parsers/ClaudeParser.js',
  'parsers/GeminiParser.js',
  'parsers/OutlierParser.js',
  'parsers/MistralParser.js',
  'parsers/PoeParser.js',
  'parsers/GitHubParser.js',
  'parsers/StackOverflowParser.js',
  'parsers/GenericParser.js',
  'parsers/ParserFactory.js',
  'core/CodeBlockExtractor.js',
  'core/FileNameDetector.js',
  'core/LanguageIdentifier.js',
  'core/TreeParser.js',
  'core/ProjectMapper.js',
  'core/DuplicateHandler.js',
  'core/ProjectAssembler.js',
  'core/CodeScanner.js',
  'generators/ZipGenerator.js',
  'generators/ReadmeGenerator.js',
  'generators/DependencyGenerator.js',
  'generators/TreeVisualizer.js'
];

let loaded = 0;
let failed = 0;

for (const mod of modules) {
  const ok = loadScript(path.join(baseDir, mod));
  if (ok) loaded++; else failed++;
}

console.log(`\n✅ ${loaded}/${modules.length} modules loaded`);
if (failed > 0) console.log(`⚠️  ${failed} failed\n`);
else console.log('');

const testFiles = [
  'test-codeExtractor.js',
  'test-fileDetector.js',
  'test-languageId.js',
  'test-treeParser.js',
  'test-projectMapper.js',
  'test-duplicateHandler.js',
  'test-zipGenerator.js'
];

let testsLoaded = 0;
for (const tf of testFiles) {
  if (loadScript(path.join(__dirname, tf))) testsLoaded++;
}
console.log(`📝 ${testsLoaded}/${testFiles.length} test files loaded\n`);

async function runTests() {
  console.log('🧪 Running tests...\n');

  for (const test of tests) {
    results.total++;
    try {
      await test.fn();
      results.passed++;
      console.log(`  ✅ ${test.name}`);
    } catch (error) {
      results.failed++;
      results.errors.push({ name: test.name, error: error.message });
      console.log(`  ❌ ${test.name}`);
      console.log(`     ${error.message.split('\n')[0]}`);
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  const icon = results.failed === 0 ? '✅' : '❌';
  console.log(`${icon} ${results.passed}/${results.total} tests passed`);
  if (results.failed > 0) {
    console.log(`   ${results.failed} failed`);
    console.log('\nFailures:');
    results.errors.forEach(e => {
      console.log(`  • ${e.name}`);
      console.log(`    ${e.error.split('\n')[0]}`);
    });
  }
  console.log(`${'═'.repeat(50)}`);

  process.exit(results.failed > 0 ? 1 : 0);
}

runTests();
