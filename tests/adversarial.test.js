const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DocxTableParser = require('../scripts/docx-table-parser');
const PolicyMatcher = require('../extension/matcher');

console.log('====================================================');
console.log('🧪 RUNNING ADVERSARIAL & END-TO-END BOOKMARKLET TESTS');
console.log('====================================================\n');

let totalTests = 0;
let passedTests = 0;

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

// Helper to create mock DOM sandbox for executing bookmarklet code
function createMockDomSandbox(options = {}) {
  const elements = [];
  const queryMap = options.queryMap || {};
  const url = options.url || 'https://helpdesk.company.com/ticket.php?track=TCK-1001';

  const elementsById = {};
  function createDomElement(tag) {
    return {
      tagName: (tag || 'DIV').toUpperCase(),
      style: {},
      children: [],
      appendChild(child) { this.children.push(child); return child; },
      addEventListener(evt, cb) { this['on' + evt] = cb; },
      click() { if (this['onclick']) this['onclick'](); },
      _innerHTML: '',
      set innerHTML(v) { this._innerHTML = v; },
      get innerHTML() { return this._innerHTML; },
      _textContent: '',
      set textContent(v) { this._textContent = v; },
      get textContent() { return this._textContent; },
      querySelector() { return null; }
    };
  }

  const mockShadow = {
    children: [],
    appendChild(child) {
      this.children.push(child);
      if (child.id) elementsById[child.id] = child;
      return child;
    },
    getElementById(id) {
      if (elementsById[id]) return elementsById[id];
      const el = createDomElement('div');
      el.id = id;
      elementsById[id] = el;
      return el;
    },
    querySelectorAll(selector) {
      return [];
    }
  };

  const mockDoc = {
    getElementById(id) {
      if (id === 'policy-bookmarklet-host') {
        return elements.find(e => e.id === 'policy-bookmarklet-host') || null;
      }
      return null;
    },
    createElement(tag) {
      const el = createDomElement(tag);
      if (tag === 'div' && !elements.some(e => e.id === 'policy-bookmarklet-host')) {
        el.id = 'policy-bookmarklet-host';
        el.attachShadow = () => mockShadow;
        el.remove = () => {
          const idx = elements.indexOf(el);
          if (idx !== -1) elements.splice(idx, 1);
        };
      }
      return el;
    },
    body: {
      appendChild(node) { elements.push(node); }
    },
    querySelector(selector) {
      const sNorm = selector.replace(/\\/g, '');
      for (const [k, v] of Object.entries(queryMap)) {
        const parts = k.split(',').map(s => s.trim().replace(/\\/g, ''));
        if (parts.includes(sNorm)) {
          return { tagName: 'DIV', innerText: v, textContent: v, value: v };
        }
      }
      return null;
    },
    querySelectorAll(selector) {
      const sNorm = selector.replace(/\\/g, '');
      const matched = [];
      for (const [k, v] of Object.entries(queryMap)) {
        const parts = k.split(',').map(s => s.trim().replace(/\\/g, ''));
        if (parts.some(p => p.includes(sNorm) || sNorm.includes(p))) {
          matched.push({ tagName: 'DIV', innerText: v, textContent: v, value: v, closest() { return null; } });
        }
      }
      return matched;
    },
    addEventListener() {},
    removeEventListener() {}
  };

  const mockLocalStorage = {
    _store: options.localStorage || {},
    getItem(k) { return this._store[k] || null; },
    setItem(k, v) { this._store[k] = String(v); },
    removeItem(k) { delete this._store[k]; }
  };

  const sandbox = {
    window: {
      location: { href: url, toLowerCase() { return url.toLowerCase(); } },
      document: mockDoc,
      localStorage: mockLocalStorage
    },
    document: mockDoc,
    localStorage: mockLocalStorage,
    console: { log() {}, warn() {}, error() {} }
  };

  vm.createContext(sandbox);

  return { sandbox, elements, mockShadow };
}

