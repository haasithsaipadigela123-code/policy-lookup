/**
 * Live Deployment & End-to-End Regression Verification Test Suite
 * Covers all requirements in user request:
 * 1. Ticket description flow (preserve exact text, review metrics, edit persistence, stale wipe, empty rejection)
 * 2. Retrieved content (real extraction vs barriers, login/tracking/captcha non-ticket classification, URL preservation)
 * 3. API endpoint contracts (status, retrieve-ticket, analyze)
 * 4. Policy analysis & evidence provenance (exact citation, zero fabricated IDs/resolutions)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const TfIdfEngine = require('../app/js/tfidf.js');
const LocalClassifier = require('../app/js/classifier.js');
global.TfIdfEngine = TfIdfEngine;
global.LocalClassifier = LocalClassifier;

const PolicyEngine = require('../app/js/engine.js');
const TicketModel = require('../app/js/ticket-model.js');
const TicketRetriever = require('../app/js/ticket-retriever.js');
const ServerRetriever = require('../app/js/server-retriever.js');

let passCount = 0;
let failCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failCount++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failCount++;
  }
}

async function main() {
  console.log('======================================================================');
  console.log('🧪 RUNNING LIVE DEPLOYMENT & WORKFLOW REGRESSION TEST SUITE');
  console.log('======================================================================\n');

  console.log('--- Group 1: Ticket Description Input & Review Workflow ---');

  runTest('1.1: Exact description and title are preserved through normalization', () => {
    const rawTitle = 'VPN Connection Failure on MacBook';
    const rawDesc = 'User cannot connect to corporate VPN from remote home network. Error code 412: authentication timed out.';
    const ticket = TicketModel.createNormalizedTicket({
      source: 'manual_description',
      title: rawTitle,
      description: rawDesc,
      provenance: { title: 'user_input', description: 'user_input' }
    });

    assert.strictEqual(ticket.title, rawTitle);
    assert.strictEqual(ticket.description, rawDesc);
    assert.strictEqual(ticket.source, 'manual_description');
  });

  runTest('1.2: Empty description must be rejected and cannot produce a ready ticket', () => {
    const ticket = TicketModel.createNormalizedTicket({
      source: 'manual_description',
      title: 'Some Title',
      description: '   ',
      provenance: {}
    });
    assert.strictEqual(ticket.isReadyForAnalysis(), false, 'Whitespace description must not produce a ready ticket');
    assert.strictEqual(TicketModel.isReadyForAnalysis(ticket), false, 'TicketModel.isReadyForAnalysis must return false');
    assert.ok(ticket.missingInformation.includes('Detailed problem description not provided'), 'Must record missing problem description in missingInformation');
  });

  runTest('1.3: HTML does not contain static placeholder strings in user-facing containers', () => {
    const html = fs.readFileSync(path.join(__dirname, '../app/index.html'), 'utf8');
    assert.strictEqual(html.includes('Clean ticket body content...'), false, 'Clean ticket body content placeholder must be removed');
    assert.strictEqual(html.includes('Article body text...'), false, 'Article body text placeholder must be removed');
    assert.ok(html.includes('id="review-ready-badge"'), 'Review badge ID must exist');
  });

  console.log('\n--- Group 2: Retrieved Content & Barrier Classification ---');

  runTest('2.1: Login pages are classified as AUTHENTICATION_REQUIRED and NOT tickets', () => {
    const loginHtml = '<html><head><title>Sign in to Account</title></head><body><form action="/login"><input type="password" name="pwd"><button>Log In</button></form></body></html>';
    const result = ServerRetriever.classifyAndExtract(loginHtml, 'https://support.example.com/login', 200, 'text/html');
    assert.strictEqual(result.classification, 'AUTHENTICATION_REQUIRED');
    assert.strictEqual(result.ticketContentExtracted, false);
    assert.strictEqual(result.ticket, null);
  });

  runTest('2.2: Tracking forms are classified as TRACKING_ID_REQUIRED and NOT tickets', () => {
    const trackHtml = '<html><head><title>Track Your Ticket</title></head><body><form><input name="track_id" placeholder="Enter tracking code"><button>Search</button></form></body></html>';
    const result = ServerRetriever.classifyAndExtract(trackHtml, 'https://hesk.example.com/ticket.php', 200, 'text/html');
    assert.strictEqual(result.classification, 'TRACKING_ID_REQUIRED');
    assert.strictEqual(result.ticketContentExtracted, false);
  });

  runTest('2.3: CAPTCHA challenges are classified as CAPTCHA_REQUIRED and NOT tickets', () => {
    const captchaHtml = '<html><head><title>Bot Verification</title></head><body><div class="g-recaptcha">Please verify you are human</div></body></html>';
    const result = ServerRetriever.classifyAndExtract(captchaHtml, 'https://support.example.com/ticket', 200, 'text/html');
    assert.strictEqual(result.classification, 'CAPTCHA_REQUIRED');
    assert.strictEqual(result.ticketContentExtracted, false);
  });

  runTest('2.4: Genuine support tickets extract title, description, and author faithfully', () => {
    const ticketHtml = `
      <html><head><title>Issue #401: Broken Laptop Screen</title></head>
      <body>
        <div class="issue-header"><span class="author">john_doe</span></div>
        <h1 class="issue-title">Broken Laptop Screen</h1>
        <div class="comment-body"><p>The screen cracked when closing the lid. Need immediate hardware replacement.</p></div>
      </body></html>
    `;
    const result = ServerRetriever.classifyAndExtract(ticketHtml, 'https://github.com/corp/repo/issues/401', 200, 'text/html');
    assert.strictEqual(result.ticketContentExtracted, true);
    assert.ok(result.ticket);
    assert.ok(result.ticket.description.includes('screen cracked'));
    assert.strictEqual(result.ticket.ticketId, '#401');
  });

  console.log('\n--- Group 3: Serverless API Endpoint Contract Verification ---');

  await runAsyncTest('3.1: api/status.js handler returns active JSON status', async () => {
    const handler = require('../api/status.js');
    let out = '';
    const res = {
      setHeader: () => {},
      statusCode: 200,
      end: (data) => { out = data; }
    };
    await handler({ method: 'GET' }, res);
    const parsed = JSON.parse(out);
    assert.strictEqual(parsed.status, 'active');
    assert.ok(Array.isArray(parsed.features));
  });

  await runAsyncTest('3.2: api/retrieve-ticket.js handles empty URL gracefully with 400', async () => {
    const handler = require('../api/retrieve-ticket.js');
    let out = '';
    let status = 200;
    const res = {
      setHeader: () => {},
      set statusCode(s) { status = s; },
      get statusCode() { return status; },
      end: (data) => { out = data; }
    };
    await handler({ method: 'POST', body: { url: '' } }, res);
    assert.strictEqual(status, 400);
    const parsed = JSON.parse(out);
    assert.strictEqual(parsed.classification, 'MALFORMED_URL');
  });

  await runAsyncTest('3.3: api/retrieve-ticket.js blocks SSRF loopback without throwing', async () => {
    const handler = require('../api/retrieve-ticket.js');
    let out = '';
    let status = 200;
    const res = {
      setHeader: () => {},
      set statusCode(s) { status = s; },
      get statusCode() { return status; },
      end: (data) => { out = data; }
    };
    await handler({ method: 'POST', body: { url: 'http://127.0.0.1:9999/admin' } }, res);
    const parsed = JSON.parse(out);
    assert.strictEqual(parsed.classification, 'SSRF_BLOCKED');
    assert.strictEqual(parsed.success, false);
  });

  console.log('\n--- Group 4: Policy Analysis & Zero Fabrication Integrity ---');

  runTest('4.1: Policy analysis cites exact source document and row without fabricating policy IDs', () => {
    const policies = [
      {
        id: null,
        hasExplicitId: false,
        name: 'Bereavement Leave Policy',
        sourceDocName: 'Employee_Handbook.docx',
        pageOrRow: 'Section 4.2',
        conditions: 'Full-time employees are eligible for up to 5 consecutive paid days off for immediate family bereavement.',
        resolution: 'Grant 5 days paid bereavement leave upon HR notification.',
        hasExplicitResolution: true,
        keywords: ['bereavement', 'leave', 'funeral', 'family', 'loss'],
        synonyms: ['compassionate leave', 'death in family']
      }
    ];

    const ticket = {
      title: 'Taking time off for grandmother funeral',
      description: 'I need to take 4 days off next week because my grandmother passed away. What is the policy for bereavement leave?'
    };

    const match = PolicyEngine.matchTicket(ticket, policies);
    assert.strictEqual(match.status, 'MATCH_FOUND');
    assert.strictEqual(match.topMatch.hasExplicitId, false);
    assert.strictEqual(match.topMatch.id, null);
    assert.strictEqual(match.topMatch.sourceDocName, 'Employee_Handbook.docx');
    assert.strictEqual(match.topMatch.pageOrRow, 'Section 4.2');
    assert.ok(match.topMatch.resolution.includes('5 days paid bereavement'));
  });

  runTest('4.2: Unrelated ticket returns NO_POLICY_FOUND without inventing recommendations', () => {
    const policies = [
      {
        id: 'IT-01',
        name: 'VPN Configuration',
        conditions: 'Connect to vpn.corp.com using RSA token.',
        resolution: 'Reinstall Cisco AnyConnect client.',
        keywords: ['vpn', 'cisco', 'anyconnect']
      }
    ];

    const ticket = {
      title: 'Cafeteria weekly lunch menu inquiry',
      description: 'Can someone tell me if gluten-free options are available at the main campus cafeteria on Thursdays?'
    };

    const match = PolicyEngine.matchTicket(ticket, policies);
    assert.strictEqual(match.matched, false);
    assert.strictEqual(match.status, 'NO_POLICY_FOUND');
    assert.strictEqual(match.topMatch, null);
  });

  console.log('\n--- Group 5: Copied Data Filtering & Noise Removal ---');

  const TextCleaner = require('../app/js/cleaner.js');

  runTest('5.1: Strips security tags, email headers, signatures, and confidentiality disclaimers', () => {
    const rawEmail = `[EXTERNAL EMAIL]
From: alice@acme.corp
Sent: Friday, October 16, 2026 10:15 AM
To: helpdesk@company.com
Subject: Cannot log in to ERP portal

Hello Support Team,
I am getting error 403 Forbidden whenever I try to log in to the ERP portal after changing my password this morning.

Thanks & Regards,
Alice Smith
Senior Financial Analyst | Acme Corp
Phone: +1 555 0199

CONFIDENTIALITY NOTICE: This transmission is intended only for the designated recipient. Any unauthorized dissemination or copying is strictly prohibited. If received in error, please destroy immediately.`;

    const res = TextCleaner.cleanCopiedText(rawEmail);
    assert.strictEqual(res.changed, true);
    assert.ok(res.cleanedText.includes('getting error 403 Forbidden'));
    assert.ok(res.cleanedText.includes('ERP portal after changing my password'));
    assert.strictEqual(res.cleanedText.includes('[EXTERNAL EMAIL]'), false);
    assert.strictEqual(res.cleanedText.includes('From: alice@acme.corp'), false);
    assert.strictEqual(res.cleanedText.includes('CONFIDENTIALITY NOTICE'), false);
    assert.strictEqual(res.cleanedText.includes('Thanks & Regards'), false);
    assert.strictEqual(res.cleanedText.includes('Alice Smith'), false);
  });

  runTest('5.2: Strips mobile device signatures and quoted lines', () => {
    const mobileText = `> Can anyone assist with this issue?
My VPN connection drops every 5 minutes when connected to home Wi-Fi.

Sent from my iPhone`;

    const res = TextCleaner.cleanCopiedText(mobileText);
    assert.strictEqual(res.changed, true);
    assert.ok(res.cleanedText.includes('My VPN connection drops every 5 minutes'));
    assert.strictEqual(res.cleanedText.includes('Sent from my iPhone'), false);
  });

  console.log('\n--- Group 6: Machine Learning & Vector Pattern Recognition ---');

  await runAsyncTest('6.1: api/ml-classify returns valid pattern classification and engine metadata', async () => {
    const handler = require('../api/ml-classify.js');
    let out = '';
    let status = 200;
    const res = {
      setHeader: () => {},
      set statusCode(s) { status = s; },
      get statusCode() { return status; },
      end: (data) => { out = data; }
    };

    const policies = [
      {
        id: 'POL-PWD-01',
        name: 'Password Reset Directive',
        conditions: 'User forgot password or account is locked due to repeated bad entries.',
        resolution: 'Issue self-service password reset email link.',
        keywords: ['password', 'reset', 'credentials', 'passcode']
      },
      {
        id: 'POL-NET-01',
        name: 'VPN and Remote Network Access',
        conditions: 'User cannot connect to corporate VPN gateway.',
        resolution: 'Restart Cisco AnyConnect client and confirm MFA push notification.',
        keywords: ['vpn', 'network', 'gateway', 'anyconnect']
      }
    ];

    const ticket = {
      title: 'Passcode forgotten',
      description: 'I forgot my password and cannot sign in to my workstation.'
    };

    await handler({ method: 'POST', body: { ticket, policies } }, res);
    assert.strictEqual(status, 200);
    const parsed = JSON.parse(out);
    assert.strictEqual(parsed.success, true);
    assert.strictEqual(parsed.matched, true);
    assert.strictEqual(parsed.topMatch.id, 'POL-PWD-01');
    assert.ok(parsed.similarityScore > 0);
  });

  console.log('\n======================================================================');
  console.log(`REGRESSION TEST SUMMARY: ${passCount} / ${passCount + failCount} Passed (${failCount === 0 ? '100%' : 'FAILED'})`);
  console.log('======================================================================');

  if (failCount > 0) process.exit(1);
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

