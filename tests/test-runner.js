(function () {
  'use strict';

  const tests = [];
  let currentDescribe = null;
  const results = { total: 0, passed: 0, failed: 0, errors: [] };

  function describe(name, fn) {
    currentDescribe = name;
    fn();
    currentDescribe = null;
  }

  function it(name, fn) {
    tests.push({
      name: currentDescribe ? `${currentDescribe} › ${name}` : name,
      fn
    });
  }

  function expect(value) {
    return {
      toBe(expected) {
        if (value !== expected) {
          throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(value)}`);
        }
      },
      toEqual(expected) {
        if (JSON.stringify(value) !== JSON.stringify(expected)) {
          throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(value)}`);
        }
      },
      toContain(item) {
        if (!value.includes(item)) {
          throw new Error(`Expected ${JSON.stringify(value)} to contain ${JSON.stringify(item)}`);
        }
      },
      toHaveLength(n) {
        if (value.length !== n) {
          throw new Error(`Expected length ${n} but got ${value.length}`);
        }
      },
      toBeTruthy() {
        if (!value) {
          throw new Error(`Expected truthy value but got ${JSON.stringify(value)}`);
        }
      },
      toBeFalsy() {
        if (value) {
          throw new Error(`Expected falsy value but got ${JSON.stringify(value)}`);
        }
      },
      toBeNull() {
        if (value !== null) {
          throw new Error(`Expected null but got ${JSON.stringify(value)}`);
        }
      },
      toBeGreaterThan(n) {
        if (!(value > n)) {
          throw new Error(`Expected ${value} to be greater than ${n}`);
        }
      },
      toBeLessThan(n) {
        if (!(value < n)) {
          throw new Error(`Expected ${value} to be less than ${n}`);
        }
      },
      toMatch(regex) {
        if (!regex.test(value)) {
          throw new Error(`Expected ${JSON.stringify(value)} to match ${regex}`);
        }
      },
      toBeInstanceOf(Constructor) {
        if (!(value instanceof Constructor)) {
          throw new Error(`Expected instance of ${Constructor.name} but got ${value?.constructor?.name}`);
        }
      },
      toHaveProperty(key, expectedValue) {
        if (!(key in value)) {
          throw new Error(`Expected object to have property "${key}"`);
        }
        if (expectedValue !== undefined && value[key] !== expectedValue) {
          throw new Error(`Expected property "${key}" to be ${JSON.stringify(expectedValue)} but got ${JSON.stringify(value[key])}`);
        }
      }
    };
  }

  async function runAll() {
    results.total = 0;
    results.passed = 0;
    results.failed = 0;
    results.errors = [];

    const output = document.getElementById('test-output');
    if (output) output.innerHTML = '';

    for (const test of tests) {
      results.total++;
      try {
        await test.fn();
        results.passed++;
        logResult(test.name, 'PASS');
      } catch (error) {
        results.failed++;
        results.errors.push({ name: test.name, error: error.message });
        logResult(test.name, 'FAIL', error.message);
      }
    }

    logSummary();
    return results;
  }

  function logResult(name, status, error = null) {
    const output = document.getElementById('test-output');
    if (!output) return;

    const div = document.createElement('div');
    div.className = `test-result test-${status.toLowerCase()}`;
    div.innerHTML = `
      <span class="test-status">${status === 'PASS' ? '✅' : '❌'}</span>
      <span class="test-name">${escapeHtml(name)}</span>
      ${error ? `<span class="test-error">${escapeHtml(error)}</span>` : ''}
    `;
    output.appendChild(div);
  }

  function logSummary() {
    const summary = document.getElementById('test-summary');
    if (!summary) return;

    const icon = results.failed === 0 ? '✅' : '❌';
    summary.innerHTML = `
      <span class="summary-icon">${icon}</span>
      <span>${results.passed}/${results.total} tests passed</span>
      ${results.failed > 0 ? `<span class="summary-failed"> (${results.failed} failed)</span>` : ''}
    `;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  window.TestRunner = { describe, it, expect, runAll, results };
})();
