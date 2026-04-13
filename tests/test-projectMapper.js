const { describe, it, expect } = TestRunner;

describe('ProjectMapper', () => {
  it('maps code blocks to files', () => {
    const mapper = new ProjectMapper();
    const blocks = [
      { code: 'import flask', language: 'python', fileName: 'app.py', index: 0 },
      { code: 'DEBUG = True', language: 'python', fileName: 'config.py', index: 1 }
    ];
    const structure = mapper.mapFiles(blocks);
    expect(structure.files.length).toBe(2);
  });

  it('builds tree from paths when no tree structure exists', () => {
    const mapper = new ProjectMapper();
    const blocks = [
      { code: 'import flask', language: 'python', fileName: 'src/app.py', index: 0 },
      { code: 'DEBUG = True', language: 'python', fileName: 'src/config.py', index: 1 },
      { code: '# README', language: 'markdown', fileName: 'README.md', index: 2 }
    ];
    const structure = mapper.mapFiles(blocks);
    expect(structure.files.length).toBe(3);
    expect(structure.directories.length).toBeGreaterThan(0);
  });

  it('handles case-insensitive matching', () => {
    const mapper = new ProjectMapper();
    const blocks = [
      { code: 'import flask', language: 'python', fileName: 'App.py', index: 0 }
    ];
    const structure = mapper.mapFiles(blocks);
    expect(structure.files.length).toBe(1);
  });

  it('normalizes paths with backslashes', () => {
    const mapper = new ProjectMapper();
    const blocks = [
      { code: 'import os', language: 'python', fileName: 'src\\utils\\helper.py', index: 0 }
    ];
    const structure = mapper.mapFiles(blocks);
    expect(structure.files[0].path).not.toContain('\\');
  });

  it('generates tree string', () => {
    const mapper = new ProjectMapper();
    const blocks = [
      { code: 'import flask', language: 'python', fileName: 'src/app.py', index: 0 },
      { code: 'DEBUG = True', language: 'python', fileName: 'src/config.py', index: 1 },
      { code: '# README', language: 'markdown', fileName: 'README.md', index: 2 }
    ];
    mapper.mapFiles(blocks);
    const treeString = mapper.getTreeString();
    expect(treeString.length).toBeGreaterThan(0);
  });

  it('handles empty blocks gracefully', () => {
    const mapper = new ProjectMapper();
    const structure = mapper.mapFiles([]);
    expect(structure.files.length).toBe(0);
  });
});
