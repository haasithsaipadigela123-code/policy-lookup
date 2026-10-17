const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

console.log('Running bookmarklet test suite...\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

// 1. File existence & Chrome URL character length
test('Bookmarklet files exist and are non-empty', () => {
  const bmPath = path.join(__dirname, '..', 'bookmarklet', 'bookmarklet.js');
  const minPath = path.join(__dirname, '..', 'bookmarklet', 'bookmarklet.min.js');
  const urlPath = path.join(__dirname, '..', 'bookmarklet', 'bookmarklet-url.txt');

  assert.ok(fs.existsSync(bmPath), 'bookmarklet.js should exist');
  assert.ok(fs.existsSync(minPath), 'bookmarklet.min.js should exist');
  assert.ok(fs.existsSync(urlPath), 'bookmarklet-url.txt should exist');

  const raw = fs.readFileSync(bmPath, 'utf8');
  assert.ok(raw.length > 5000, 'Source code should be substantial');
});

test('Bookmarklet URL is within Chrome 32,768 character limit', () => {
  const urlPath = path.join(__dirname, '..', 'bookmarklet', 'bookmarklet-url.txt');
  const content = fs.readFileSync(urlPath, 'utf8').trim();
  assert.ok(content.startsWith('javascript:'), 'Must start with javascript:');
  assert.ok(content.length <= 32768, `Length ${content.length} exceeds 32,768 limit`);
});

// 2. Syntax validation
test('Bookmarklet code is valid JavaScript', () => {
  const bmPath = path.join(__dirname, '..', 'bookmarklet', 'bookmarklet.js');
  const code = fs.readFileSync(bmPath, 'utf8');
  assert.doesNotThrow(() => {
    new vm.Script(code);
  }, 'Should parse without syntax errors');
});

test('Minified bookmarklet is valid JavaScript', () => {
  const minPath = path.join(__dirname, '..', 'bookmarklet', 'bookmarklet.min.js');
  const code = fs.readFileSync(minPath, 'utf8');
  assert.doesNotThrow(() => {
    new vm.Script(code);
  }, 'Minified code should parse without syntax errors');
});

// 3. Execution simulation in mock DOM environment
test('Bookmarklet creates shadow DOM host and panel', () => {
  const bmPath = path.join(__dirname, '..', 'bookmarklet', 'bookmarklet.js');
  const code = fs.readFileSync(bmPath, 'utf8');

  // Simple mock DOM environment
  const elements = [];
  const mockShadow = {
    children: [],
    appendChild(child) { this.children.push(child); return child; },
    getElementById(id) {
      function find(node) {
        if (!node) return null;
        if (node.id === id) return node;
        if (node.children) {
          for (const c of node.children) {
            const found = find(c);
            if (found) return found;
          }
        }
        return null;
      }
      for (const c of this.children) {
        const found = find(c);
        if (found) return found;
      }
      return { addEventListener() {}, set textContent(v) {}, style: {} };
    },
    querySelectorAll() { return []; }
  };

  const mockHost = {
    id: 'policy-bookmarklet-host',
    style: {},
    attachShadow() { return mockShadow; },
    remove() {}
  };

  const mockDoc = {
    getElementById(id) {
      return id === 'policy-bookmarklet-host' ? null : null;
    },
    createElement(tag) {
      if (tag === 'div') return { ...mockHost };
      return { style: {}, appendChild() {}, addEventListener() {} };
    },
    body: {
      appendChild(node) { elements.push(node); }
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {}
  };

  const mockWindow = {
    location: { href: 'https://helpdesk.company.com/ticket/1234', hostname: 'helpdesk.company.com' },
    document: mockDoc,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
  };

  const sandbox = {
    window: mockWindow,
    document: mockDoc,
    localStorage: mockWindow.localStorage,
    console
  };

  vm.createContext(sandbox);
  assert.doesNotThrow(() => {
    vm.runInContext(code, sandbox);
  });

  assert.ok(elements.length > 0, 'Should have attached host element to document body');
});

console.log(`\nResults: ${passedTests} / ${totalTests} passed.\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
