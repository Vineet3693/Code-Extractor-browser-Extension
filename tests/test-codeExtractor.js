const { describe, it, expect } = TestRunner;

describe('CodeBlockExtractor', () => {
  it('extracts code from pre>code elements', () => {
    const container = document.createElement('div');
    container.innerHTML = '<pre><code class="language-python">import flask\napp = Flask(__name__)</code></pre>';
    const extractor = new CodeBlockExtractor(new GenericParser());
    const blocks = extractor.extractAll(container);
    expect(blocks.length).toBe(1);
    expect(blocks[0].code).toContain('import flask');
    expect(blocks[0].language).toBe('python');
  });

  it('decodes HTML entities correctly', () => {
    const container = document.createElement('div');
    container.innerHTML = '<pre><code>&lt;div&gt;Hello &amp; World&lt;/div&gt;</code></pre>';
    const extractor = new CodeBlockExtractor(new GenericParser());
    const blocks = extractor.extractAll(container);
    expect(blocks[0].code).toContain('<div>');
    expect(blocks[0].code).toContain('&');
  });

  it('filters out empty code blocks', () => {
    const container = document.createElement('div');
    container.innerHTML = '<pre><code></code></pre><pre><code>   </code></pre>';
    const extractor = new CodeBlockExtractor(new GenericParser());
    const blocks = extractor.extractAll(container);
    expect(blocks.length).toBe(0);
  });

  it('handles nested pre>code as single block', () => {
    const container = document.createElement('div');
    container.innerHTML = '<pre><code class="language-js">const x = 1;</code></pre>';
    const extractor = new CodeBlockExtractor(new GenericParser());
    const blocks = extractor.extractAll(container);
    expect(blocks.length).toBe(1);
  });

  it('preserves indentation in code', () => {
    const code = 'def hello():\n    print("world")\n    return True';
    const container = document.createElement('div');
    container.innerHTML = `<pre><code class="language-python">${code}</code></pre>`;
    const extractor = new CodeBlockExtractor(new GenericParser());
    const blocks = extractor.extractAll(container);
    expect(blocks[0].code).toContain('    print');
  });

  it('extracts multiple code blocks', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <pre><code class="language-python">import os</code></pre>
      <pre><code class="language-js">const x = 1;</code></pre>
      <pre><code class="language-html">&lt;div&gt;test&lt;/div&gt;</code></pre>
    `;
    const extractor = new CodeBlockExtractor(new GenericParser());
    const blocks = extractor.extractAll(container);
    expect(blocks.length).toBe(3);
  });

  it('detects language from class attribute', () => {
    const container = document.createElement('div');
    container.innerHTML = '<pre><code class="hljs language-javascript">const x = 1;</code></pre>';
    const extractor = new CodeBlockExtractor(new GenericParser());
    const blocks = extractor.extractAll(container);
    expect(blocks[0].language).toBe('javascript');
  });
});
