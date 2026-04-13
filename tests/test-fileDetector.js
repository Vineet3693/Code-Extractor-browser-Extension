const { describe, it, expect } = TestRunner;

describe('FileNameDetector', () => {
  it('detects file name from header label', () => {
    const detector = new FileNameDetector();
    const block = {
      code: 'import flask',
      language: 'python',
      label: 'app.py',
      textBefore: '',
      textAfter: '',
      surroundingText: '',
      index: 0
    };
    const result = detector.detectFileName(block);
    expect(result).toBe('app.py');
  });

  it('detects file name from Create pattern', () => {
    const detector = new FileNameDetector();
    const block = {
      code: 'import os',
      language: 'python',
      label: null,
      textBefore: 'Create a file called config.py',
      textAfter: '',
      surroundingText: 'Create a file called config.py',
      index: 0
    };
    const result = detector.detectFileName(block);
    expect(result).toBe('config.py');
  });

  it('detects file path from surrounding text', () => {
    const detector = new FileNameDetector();
    const block = {
      code: 'DATABASE_URL = "..."',
      language: 'python',
      label: null,
      textBefore: 'In src/utils/database.py, add:',
      textAfter: '',
      surroundingText: 'In src/utils/database.py, add:',
      index: 0
    };
    const result = detector.detectFileName(block);
    expect(result).toBe('database.py');
  });

  it('detects file name from code comment', () => {
    const detector = new FileNameDetector();
    const block = {
      code: '# filename: settings.py\nDEBUG = True',
      language: 'python',
      label: null,
      textBefore: '',
      textAfter: '',
      surroundingText: '',
      index: 0
    };
    const result = detector.detectFileName(block);
    expect(result).toBe('settings.py');
  });

  it('generates fallback name when nothing detected', () => {
    const detector = new FileNameDetector();
    const block = {
      code: 'some code here',
      language: 'python',
      label: null,
      textBefore: '',
      textAfter: '',
      surroundingText: '',
      index: 2
    };
    const result = detector.detectFileName(block);
    expect(result).toMatch(/\.py$/);
  });

  it('detects file name from backtick formatting', () => {
    const detector = new FileNameDetector();
    const block = {
      code: 'console.log("hello")',
      language: 'javascript',
      label: null,
      textBefore: "Here's the `index.js` file:",
      textAfter: '',
      surroundingText: "Here's the `index.js` file:",
      index: 0
    };
    const result = detector.detectFileName(block);
    expect(result).toBe('index.js');
  });

  it('handles multiple blocks with unique names', () => {
    const detector = new FileNameDetector();
    const blocks = [
      { code: 'import flask', language: 'python', label: 'app.py', textBefore: '', textAfter: '', surroundingText: '', index: 0 },
      { code: 'DEBUG = True', language: 'python', label: 'config.py', textBefore: '', textAfter: '', surroundingText: '', index: 1 }
    ];
    const results = detector.detectAll(blocks);
    expect(results[0].fileName).toBe('app.py');
    expect(results[1].fileName).toBe('config.py');
  });

  it('sanitizes invalid file names', () => {
    const detector = new FileNameDetector();
    const sanitized = detector.sanitizeFileName('file<name>.py');
    expect(sanitized).not.toContain('<');
    expect(sanitized).not.toContain('>');
    expect(sanitized).toMatch(/\.py$/);
  });
});
