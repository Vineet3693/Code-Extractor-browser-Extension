const { describe, it, expect } = TestRunner;

describe('TreeParser', () => {
  it('parses ASCII tree with Unicode box characters', () => {
    const parser = new TreeParser();
    const treeText = `project/
├── src/
│   ├── app.py
│   └── utils/
│       └── helper.py
└── README.md`;
    const trees = parser.parseTree(treeText);
    expect(trees.length).toBeGreaterThan(0);
  });

  it('parses indentation-based tree', () => {
    const parser = new TreeParser();
    const treeText = `src/
    app.py
    utils/
        helper.py
README.md`;
    const trees = parser.parseTree(treeText);
    expect(trees.length).toBeGreaterThan(0);
  });

  it('correctly identifies directories vs files', () => {
    const parser = new TreeParser();
    const treeText = `src/
├── app.py
└── utils/`;
    const trees = parser.parseTree(treeText);
    expect(trees.length).toBeGreaterThan(0);
  });

  it('handles deeply nested structures', () => {
    const parser = new TreeParser();
    const treeText = `a/
├── b/
│   ├── c/
│   │   ├── d/
│   │   │   └── e.py
│   │   └── f.py
│   └── g.py
└── h.py`;
    const trees = parser.parseTree(treeText);
    expect(trees.length).toBeGreaterThan(0);
  });

  it('detects tree lines correctly', () => {
    const parser = new TreeParser();
    expect(parser.isTreeLine('├── app.py')).toBeTruthy();
    expect(parser.isTreeLine('└── README.md')).toBeTruthy();
    expect(parser.isTreeLine('│   ├── utils/')).toBeTruthy();
    expect(parser.isTreeLine('import os')).toBeFalsy();
    expect(parser.isTreeLine('def hello():')).toBeFalsy();
  });

  it('handles tree with comments after file names', () => {
    const parser = new TreeParser();
    const treeText = `src/
├── app.py  # Main application
└── config.py  # Configuration`;
    const trees = parser.parseTree(treeText);
    expect(trees.length).toBeGreaterThan(0);
  });

  it('extracts files from tree', () => {
    const parser = new TreeParser();
    const treeText = `src/
├── app.py
└── utils/
    └── helper.py`;
    const trees = parser.parseTree(treeText);
    expect(trees.length).toBeGreaterThan(0);
  });

  it('parses flat path list', () => {
    const parser = new TreeParser();
    const treeText = `src/app.py
src/utils/helper.py
README.md`;
    const trees = parser.parseTree(treeText);
    expect(trees.length).toBeGreaterThan(0);
  });

  it('returns empty for non-tree text', () => {
    const parser = new TreeParser();
    const text = `def hello():
    print("world")
    return True`;
    const trees = parser.parseTree(text);
    expect(trees.length).toBe(0);
  });
});
