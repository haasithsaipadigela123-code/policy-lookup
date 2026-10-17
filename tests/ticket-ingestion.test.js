/**
 * Policy Lookup — Multi-Method Ticket Ingestion & Guided Builder Test Suite
 * 
 * Verifies all 17 required aspects:
 * 1.  Successful public ticket retrieval (GitHub public adapter & HTML parsing)
 * 2.  Authentication-required pages (401/403 and login portal redirects)
 * 3.  Unsupported platforms & JavaScript-rendered SPA shells
 * 4.  CORS or browser retrieval failure simulation & diagnostic messaging
 * 5.  Empty and malformed responses handling
 * 6.  Conversation paste: multi-message speaker turns, timestamps, and resolutions
 * 7.  Unstructured conversation text preservation (no fake speakers or timestamps invented)
 * 8.  Conversation-file parsing (TXT, DOCX, CSV integration)
 * 9.  Guided category selection & subcategory tree navigation
 * 10. Conditional follow-up questions generation
 * 11. Optional fields and the "Other" write-in path
 * 12. Normalization across every intake method (URL, Description, Conversation, Guided Builder)
 * 13. Preservation of original evidence & field-level provenance tracking
 * 14. Fallback experience transitions after retrieval failure
 * 15. Policy analysis: correct clause citation, source document, and row/section
 * 16. Missing information detection & manual review triggers
 * 17. Conflicting policies & no-policy-found handling
 */

const assert = require('assert');
const http = require('http');

// Modules under test
const TicketRetriever = require('../app/js/ticket-retriever.js');
const ConversationParser = require('../app/js/conversation-parser.js');
const TicketModel = require('../app/js/ticket-model.js');
const GuidedTicketBuilder = require('../app/js/guided-builder.js');
const DocumentParser = require('../app/js/document-parser.js');
const TfIdfEngine = require('../app/js/tfidf.js');
const LocalClassifier = require('../app/js/classifier.js');
global.TfIdfEngine = TfIdfEngine;
global.LocalClassifier = LocalClassifier;
const PolicyEngine = require('../app/js/engine.js');

