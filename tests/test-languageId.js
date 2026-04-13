const { describe, it, expect } = TestRunner;

describe('LanguageIdentifier', () => {
  it('identifies Python from class attribute', () => {
    const identifier = new LanguageIdentifier();
    const container = document.createElement('div');
    container.innerHTML = '<code class="language-python">import os</code>';
    const code = container.querySelector('code');
    const result = identifier.identifyLanguage({ code: code.textContent, language: 'python' });
    expect(result).toBe('python');
  });

  it('normalizes py alias to python', () => {
    const identifier = new LanguageIdentifier();
    const result = identifier.normalizeLanguage('py');
    expect(result).toBe('python');
  });

  it('identifies Python from import statements', () => {
    const identifier = new LanguageIdentifier();
    const result = identifier.detectFromContent('import pandas as pd\nimport numpy as np\ndf = pd.DataFrame()');
    expect(result).toBe('python');
  });

  it('identifies JavaScript from const/let keywords', () => {
    const identifier = new LanguageIdentifier();
    const result = identifier.detectFromContent("const express = require('express');\nconst app = express();");
    expect(result).toBe('javascript');
  });

  it('identifies HTML from DOCTYPE declaration', () => {
    const identifier = new LanguageIdentifier();
    const result = identifier.detectFromContent('<!DOCTYPE html>\n<html>\n<head><title>Test</title></head>\n<body></body>\n</html>');
    expect(result).toBe('html');
  });

  it('identifies CSS from selectors and properties', () => {
    const identifier = new LanguageIdentifier();
    const result = identifier.detectFromContent('.container {\n  display: flex;\n  margin: 0 auto;\n  padding: 20px;\n}');
    expect(result).toBe('css');
  });

  it('identifies Dockerfile from FROM instruction', () => {
    const identifier = new LanguageIdentifier();
    const result = identifier.detectFromContent('FROM python:3.11-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install -r requirements.txt');
    expect(result).toBe('dockerfile');
  });

  it('distinguishes TypeScript from JavaScript', () => {
    const identifier = new LanguageIdentifier();
    const result = identifier.detectFromContent('interface User {\n  name: string;\n  age: number;\n}\nconst user: User = { name: "John", age: 30 };');
    expect(result).toBe('typescript');
  });

  it('returns text for unidentifiable content', () => {
    const identifier = new LanguageIdentifier();
    const result = identifier.detectFromContent('This is just plain text with no code patterns at all.');
    expect(result).toBe('text');
  });

  it('identifies JSON from structure', () => {
    const identifier = new LanguageIdentifier();
    const result = identifier.detectFromContent('{\n  "name": "test",\n  "version": "1.0.0",\n  "dependencies": {}\n}');
    expect(result).toBe('json');
  });

  it('identifies SQL from keywords', () => {
    const identifier = new LanguageIdentifier();
    const result = identifier.detectFromContent('SELECT * FROM users WHERE id = 1;\nINSERT INTO users (name) VALUES ("test");');
    expect(result).toBe('sql');
  });

  it('identifies Bash from shebang', () => {
    const identifier = new LanguageIdentifier();
    const result = identifier.detectFromContent('#!/bin/bash\necho "Hello World"\nexport PATH="/usr/bin:$PATH"');
    expect(result).toBe('bash');
  });
});
