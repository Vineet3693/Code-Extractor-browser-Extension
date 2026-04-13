const { describe, it, expect } = TestRunner;

describe('DuplicateHandler', () => {
  it('keeps latest version with latest strategy', () => {
    const handler = new DuplicateHandler('latest');
    const files = [
      { path: 'app.py', content: 'v1', size: 10, lines: 1, language: 'python', fileName: 'app.py' },
      { path: 'config.py', content: 'config v1', size: 15, lines: 2, language: 'python', fileName: 'config.py' },
      { path: 'app.py', content: 'v2 updated', size: 20, lines: 3, language: 'python', fileName: 'app.py' }
    ];
    const result = handler.handleDuplicates(files);
    expect(result.length).toBe(2);
    const appFile = result.find(f => f.path === 'app.py');
    expect(appFile.content).toBe('v2 updated');
  });

  it('keeps all with version suffix using keep_both strategy', () => {
    const handler = new DuplicateHandler('keep_both');
    const files = [
      { path: 'app.py', content: 'v1', size: 10, lines: 1, language: 'python', fileName: 'app.py' },
      { path: 'app.py', content: 'v2', size: 20, lines: 2, language: 'python', fileName: 'app.py' }
    ];
    const result = handler.handleDuplicates(files);
    expect(result.length).toBe(2);
    expect(result[0].path).toBe('app.py');
    expect(result[1].path).toContain('copy');
  });

  it('correctly identifies duplicate groups', () => {
    const handler = new DuplicateHandler('latest');
    const files = [
      { path: 'app.py', content: 'v1', size: 10, lines: 1, language: 'python', fileName: 'app.py' },
      { path: 'config.py', content: 'c1', size: 15, lines: 2, language: 'python', fileName: 'config.py' },
      { path: 'app.py', content: 'v2', size: 20, lines: 3, language: 'python', fileName: 'app.py' },
      { path: 'utils.py', content: 'u1', size: 12, lines: 1, language: 'python', fileName: 'utils.py' },
      { path: 'config.py', content: 'c2', size: 18, lines: 2, language: 'python', fileName: 'config.py' }
    ];
    const duplicates = handler.findDuplicates(files);
    expect(duplicates.length).toBe(2);
  });

  it('handles no duplicates gracefully', () => {
    const handler = new DuplicateHandler('latest');
    const files = [
      { path: 'app.py', content: 'v1', size: 10, lines: 1, language: 'python', fileName: 'app.py' },
      { path: 'config.py', content: 'c1', size: 15, lines: 2, language: 'python', fileName: 'config.py' },
      { path: 'utils.py', content: 'u1', size: 12, lines: 1, language: 'python', fileName: 'utils.py' }
    ];
    const result = handler.handleDuplicates(files);
    expect(result.length).toBe(3);
  });

  it('keeps first version with keep_first strategy', () => {
    const handler = new DuplicateHandler('keep_first');
    const files = [
      { path: 'app.py', content: 'v1 original', size: 10, lines: 1, language: 'python', fileName: 'app.py' },
      { path: 'app.py', content: 'v2 updated', size: 20, lines: 3, language: 'python', fileName: 'app.py' }
    ];
    const result = handler.handleDuplicates(files);
    expect(result.length).toBe(1);
    expect(result[0].content).toBe('v1 original');
  });

  it('generates duplicate report', () => {
    const handler = new DuplicateHandler('latest');
    const files = [
      { path: 'app.py', content: 'v1', size: 10, lines: 1, language: 'python', fileName: 'app.py' },
      { path: 'app.py', content: 'v2', size: 20, lines: 3, language: 'python', fileName: 'app.py' }
    ];
    handler.handleDuplicates(files);
    const report = handler.getDuplicateReport();
    expect(report.totalDuplicates).toBe(1);
    expect(report.strategy).toBe('latest');
  });
});