(async () => {
// ----------------------------------------------------
// Test Group 1: End-to-End DOCX Import to Bookmarklet URL
// ----------------------------------------------------
console.log('--- Test Group 1: End-to-End DOCX Import to Bookmarklet URL ---');

await test('Parses Word document (.docx) and embeds policies into Bookmarklet URL', async () => {
  const docxPath = path.join(__dirname, 'sample-policies.docx');
  const buffer = fs.readFileSync(docxPath);
  const result = await DocxTableParser.parseDocxTables(buffer, { filename: 'sample-policies.docx' });

  assert.ok(result.policies.length >= 5, 'Should extract at least 5 policies from sample docx');
  assert.ok(result.policies.some(p => p.id === 'POL-SEC-001'), 'Must include POL-SEC-001');

  // Embed into bookmarklet url
  const baseCode = fs.readFileSync(path.join(__dirname, '..', 'bookmarklet', 'bookmarklet-url.txt'), 'utf8');
  const jsonStr = JSON.stringify(result.policies);
  const customCode = baseCode.replace(
    /DEFAULT_SAMPLE_POLICIES=\[[\s\S]*?\];function getActivePolicies/,
    'DEFAULT_SAMPLE_POLICIES=' + jsonStr + ';function getActivePolicies'
  );

  assert.ok(customCode.startsWith('javascript:'), 'Compiled bookmarklet must start with javascript:');
  assert.ok(customCode.includes('POL-SEC-001'), 'Must contain embedded policy ID');
  assert.doesNotThrow(() => {
    new vm.Script(customCode.replace(/^javascript:/, ''));
  }, 'Custom bookmarklet must be syntax-valid JavaScript');
});

await test('Handles merged-cell and continuation-row edge-case DOCX document', async () => {
  const edgeDocxPath = path.join(__dirname, 'edge-case-policies.docx');
  const buffer = fs.readFileSync(edgeDocxPath);
  const result = await DocxTableParser.parseDocxTables(buffer, { filename: 'edge-case-policies.docx' });

  assert.ok(result.policies.length > 0, 'Should extract policies from edge-case document');
  const edgePolicy = result.policies.find(p => p.id === 'POL-EDGE-001');
  assert.ok(edgePolicy, 'Should extract edge policy');
  assert.ok(edgePolicy.resolution.length > 0, 'Resolution should be preserved');
});

// ----------------------------------------------------
// Test Group 2: Bookmarklet Execution on Distinct Ticket Websites
// ----------------------------------------------------
console.log('\n--- Test Group 2: Bookmarklet Execution on Distinct Ticket Websites ---');

await test('Executes bookmarklet on HESK Help Desk ticket page and renders MATCH_FOUND', () => {
  const bmUrl = fs.readFileSync(path.join(__dirname, '..', 'bookmarklet', 'bookmarklet-url.txt'), 'utf8');
  const scriptBody = bmUrl.replace(/^javascript:/, '');

  const { sandbox, elements, mockShadow } = createMockDomSandbox({
    url: 'https://hesk.company.com/admin_ticket.php?track=TCK-9901',
    queryMap: {
      '.ticket-headline, h2.ticket-headline': 'User cannot log in after password expired',
      '.ticketmessage, td.ticketmessage': 'Domain credentials expired yesterday. Need help resetting Active Directory account password.'
    }
  });

  vm.runInContext(scriptBody, sandbox);

  assert.strictEqual(elements.length, 1, 'Should attach bookmarklet overlay to body');
  const resContainer = mockShadow.getElementById('results-container');
  assert.ok(resContainer.innerHTML.includes('POL-SEC-001'), 'Results should show POL-SEC-001');
  assert.ok(resContainer.innerHTML.includes('Password Reset'), 'Results should show policy name');
  assert.ok(resContainer.innerHTML.includes('Approved Resolution'), 'Results should show approved resolution');
});

await test('Executes bookmarklet on ServiceNow incident page and renders MATCH_FOUND', () => {
  const bmUrl = fs.readFileSync(path.join(__dirname, '..', 'bookmarklet', 'bookmarklet-url.txt'), 'utf8');
  const scriptBody = bmUrl.replace(/^javascript:/, '');

  const { sandbox, mockShadow } = createMockDomSandbox({
    url: 'https://company.service-now.com/nav_to.do?uri=incident.do?sys_id=123',
    queryMap: {
      '#incident\\.short_description, input[name="incident.short_description"]': 'Account locked out after failed logons',
      '#incident\\.description, textarea[name="incident.description"]': 'User exceeded maximum failed attempts in Active Directory domain controller.'
    }
  });

  vm.runInContext(scriptBody, sandbox);
  const resContainer = mockShadow.getElementById('results-container');
  assert.ok(resContainer.innerHTML.includes('POL-SEC-002'), 'Results should show POL-SEC-002 Account Lockout');
});

await test('Executes bookmarklet on Jira issue page and renders MATCH_FOUND', () => {
  const bmUrl = fs.readFileSync(path.join(__dirname, '..', 'bookmarklet', 'bookmarklet-url.txt'), 'utf8');
  const scriptBody = bmUrl.replace(/^javascript:/, '');

  const { sandbox, mockShadow } = createMockDomSandbox({
    url: 'https://company.atlassian.net/browse/IT-5421',
    queryMap: {
      '#summary-val, [data-test-id*="summary"]': 'Network printer offline on floor 3',
      '#description-val, [data-test-id*="description"]': 'Paper jam in tray 2 and print spooler service stuck.'
    }
  });

  vm.runInContext(scriptBody, sandbox);
  const resContainer = mockShadow.getElementById('results-container');
  assert.ok(resContainer.innerHTML.includes('POL-OPS-006'), 'Results should show POL-OPS-006 Printer Maintenance');
});

// ----------------------------------------------------
// Test Group 3: Exceptions, Contradictions & Negative Cases
// ----------------------------------------------------
console.log('\n--- Test Group 3: Exceptions, Contradictions & Negative Cases ---');

await test('Renders prominent Exception Condition Warning when ticket triggers policy exception', () => {
  const bmUrl = fs.readFileSync(path.join(__dirname, '..', 'bookmarklet', 'bookmarklet-url.txt'), 'utf8');
  const scriptBody = bmUrl.replace(/^javascript:/, '');

  const { sandbox, mockShadow } = createMockDomSandbox({
    url: 'https://hesk.company.com/ticket.php?track=VPN-992',
    queryMap: {
      '.ticket-headline': 'Third-party contractor remote connection',
      '.ticketmessage': 'External contractor needs VPN connection restored for GlobalProtect.'
    }
  });

  vm.runInContext(scriptBody, sandbox);
  const resContainer = mockShadow.getElementById('results-container');
  assert.ok(resContainer.innerHTML.includes('POL-NET-004'), 'Should match VPN policy');
  assert.ok(resContainer.innerHTML.includes('Exception Condition Detected'), 'Must display Exception Alert');
});

await test('Renders MANUAL_REVIEW_REQUIRED when ticket has internal contradiction', () => {
  const bmUrl = fs.readFileSync(path.join(__dirname, '..', 'bookmarklet', 'bookmarklet-url.txt'), 'utf8');
  const scriptBody = bmUrl.replace(/^javascript:/, '');

  const { sandbox, mockShadow } = createMockDomSandbox({
    url: 'https://hesk.company.com/ticket.php?track=CON-12',
    queryMap: {
      '.ticket-headline': 'VPN connection question',
      '.ticketmessage': 'VPN is working fine. Unable to connect to VPN.'
    }
  });

  vm.runInContext(scriptBody, sandbox);
  const resContainer = mockShadow.getElementById('results-container');
  assert.ok(resContainer.innerHTML.includes('MANUAL REVIEW REQUIRED'), 'Must render MANUAL REVIEW REQUIRED banner');
  assert.ok(!resContainer.innerHTML.includes('Approved Resolution'), 'Must not invent an approved resolution');
});

await test('Renders NO_POLICY_FOUND for completely unrelated ticket', () => {
  const bmUrl = fs.readFileSync(path.join(__dirname, '..', 'bookmarklet', 'bookmarklet-url.txt'), 'utf8');
  const scriptBody = bmUrl.replace(/^javascript:/, '');

  const { sandbox, mockShadow } = createMockDomSandbox({
    url: 'https://hesk.company.com/ticket.php?track=CAT-01',
    queryMap: {
      '.ticket-headline': 'Catering order for marketing lunch',
      '.ticketmessage': 'Please order 15 vegetarian sandwiches and coffee for conference room B.'
    }
  });

  vm.runInContext(scriptBody, sandbox);
  const resContainer = mockShadow.getElementById('results-container');
  assert.ok(resContainer.innerHTML.includes('NO POLICY FOUND'), 'Must display NO POLICY FOUND');
});

// ----------------------------------------------------
// Test Group 4: Adversarial Linguistic & State Handling
// ----------------------------------------------------
console.log('\n--- Test Group 4: Adversarial Linguistic & State Handling ---');

await test('Differentiates failure symptoms ("cannot authenticate") from state negation ("not locked")', () => {
  const policies = [
    {
      id: "POL-SEC-002",
      name: "Account Lockout & Brute-Force Remediation",
      keywords: ["account locked", "account lockout", "locked out"],
      synonyms: ["frozen account"]
    }
  ];

  // Case A: Symptom - active failure
  const resA = PolicyMatcher.matchTicket({
    title: 'Cannot authenticate to domain',
    description: 'Account is locked out after failed attempts.'
  }, policies);
  assert.strictEqual(resA.status, 'MATCH_FOUND', 'Active lockout symptom must match');

  // Case B: Explicit state negation - "account is not locked"
  const resB = PolicyMatcher.matchTicket({
    title: 'Sign in question',
    description: 'Account is not locked. User just needs general portal guidance.'
  }, policies);
  assert.strictEqual(resB.status, 'NO_POLICY_FOUND', 'Negated condition must NOT match lockout policy');
});

await test('Suppresses active match when problem was resolved in the past', () => {
  const policies = [
    {
      id: "POL-SEC-002",
      name: "Account Lockout & Brute-Force Remediation",
      keywords: ["account locked", "locked out"]
    }
  ];

  const res = PolicyMatcher.matchTicket({
    title: 'Previous lockout inquiry',
    description: 'Account was locked yesterday but works fine now today.'
  }, policies);

  assert.strictEqual(res.status, 'NO_POLICY_FOUND', 'Historical resolved issue must suppress active match');
});

await test('Handles common IT spelling errors and abbreviations deterministically', () => {
  const policies = [
    {
      id: "POL-SEC-001",
      name: "Password Reset",
      keywords: ["password", "reset password", "sspr"]
    },
    {
      id: "POL-OPS-009",
      name: "BSOD Crash",
      keywords: ["blue screen", "bsod", "kernel panic"]
    }
  ];

  // Misspelling "passwrod" and "sspr"
  const res1 = PolicyMatcher.matchTicket({
    title: 'Need passwrod help',
    description: 'User forgot domain passwrod. Direct to sspr.'
  }, policies);
  assert.strictEqual(res1.status, 'MATCH_FOUND');
  assert.strictEqual(res1.topMatch.id, 'POL-SEC-001');

  // Abbreviation "bsod"
  const res2 = PolicyMatcher.matchTicket({
    title: 'Computer crashed',
    description: 'Machine threw a bsod crash dump this morning.'
  }, policies);
  assert.strictEqual(res2.status, 'MATCH_FOUND');
  assert.strictEqual(res2.topMatch.id, 'POL-OPS-009');
});

// ----------------------------------------------------
// Test Group 5: No Ticket Detected UI
// ----------------------------------------------------
console.log('\n--- Test Group 5: No Ticket Detected UI ---');

await test('Displays "No ticket found" when no ticket is detected on page', async () => {
  const bmUrl = fs.readFileSync(path.join(__dirname, '..', 'bookmarklet', 'bookmarklet-url.txt'), 'utf8');
  const scriptBody = bmUrl.replace(/^javascript:/, '');

  const { sandbox, mockShadow } = createMockDomSandbox({
    url: 'https://blank.page.com',
    queryMap: {}
  });

  vm.runInContext(scriptBody, sandbox);

  const resContainer = mockShadow.getElementById('results-container');
  assert.ok(/no ticket found/i.test(resContainer.innerHTML), 'Must display No ticket found when no ticket detected');
  assert.strictEqual(mockShadow.children.some(c => c.className === 'panel'), false, 'Must not render heavy panel when no ticket is found');
});

// ----------------------------------------------------
// Summary
// ----------------------------------------------------
console.log('\n====================================================');
console.log(`ADVERSARIAL TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests/totalTests)*100)}%)`);
console.log('====================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
})();

