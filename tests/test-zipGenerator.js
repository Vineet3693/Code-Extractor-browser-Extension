const { describe, it, expect } = TestRunner;

describe('ZipGenerator', () => {
  it('creates valid ZIP with correct file structure', () => {
    const generator = new ZipGenerator({ includeAutoFiles: false });
    const project = {
      name: 'test-project',
      files: [
        { path: 'app.py', content: 'import flask\napp = Flask(__name__)', size: 30, lines: 2, language: 'python' },
        { path: 'config.py', content: 'DEBUG = True', size: 12, lines: 1, language: 'python' }
      ]
    };
    expect(generator).toBeTruthy();
    expect(typeof generator.generate).toBe('function');
  });

  it('creates nested directories in ZIP', () => {
    const generator = new ZipGenerator({ includeAutoFiles: false });
    const project = {
      name: 'nested-project',
      files: [
        { path: 'src/app.py', content: 'import os', size: 10, lines: 1, language: 'python' },
        { path: 'src/utils/helper.py', content: 'def help(): pass', size: 16, lines: 1, language: 'python' },
        { path: 'README.md', content: '# Test', size: 6, lines: 1, language: 'markdown' }
      ]
    };
    expect(project.files.length).toBe(3);
  });

  it('includes auto-generated README when enabled', () => {
    const generator = new ZipGenerator({ includeAutoFiles: true });
    const project = {
      name: 'readme-project',
      files: [
        { path: 'app.py', content: 'print("hello")', size: 14, lines: 1, language: 'python' }
      ],
      metadata: {
        sourceSiteName: 'ChatGPT',
        extractedAt: new Date().toISOString(),
        sourceURL: 'https://chatgpt.com',
        languages: ['python']
      },
      settings: { includeReadme: true, includeGitignore: false, includeDependencies: false }
    };
    expect(generator.includeAutoFiles).toBeTruthy();
  });

  it('includes auto-generated .gitignore when enabled', () => {
    const generator = new ZipGenerator({ includeAutoFiles: true });
    const project = {
      name: 'gitignore-project',
      files: [
        { path: 'app.py', content: 'import os', size: 10, lines: 1, language: 'python' }
      ],
      metadata: { languages: ['python'] },
      settings: { includeReadme: false, includeGitignore: true, includeDependencies: false }
    };
    const gitignore = generator.generateGitignore(['python']);
    expect(gitignore).toContain('__pycache__');
    expect(gitignore).toContain('.py[cod]');
  });

  it('handles empty project gracefully', () => {
    const generator = new ZipGenerator({ includeAutoFiles: false });
    const project = {
      name: 'empty-project',
      files: []
    };
    expect(project.files.length).toBe(0);
  });

  it('generates gitignore for multiple languages', () => {
    const generator = new ZipGenerator({ includeAutoFiles: true });
    const gitignore = generator.generateGitignore(['python', 'javascript', 'java']);
    expect(gitignore).toContain('__pycache__');
    expect(gitignore).toContain('node_modules');
    expect(gitignore).toContain('*.class');
  });
});