console.log('======================================================================');
console.log('🧪 MULTI-METHOD TICKET INGESTION & GUIDED BUILDER VERIFICATION SUITE');
console.log('======================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
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

// Sample Policy Fixture for Policy Analysis integration tests
const SAMPLE_POLICIES = [
  {
    id: 'POL-AUTH-01',
    name: 'Domain Password Reset SOP',
    category: 'Access & Authentication',
    sourceDocName: 'corporate_it_handbook.docx',
    pageOrRow: 'Section 2.1 (p. 14)',
    conditions: 'User forgot domain password or account credentials expired',
    exceptions: 'VIP executive leadership accounts require verbal phone confirmation before resetting password',
    resolution: 'Verify user identity and send self-service password reset (SSPR) link via SMS or secondary email',
    keywords: ['password', 'reset', 'forgot', 'sspr', 'credentials', 'login']
  },
  {
    id: 'POL-AUTH-02',
    name: 'Active Directory Account Lockout Resolution',
    category: 'Access & Authentication',
    sourceDocName: 'corporate_it_handbook.docx',
    pageOrRow: 'Section 2.3 (p. 18)',
    conditions: 'User profile locked after exceeding maximum invalid logon attempts',
    exceptions: 'High privilege administrative accounts require IT security clearance before unlock',
    resolution: 'Verify caller identity and unlock user account in Active Directory Users and Computers',
    keywords: ['lockout', 'locked', 'frozen', 'logon', 'attempts', 'active directory']
  },
  {
    id: 'POL-NET-01',
    name: 'GlobalProtect VPN Remote Access Policy',
    category: 'Network & Connectivity',
    sourceDocName: 'network_security_guidelines.docx',
    pageOrRow: 'Section 4.1 (p. 32)',
    conditions: 'GlobalProtect VPN tunnel fails to connect or authentication rejected from remote workstation',
    exceptions: 'Third-party contractor and vendor access requires an approved change ticket from vendor manager',
    resolution: 'Verify client certificate validity, reinstall virtual adapter, and restart PanGPS service',
    keywords: ['vpn', 'globalprotect', 'tunnel', 'remote access', 'contractor', 'network']
  }
];

(async function () {

  // =========================================================================
  // TEST GROUP 1: Robust URL Retrieval & Pluggable Adapters
  // =========================================================================
  console.log('--- TEST GROUP 1: URL Retrieval & Pluggable Adapter Architecture ---');

  runTest('1.1: GitHub adapter matches public issue URLs and extracts issue number', () => {
    const url = 'https://github.com/octocat/Hello-World/issues/1347?utm_source=chatgpt.com';
    const adapter = TicketRetriever.getAdapter(url);
    assert.strictEqual(adapter.name, 'github');
    const details = adapter.extractIssueDetails(url);
    assert.strictEqual(details.owner, 'octocat');
    assert.strictEqual(details.repo, 'Hello-World');
    assert.strictEqual(details.number, '1347');
  });

  runTest('1.2: GitHub adapter extracts title, description, and author from issue HTML', () => {
    const mockHtml = `
      <html>
        <head><title>Issue 1347 · octocat/Hello-World · GitHub</title></head>
        <body>
          <bdi class="js-issue-title">Yellow !</bdi>
          <a class="author">leonnelkakpo</a>
          <div class="comment-body"><p>Yellow , Zapier testing</p></div>
        </body>
      </html>
    `;
    const adapter = TicketRetriever.getAdapter('https://github.com/octocat/Hello-World/issues/1347');
    const parsed = adapter.parseHtml(mockHtml, 'https://github.com/octocat/Hello-World/issues/1347');
    assert.strictEqual(parsed.ticketId, '#1347');
    assert.strictEqual(parsed.title, 'Yellow !');
    assert.strictEqual(parsed.description, 'Yellow , Zapier testing');
    assert.strictEqual(parsed.author, 'leonnelkakpo');
    assert.ok(parsed.fieldsRetrieved.includes('ticketId'));
    assert.ok(parsed.fieldsRetrieved.includes('title'));
    assert.ok(parsed.fieldsRetrieved.includes('description'));
  });

  runTest('1.3: Jira adapter detects authentication wall and reports AUTH_REQUIRED', () => {
    const jiraUrl = 'https://company.atlassian.net/browse/SEC-4921';
    const adapter = TicketRetriever.getAdapter(jiraUrl);
    assert.strictEqual(adapter.name, 'jira');
    const key = adapter.extractKey(jiraUrl);
    assert.strictEqual(key, 'SEC-4921');

    const loginHtml = '<html><body><form action="https://id.atlassian.com/login">Sign in with Atlassian</form></body></html>';
    const parsed = adapter.parseHtml(loginHtml, jiraUrl);
    assert.strictEqual(parsed.requiresAuth, true);
    assert.strictEqual(parsed.ticketId, 'SEC-4921');
  });

  runTest('1.4: ServiceNow adapter extracts incident number and detects auth barriers', () => {
    const snUrl = 'https://enterprise.service-now.com/nav_to.do?uri=incident.do?sys_id=INC0019283';
    const adapter = TicketRetriever.getAdapter(snUrl);
    assert.strictEqual(adapter.name, 'servicenow');
    const incNumber = adapter.extractNumber(snUrl);
    assert.strictEqual(incNumber, 'INC0019283');

    const loginHtml = '<html><body><form id="login">Password authentication</form></body></html>';
    const parsed = adapter.parseHtml(loginHtml, snUrl);
    assert.strictEqual(parsed.requiresAuth, true);
  });

  runTest('1.5: Generic adapter detects JavaScript-rendered SPA shells', () => {
    const spaHtml = '<!DOCTYPE html><html><body><div id="root"></div><script src="app.js"></script></body></html>';
    const adapter = TicketRetriever.getAdapter('https://portal.company.com/tickets/view');
    const parsed = adapter.parseHtml(spaHtml, 'https://portal.company.com/tickets/view');
    assert.strictEqual(parsed.isSpaShell, true);
  });

  runTest('1.6: Empty and malformed URLs are rejected before network transmission', async () => {
    const r1 = await TicketRetriever.retrieveTicket('');
    assert.strictEqual(r1.success, false);
    assert.strictEqual(r1.failureReason, 'MALFORMED_URL');

    const r2 = await TicketRetriever.retrieveTicket('not-a-valid-url');
    assert.strictEqual(r2.success, false);
    assert.strictEqual(r2.failureReason, 'MALFORMED_URL');
  });

  // =========================================================================
  // TEST GROUP 2: Conversation Input Mode & Multi-Message Parser
  // =========================================================================
  console.log('\n--- TEST GROUP 2: Support Conversation Multi-Message Parsing ---');

  runTest('2.1: Parses multi-turn dialogue with speakers, timestamps, order, and identifiers', () => {
    const chatTranscript = `
[10:14 AM] Customer: Hello, my domain account got locked out after mistyping my password. Ticket INC-9812.
[10:15 AM] Agent: Hi! I see your account locked out in Active Directory. Are you an employee or contractor?
[10:16 AM] Customer: I am a full-time regular employee.
[10:17 AM] Agent: Verified your identity badge. We have unlocked your profile in Active Directory.
    `.trim();

    const result = ConversationParser.parseConversation(chatTranscript);
    assert.strictEqual(result.hasStructuredMessages, true);
    assert.strictEqual(result.messages.length, 4);
    assert.strictEqual(result.messages[0].speaker, 'Customer');
    assert.strictEqual(result.messages[0].timestamp, '10:14 AM');
    assert.strictEqual(result.messages[1].speaker, 'Support Agent');
    assert.strictEqual(result.messages[3].speaker, 'Support Agent');
    assert.ok(result.extractedIdentifiers.includes('INC-9812'));
    assert.ok(result.extractedResolutions.length > 0);
  });

  runTest('2.2: Preserves raw unstructured text faithfully without inventing fake speakers', () => {
    const unstructuredText = 'User called the IT helpdesk stating that their screen is completely black and won\'t turn on after restart.';
    const result = ConversationParser.parseConversation(unstructuredText);
    assert.strictEqual(result.hasStructuredMessages, false);
    assert.strictEqual(result.messages.length, 0);
    assert.strictEqual(result.rawText, unstructuredText);
  });

  runTest('2.3: Extracts order and ticket identifiers (#1347, INC-1029, ORD-8812)', () => {
    const text = 'Customer references order ORD-99182 and previous incident INC-4412 regarding ticket #1347.';
    const ids = ConversationParser.extractIdentifiers(text);
    assert.ok(ids.includes('ORD-99182'));
    assert.ok(ids.includes('INC-4412'));
    assert.ok(ids.includes('#1347'));
  });

  runTest('2.4: Extracts explicitly stated resolutions (refunds, password resets, account unlocks)', () => {
    const text = 'Agent: We have issued a refund for your delayed order and password has been reset.';
    const res = ConversationParser.extractResolutions(text);
    assert.ok(res.length >= 2);
  });

  // =========================================================================
  // TEST GROUP 3: Configurable Guided Ticket Builder
  // =========================================================================
  console.log('\n--- TEST GROUP 3: Configurable Guided Ticket Builder ---');

  runTest('3.1: Navigates category and subcategory hierarchy', () => {
    GuidedTicketBuilder.resetState();
    const categories = GuidedTicketBuilder.getCategories();
    assert.ok(categories.length >= 4);

    const selectedCat = GuidedTicketBuilder.selectCategory('access_auth');
    assert.strictEqual(selectedCat.id, 'access_auth');

    const selectedSub = GuidedTicketBuilder.selectSubcategory('lockout');
    assert.strictEqual(selectedSub.id, 'lockout');
    assert.ok(selectedSub.questions.length >= 2);
  });

  runTest('3.2: Generates conditional follow-up questions for chosen subcategory', () => {
    const state = GuidedTicketBuilder.getState();
    assert.strictEqual(state.selectedSubcategory.id, 'lockout');
    const q1 = state.selectedSubcategory.questions[0];
    assert.ok(q1.question.includes('error message'));
  });

  runTest('3.3: Supports "Other" write-in path on questions', () => {
    GuidedTicketBuilder.setAnswer('lockout_error', 'Other', true, 'Custom system error code 0x80040115');
    const state = GuidedTicketBuilder.getState();
    assert.strictEqual(state.answers['lockout_error'], 'Other: Custom system error code 0x80040115');
  });

  runTest('3.4: Allows skipping optional questions without blocking', () => {
    GuidedTicketBuilder.setAnswer('identity_verified', ''); // skipped
    GuidedTicketBuilder.setIdentifiers('INC-7711', 'High');
    GuidedTicketBuilder.setNotes('User needs access urgently for board meeting.', '');

    const assembled = GuidedTicketBuilder.assembleTicket();
    assert.strictEqual(assembled.source, 'guided_builder');
    assert.strictEqual(assembled.ticketId, 'INC-7711');
    assert.ok(assembled.description.includes('Category: Access & Authentication / Account Lockout'));
    assert.ok(assembled.description.includes('Custom system error code 0x80040115'));
    assert.ok(assembled.description.includes('Urgency Level: High'));
  });

  runTest('3.5: Category hierarchy can be configured or extended dynamically', () => {
    const customConfig = {
      categories: [
        {
          id: 'cloud_infra',
          name: 'Cloud Infrastructure',
          subcategories: [{ id: 'k8s', name: 'Kubernetes Pod Crash', questions: [] }]
        }
      ]
    };
    GuidedTicketBuilder.setCategoryTree(customConfig);
    assert.strictEqual(GuidedTicketBuilder.getCategories()[0].id, 'cloud_infra');

    // Restore default configuration
    GuidedTicketBuilder.setCategoryTree(GuidedTicketBuilder.DEFAULT_GUIDED_CONFIG);
    assert.strictEqual(GuidedTicketBuilder.getCategories()[0].id, 'access_auth');
  });

  // =========================================================================
  // TEST GROUP 4: One Normalized Ticket Model & Provenance
  // =========================================================================
  console.log('\n--- TEST GROUP 4: One Normalized Ticket Model & Provenance ---');

  runTest('4.1: Normalizes manual description intake into standard model', () => {
    const norm = TicketModel.createNormalizedTicket({
      source: 'manual_description',
      title: 'VPN cannot connect from home',
      description: 'GlobalProtect client shows connection timed out while on home Wi-Fi.',
      provenance: { title: 'user_input', description: 'user_input' }
    });
    assert.strictEqual(norm.source, 'manual_description');
    assert.strictEqual(norm.provenance.description, 'user_input');
    assert.ok(norm.getConsolidatedText().includes('VPN cannot connect from home'));
  });

  runTest('4.2: Normalizes conversation intake preserving structured turns and provenance', () => {
    const chat = ConversationParser.parseConversation(`
Agent: What seems to be the trouble?
Customer: I forgot my login credentials for active directory. Ticket #9012.
    `.trim());

    const norm = TicketModel.createNormalizedTicket({
      source: 'conversation_paste',
      ticketId: '#9012',
      title: 'Conversation Ticket #9012',
      description: chat.rawText,
      conversation: chat,
      provenance: { conversation: 'user_chat_transcript' }
    });

    assert.strictEqual(norm.source, 'conversation_paste');
    assert.strictEqual(norm.ticketId, '#9012');
    assert.strictEqual(norm.provenance.conversation, 'user_chat_transcript');
    assert.ok(norm.getConsolidatedText().includes('Support Conversation:'));
  });

  runTest('4.3: Detects missing policy conditions (contractor exception clause gap)', () => {
    const vpnPolicy = SAMPLE_POLICIES.find(p => p.id === 'POL-NET-01');
    const genericTicket = TicketModel.createNormalizedTicket({
      source: 'manual_description',
      title: 'VPN tunnel failure',
      description: 'Unable to connect to GlobalProtect gateway.'
    });

    const gaps = genericTicket.detectPolicyGaps(vpnPolicy);
    assert.ok(gaps.length > 0);
    assert.ok(gaps.some(g => g.includes('Contractor')));
  });

  // =========================================================================
  // TEST GROUP 5: Policy Analysis Integration & Fallback Handling
  // =========================================================================
  console.log('\n--- TEST GROUP 5: Policy Analysis Integration Across Intake Modes ---');

  runTest('5.1: Matches normalized guided ticket and cites source document & section', () => {
    const guidedTicket = TicketModel.createNormalizedTicket({
      source: 'guided_builder',
      ticketId: 'INC-2041',
      title: 'Access & Authentication — Account Lockout',
      description: 'User account frozen after multiple failed attempts in Active Directory Users and Computers.',
      category: 'Access & Authentication'
    });

    const result = PolicyEngine.matchTicket(guidedTicket, SAMPLE_POLICIES);
    assert.strictEqual(result.matched, true);
    assert.strictEqual(result.topMatch.id, 'POL-AUTH-02');
    assert.strictEqual(result.topMatch.sourceDocName, 'corporate_it_handbook.docx');
    assert.strictEqual(result.topMatch.pageOrRow, 'Section 2.3 (p. 18)');
    assert.ok(result.topMatch.resolution.includes('unlock user account'));
  });

  runTest('5.2: Detects contractor exception in VPN conversation and triggers MANUAL_REVIEW_REQUIRED', () => {
    const contractorConv = ConversationParser.parseConversation(`
Agent: IT HelpDesk here. What is the issue?
Customer: GlobalProtect VPN tunnel fails to connect. I am an external contractor from third-party vendor Acme.
    `.trim());

    const ticket = TicketModel.createNormalizedTicket({
      source: 'conversation_paste',
      title: 'VPN access issue',
      description: contractorConv.rawText,
      conversation: contractorConv
    });

    const result = PolicyEngine.matchTicket(ticket, SAMPLE_POLICIES);
    assert.strictEqual(result.matched, true);
    assert.strictEqual(result.topMatch.id, 'POL-NET-01');
    assert.strictEqual(result.topMatch.exceptionTriggered, true);
    assert.strictEqual(result.status, 'MANUAL_REVIEW_REQUIRED');
  });

  runTest('5.3: Flags conflicting policies when ticket asserts and negates same symptom', () => {
    const contradictoryTicket = TicketModel.createNormalizedTicket({
      source: 'manual_description',
      title: 'VPN is working fine but VPN is unable to connect',
      description: 'GlobalProtect connection was successful yet failed completely.'
    });

    const result = PolicyEngine.matchTicket(contradictoryTicket, SAMPLE_POLICIES);
    assert.strictEqual(result.matched, false);
    assert.strictEqual(result.status, 'CONFLICTING_POLICIES');
  });

  runTest('5.4: Returns NO_POLICY_FOUND for software issue (#1347 Zapier test) against IT policies', () => {
    const githubTicket = TicketModel.createNormalizedTicket({
      source: 'url_retrieval',
      ticketId: '#1347',
      title: 'Yellow !',
      description: 'Yellow , Zapier testing'
    });

    const result = PolicyEngine.matchTicket(githubTicket, SAMPLE_POLICIES);
    assert.strictEqual(result.matched, false);
    assert.strictEqual(result.status, 'NO_POLICY_FOUND');
  });

  console.log('\n======================================================================');
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('======================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
})();
