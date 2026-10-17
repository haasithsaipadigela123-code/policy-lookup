/**
 * Automated Test Suite for Policy Matching Engine
 * 
 * Verifies:
 * 1. Exact keyword matches
 * 2. Synonym matches
 * 3. Different problem wording
 * 4. Unrelated tickets (No Policy Found)
 * 5. Empty ticket descriptions
 * 6. Completely empty tickets (No Policy Found)
 * 7. Ambiguous tickets & competing policy matches
 * 8. Missing policy data handling
 * 9. Malformed policy records handling
 * 10. Title vs description weighting verification
 * 11. Suffix stemming / morphological variation
 * 12. Ticket switching simulation
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const PolicyMatcher = require('../extension/matcher');
const TicketExtractor = require('../extension/extractor');

// Load policies.json
const policiesPath = path.join(__dirname, '..', 'extension', 'policies.json');
const policiesData = JSON.parse(fs.readFileSync(policiesPath, 'utf8'));
const policies = policiesData.policies;

console.log('====================================================');
console.log('🧪 RUNNING IT SUPPORT POLICY MATCHER TEST SUITE');
console.log(`Loaded ${policies.length} policies from policies.json`);
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } catch (err) {
    console.error(`  ❌ FAIL: ${testName}`);
    console.error(`     Reason: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 3).join('\n'));
    }
  }
}

// ----------------------------------------------------
// TEST GROUP 1: EXACT KEYWORD MATCHES
// ----------------------------------------------------
console.log('--- Test Group 1: Exact Keyword Matches ---');

runTest('Matches Password Reset policy on explicit keyword match', () => {
  const ticket = {
    title: 'Password reset request for user account',
    description: 'User forgot domain password and needs self-service password reset link.'
  };
  const result = PolicyMatcher.matchTicket(ticket, policies);
  assert.strictEqual(result.matched, true, 'Should match a policy');
  assert.strictEqual(result.topMatch.id, 'POL-SEC-001', 'Should match POL-SEC-001');
  assert.strictEqual(result.isAmbiguous, false, 'Should be unambiguous');
});

runTest('Matches Printer Problems policy on exact printer keywords', () => {
  const ticket = {
    title: 'Printer paper jam in 3rd floor office',
    description: 'Print queue has 5 jobs stuck and print spooler is failing to print.'
  };
  const result = PolicyMatcher.matchTicket(ticket, policies);
  assert.strictEqual(result.matched, true, 'Should match a policy');
  assert.strictEqual(result.topMatch.id, 'POL-OPS-006', 'Should match POL-OPS-006');
});

runTest('Matches Software Installation policy on explicit deploy keywords', () => {
  const ticket = {
    title: 'Need software installation for developer tools',
    description: 'User requests software install for Docker Desktop, requires admin privileges.'
  };
  const result = PolicyMatcher.matchTicket(ticket, policies);
  assert.strictEqual(result.matched, true, 'Should match a policy');
  assert.strictEqual(result.topMatch.id, 'POL-APP-005', 'Should match POL-APP-005');
});

// ----------------------------------------------------
// TEST GROUP 2: SYNONYM MATCHES
// ----------------------------------------------------
console.log('\n--- Test Group 2: Synonym Matches ---');

runTest('Matches Account Lockout on colloquial synonyms ("frozen account", "exceeded attempts")', () => {
  const ticket = {
    title: 'Sign in blocked after entering wrong codes',
    description: 'My profile is frozen because I exceeded attempts. Please unlock user profile.'
  };
  const result = PolicyMatcher.matchTicket(ticket, policies);
  assert.strictEqual(result.matched, true, 'Should match a policy');
  assert.strictEqual(result.topMatch.id, 'POL-SEC-002', 'Should match POL-SEC-002');
});

runTest('Matches Password Reset on synonym phrases ("login secret", "passcode")', () => {
  const ticket = {
    title: 'Need to reset login secret passcode',
    description: 'User cannot remember their secret sign in code for portal authentication.'
  };
  const result = PolicyMatcher.matchTicket(ticket, policies);
  assert.strictEqual(result.matched, true, 'Should match a policy');
  assert.strictEqual(result.topMatch.id, 'POL-SEC-001', 'Should match POL-SEC-001');
});

// ----------------------------------------------------
// TEST GROUP 3: DIFFERENT PROBLEM WORDING
// ----------------------------------------------------
console.log('\n--- Test Group 3: Different Problem Wording ---');

runTest('Matches Hardware Malfunction on BSOD and crash dump description', () => {
  const ticket = {
    title: 'Machine crashing with blue screen',
    description: 'Dell workstation rebooted with BSOD crash dump and fan is loud, laptop is overheating.'
  };
  const result = PolicyMatcher.matchTicket(ticket, policies);
  assert.strictEqual(result.matched, true, 'Should match a policy');
  assert.strictEqual(result.topMatch.id, 'POL-OPS-009', 'Should match POL-OPS-009');
});

runTest('Matches Data Recovery on file loss and accidental deletion phrasing', () => {
  const ticket = {
    title: 'Accidentally deleted project folders from shared drive',
    description: 'Client contracts are missing from network drive. Need file restoration or backup restore.'
  };
  const result = PolicyMatcher.matchTicket(ticket, policies);
  assert.strictEqual(result.matched, true, 'Should match a policy');
  assert.strictEqual(result.topMatch.id, 'POL-OPS-010', 'Should match POL-OPS-010');
});

// ----------------------------------------------------
// TEST GROUP 4: UNRELATED TICKETS (NO POLICY FOUND)
// ----------------------------------------------------
console.log('\n--- Test Group 4: Unrelated Tickets ---');

runTest('Returns NO_POLICY_FOUND for catering order ticket', () => {
  const ticket = {
    title: 'Catering order for Friday team lunch',
    description: 'Ordering sandwiches for all-hands meeting in auditorium. Need budget code approval.'
  };
  const result = PolicyMatcher.matchTicket(ticket, policies);
  assert.strictEqual(result.matched, false, 'Should not match any policy');
  assert.strictEqual(result.status, 'NO_POLICY_FOUND');
  assert.strictEqual(result.message, 'No sufficiently relevant policy was identified for this ticket.');
});

runTest('Returns NO_POLICY_FOUND for facilities plant maintenance ticket', () => {
  const ticket = {
    title: 'Watering plants on 4th floor reception',
    description: 'Facilities maintenance routine check for decorative plants and desk supplies.'
  };
  const result = PolicyMatcher.matchTicket(ticket, policies);
  assert.strictEqual(result.matched, false, 'Should not match any policy');
  assert.strictEqual(result.status, 'NO_POLICY_FOUND');
});

// ----------------------------------------------------
// TEST GROUP 5: EMPTY & INSUFFICIENT TICKETS
// ----------------------------------------------------
console.log('\n--- Test Group 5: Empty & Partial Inputs ---');

runTest('Returns NO_POLICY_FOUND when ticket description is empty and title is generic', () => {
  const ticket = {
    title: 'Help urgent',
    description: ''
  };
  const result = PolicyMatcher.matchTicket(ticket, policies);
  assert.strictEqual(result.matched, false, 'Should not match generic empty ticket');
  assert.strictEqual(result.status, 'NO_POLICY_FOUND');
});

runTest('Returns NO_POLICY_FOUND when both title and description are empty strings', () => {
  const ticket = {
    title: '   ',
    description: '   '
  };
  const result = PolicyMatcher.matchTicket(ticket, policies);
  assert.strictEqual(result.matched, false, 'Should not match blank ticket');
  assert.strictEqual(result.status, 'NO_POLICY_FOUND');
  assert.strictEqual(result.topMatch, null);
});

runTest('Handles null or undefined ticket input gracefully', () => {
  const resultNull = PolicyMatcher.matchTicket(null, policies);
  assert.strictEqual(resultNull.matched, false);
  assert.strictEqual(resultNull.status, 'NO_POLICY_FOUND');

  const resultUndef = PolicyMatcher.matchTicket(undefined, policies);
  assert.strictEqual(resultUndef.matched, false);
  assert.strictEqual(resultUndef.status, 'NO_POLICY_FOUND');
});

// ----------------------------------------------------
// TEST GROUP 6: AMBIGUOUS & COMPETING MATCHES
// ----------------------------------------------------
console.log('\n--- Test Group 6: Ambiguous & Competing Matches ---');

runTest('Detects ambiguity when ticket strongly matches multiple policies', () => {
  const ambiguousTicket = {
    title: 'VPN connection failed - account locked out',
    description: 'Unable to connect to the remote VPN gateway. The client reports that my domain account is locked out after failed attempts. Need assistance with VPN access or unlocking account.'
  };
  const result = PolicyMatcher.matchTicket(ambiguousTicket, policies);
  assert.strictEqual(result.matched, true, 'Should find candidate match');
  assert.strictEqual(result.isAmbiguous, true, 'Should detect ambiguity flag');
  assert.ok(result.runnerUp, 'Should provide runner-up policy candidate');
  assert.ok(result.ambiguityWarning.includes('Ambiguous Match'), 'Should include ambiguity warning');
});

// ----------------------------------------------------
// TEST GROUP 7: MISSING & MALFORMED POLICY DATA
// ----------------------------------------------------
console.log('\n--- Test Group 7: Missing & Malformed Policy Data ---');

runTest('Handles empty or null policies array without throwing', () => {
  const ticket = { title: 'Password reset', description: 'Need reset' };
  
  const resultEmpty = PolicyMatcher.matchTicket(ticket, []);
  assert.strictEqual(resultEmpty.status, 'NO_POLICY_FOUND');
  
  const resultNull = PolicyMatcher.matchTicket(ticket, null);
  assert.strictEqual(resultNull.status, 'NO_POLICY_FOUND');
});

runTest('Handles malformed policy objects missing keywords, synonyms, or id', () => {
  const ticket = { title: 'Password reset', description: 'Need reset' };
  const malformedPolicies = [
    null,
    {},
    { id: 'MAL-1' }, // Missing keywords/synonyms/name
    { id: 'MAL-2', name: 'Broken', keywords: 'not-an-array' },
    { id: 'POL-SEC-001', name: 'Password Reset', keywords: ['password reset'] }
  ];

  const result = PolicyMatcher.matchTicket(ticket, malformedPolicies);
  assert.strictEqual(result.matched, true, 'Should safely match valid policy');
  assert.strictEqual(result.topMatch.id, 'POL-SEC-001');
});

// ----------------------------------------------------
// TEST GROUP 8: SCORING & WEIGHTING BEHAVIOR
// ----------------------------------------------------
console.log('\n--- Test Group 8: Scoring & Weighting Verification ---');

runTest('Weights title matches higher than identical description matches', () => {
  const policy = policies.find(p => p.id === 'POL-NET-007'); // VPN
  
  const ticketWithTitleMatch = {
    title: 'vpn remote access connection',
    description: 'general troubleshooting requested by employee'
  };
  const evalTitle = PolicyMatcher.evaluatePolicyMatch(ticketWithTitleMatch, policy, PolicyMatcher.DEFAULT_CONFIG);

  const ticketWithDescMatch = {
    title: 'general troubleshooting requested by employee',
    description: 'vpn remote access connection'
  };
  const evalDesc = PolicyMatcher.evaluatePolicyMatch(ticketWithDescMatch, policy, PolicyMatcher.DEFAULT_CONFIG);

  assert.ok(evalTitle.score > evalDesc.score, 
    `Title score (${evalTitle.score}) should exceed description score (${evalDesc.score})`);
});

runTest('Basic stemmer handles morphological plurals and gerunds', () => {
  assert.strictEqual(PolicyMatcher.stemWord('printers'), 'printer');
  assert.strictEqual(PolicyMatcher.stemWord('printing'), 'print');
  assert.strictEqual(PolicyMatcher.stemWord('locked'), 'lock');
  assert.strictEqual(PolicyMatcher.stemWord('passwords'), 'password');
});

// ----------------------------------------------------
// TEST GROUP 9: TICKET SWITCHING SIMULATION
// ----------------------------------------------------
console.log('\n--- Test Group 9: Ticket Switching Simulation ---');

runTest('Simulates switching rapidly between 5 distinct tickets', () => {
  const testSequence = [
    { 
      ticket: { title: 'Password Reset Request', description: 'User forgot password and needs reset' }, 
      expectedId: 'POL-SEC-001' 
    },
    { 
      ticket: { title: 'Office printer paper jam', description: 'Document stuck in queue and print spooler failed' }, 
      expectedId: 'POL-OPS-006' 
    },
    { 
      ticket: { title: 'Cannot connect to VPN from home', description: 'Remote access VPN gateway timed out' }, 
      expectedId: 'POL-NET-007' 
    },
    { 
      ticket: { title: 'Catering order for team lunch', description: 'Ordering sandwiches for Friday meeting' }, 
      expectedId: null 
    },
    { 
      ticket: { title: 'Accidentally deleted client folder', description: 'Need file recovery and backup restore' }, 
      expectedId: 'POL-OPS-010' 
    }
  ];

  testSequence.forEach((step, idx) => {
    const res = PolicyMatcher.matchTicket(step.ticket, policies);
    if (step.expectedId) {
      assert.strictEqual(res.matched, true, `Step ${idx} should match`);
      assert.strictEqual(res.topMatch.id, step.expectedId, `Step ${idx} should match ${step.expectedId}`);
    } else {
      assert.strictEqual(res.matched, false, `Step ${idx} should not match`);
    }
  });
});

// ----------------------------------------------------
// TEST GROUP 10: TICKET EXTRACTOR & PLATFORM ADAPTERS
// ----------------------------------------------------
console.log('\n--- Test Group 10: Ticket Extractor & Platform Adapters ---');

function createMockDoc(elementsMap) {
  return {
    querySelector: (selector) => {
      const match = elementsMap[selector];
      if (!match) return null;
      return {
        tagName: match.tagName || 'DIV',
        value: match.value || '',
        innerText: match.text || match.value || '',
        textContent: match.text || match.value || ''
      };
    }
  };
}

runTest('Extracts ticket from Jira DOM structure', () => {
  const engine = new TicketExtractor.TicketExtractorEngine();
  const mockJiraDoc = createMockDoc({
    '[data-testid="issue.views.issue-base.foundation.breadcrumbs.breadcrumb-current-issue-container"]': { text: 'SEC-402' },
    '[data-testid="issue.views.issue-base.foundation.summary.heading"]': { text: 'Password reset request for enterprise account' },
    '[data-testid="issue.views.issue-base.foundation.description"]': { text: 'User forgot domain credentials and needs SSPR password reset.' }
  });

  const outcome = engine.extract(mockJiraDoc, 'https://company.atlassian.net/browse/SEC-402');
  assert.strictEqual(outcome.detected, true);
  assert.strictEqual(outcome.ticket.id, 'SEC-402');
  assert.strictEqual(outcome.ticket.title, 'Password reset request for enterprise account');
  assert.strictEqual(outcome.ticket.platform, 'Jira / Jira Service Management');

  // Verify end-to-end matching on extracted ticket
  const matchResult = PolicyMatcher.matchTicket(outcome.ticket, policies);
  assert.strictEqual(matchResult.matched, true);
  assert.strictEqual(matchResult.topMatch.id, 'POL-SEC-001');
});

runTest('Extracts ticket from ServiceNow DOM structure', () => {
  const engine = new TicketExtractor.TicketExtractorEngine();
  const mockSNDoc = createMockDoc({
    '#incident\\.number': { text: 'INC008912' },
    '#incident\\.short_description': { text: 'Printer paper jam on 4th floor' },
    '#incident\\.description': { text: 'Print spooler service is hung and queue has multiple stuck jobs.' }
  });

  const outcome = engine.extract(mockSNDoc, 'https://corporate.service-now.com/nav_to.do');
  assert.strictEqual(outcome.detected, true);
  assert.strictEqual(outcome.ticket.id, 'INC008912');
  assert.strictEqual(outcome.ticket.title, 'Printer paper jam on 4th floor');

  // Verify end-to-end matching on extracted ticket
  const matchResult = PolicyMatcher.matchTicket(outcome.ticket, policies);
  assert.strictEqual(matchResult.matched, true);
  assert.strictEqual(matchResult.topMatch.id, 'POL-OPS-006');
});

runTest('Extracts ticket from HESK Help Desk modern DOM structure', () => {
  const engine = new TicketExtractor.TicketExtractorEngine();
  const mockHeskDoc = createMockDoc({
    '.ticket-headline': { text: 'Sign-in blocked after bad passcode attempts' },
    '.ticketmessage': { text: 'I entered the wrong password 6 times and my profile is frozen. Account has been locked out.' }
  });

  const outcome = engine.extract(mockHeskDoc, 'https://helpdesk.company.com/ticket.php?track=ABC-123-DEF');
  assert.strictEqual(outcome.detected, true);
  assert.strictEqual(outcome.ticket.id, 'ABC-123-DEF');
  assert.strictEqual(outcome.ticket.title, 'Sign-in blocked after bad passcode attempts');
  assert.strictEqual(outcome.ticket.platform, 'HESK Help Desk');

  // Verify end-to-end matching on extracted ticket
  const matchResult = PolicyMatcher.matchTicket(outcome.ticket, policies);
  assert.strictEqual(matchResult.matched, true);
  assert.strictEqual(matchResult.topMatch.id, 'POL-SEC-002');
});

runTest('Extracts ticket from HESK Help Desk admin view with URL tracking ID', () => {
  const engine = new TicketExtractor.TicketExtractorEngine();
  const mockHeskAdminDoc = createMockDoc({
    '.ticket-subject': { text: 'Cannot connect to VPN from home office' },
    'td.ticketmessage': { text: 'Gateway timeout when attempting to establish remote access VPN tunnel.' }
  });

  const outcome = engine.extract(mockHeskAdminDoc, 'https://helpdesk.company.com/admin_ticket.php?track=VPN-999');
  assert.strictEqual(outcome.detected, true);
  assert.strictEqual(outcome.ticket.id, 'VPN-999');
  assert.strictEqual(outcome.ticket.title, 'Cannot connect to VPN from home office');

  // Verify end-to-end matching on extracted ticket
  const matchResult = PolicyMatcher.matchTicket(outcome.ticket, policies);
  assert.strictEqual(matchResult.matched, true);
  assert.strictEqual(matchResult.topMatch.id, 'POL-NET-007');
});

runTest('Extracts ticket using Custom Configured Selectors', () => {
  const engine = new TicketExtractor.TicketExtractorEngine();
  engine.setCustomConfig({
    domain: 'custom-internal-helpdesk.local',
    idSelector: '#custom_id',
    titleSelector: '.client-subject-line',
    descSelector: '#ticket_body_text'
  });

  const mockCustomDoc = createMockDoc({
    '#custom_id': { text: 'TCK-CUSTOM-99' },
    '.client-subject-line': { text: 'Cannot connect to remote VPN from home' },
    '#ticket_body_text': { text: 'Remote access VPN gateway timed out during connection.' }
  });

  const outcome = engine.extract(mockCustomDoc, 'https://custom-internal-helpdesk.local/view/99');
  assert.strictEqual(outcome.detected, true);
  assert.strictEqual(outcome.ticket.id, 'TCK-CUSTOM-99');
  assert.strictEqual(outcome.ticket.title, 'Cannot connect to remote VPN from home');

  // Verify end-to-end matching on extracted ticket
  const matchResult = PolicyMatcher.matchTicket(outcome.ticket, policies);
  assert.strictEqual(matchResult.matched, true);
  assert.strictEqual(matchResult.topMatch.id, 'POL-NET-007');
});

runTest('Returns detected: false when page has no recognized ticket elements', () => {
  const engine = new TicketExtractor.TicketExtractorEngine();
  const mockBlankDoc = createMockDoc({});

  const outcome = engine.extract(mockBlankDoc, 'https://example.com/unrelated-page');
  assert.strictEqual(outcome.detected, false);
  assert.strictEqual(outcome.reason, 'UNSUPPORTED_OR_EMPTY');
});

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests/totalTests)*100)}%)`);
console.log('====================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
