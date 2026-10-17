/**
 * Policy Lookup — Swiggy Policies, Ticket Preview & Hesk Help Desk Test Suite
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const TicketRetriever = require('../app/js/ticket-retriever.js');
const TicketModel = require('../app/js/ticket-model.js');
const ConversationParser = require('../app/js/conversation-parser.js');
const PolicyEngine = require('../app/js/engine.js');
const { parseDocxTables } = require('../scripts/docx-table-parser.js');

let passedCount = 0;
let totalCount = 0;

function runTest(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✕ ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalCount++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✕ ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function runAll() {
  console.log('\n=============================================================');
  console.log('🧪 TESTING SWIGGY POLICIES, LIVE PREVIEW & HESK INTEGRATION');
  console.log('=============================================================\n');

  // 1. Policy Document Parsing (CSV, TXT, DOCX)
  console.log('--- 1. Swiggy Policy Documents Ingestion ---');
  
  const docxPath = path.join(__dirname, '..', 'fixtures', 'swiggy_policy_document.docx');
  const csvPath = path.join(__dirname, '..', 'fixtures', 'swiggy_policy_document.csv');
  const txtPath = path.join(__dirname, '..', 'fixtures', 'swiggy_policy_document.txt');

  runTest('Swiggy policy fixture files exist on disk', () => {
    assert(fs.existsSync(docxPath), 'DOCX policy exists');
    assert(fs.existsSync(csvPath), 'CSV policy exists');
    assert(fs.existsSync(txtPath), 'TXT policy exists');
  });

  let swiggyPolicies = [];
  await runAsyncTest('Parse swiggy_policy_document.docx tables', async () => {
    const buf = fs.readFileSync(docxPath);
    const parsed = await parseDocxTables(buf, { filename: 'swiggy_policy_document.docx' });
    assert.strictEqual(parsed.policies.length, 6, 'Should extract exactly 6 policies');
    swiggyPolicies = parsed.policies;
    const ids = swiggyPolicies.map(p => p.id);
    assert(ids.includes('SWIGGY-DEL-001'), 'Contains delay policy');
    assert(ids.includes('SWIGGY-ITM-002'), 'Contains item defect policy');
    assert(ids.includes('SWIGGY-CAN-003'), 'Contains cancellation policy');
    assert(ids.includes('SWIGGY-PAY-004'), 'Contains payment policy');
    assert(ids.includes('SWIGGY-SEC-005'), 'Contains security policy');
    assert(ids.includes('SWIGGY-VIP-006'), 'Contains VIP policy');
  });

  // 2. Policy Matching on Swiggy Scenarios
  console.log('\n--- 2. Real-World Swiggy Scenario Matching ---');

  runTest('Scenario 1: Delivery Delay (SWIGGY-DEL-001)', () => {
    const ticket = {
      title: 'Order #ORD-8921 delayed by 50 minutes',
      description: 'My dinner delivery order #ORD-8921 has been delayed by 50 minutes beyond the promised delivery time. The delivery rider is stuck in transit traffic and my food is cold. Please issue compensation voucher or cancel.'
    };
    const res = PolicyEngine.matchTicket(ticket, swiggyPolicies);
    assert.strictEqual(res.status, 'MATCH_FOUND');
    assert.strictEqual(res.topMatch.id, 'SWIGGY-DEL-001');
    assert(res.topMatch.resolution.includes('INR 50 Swiggy Money compensation voucher'));
  });

  runTest('Scenario 2: Missing dish with broken safety seal (SWIGGY-ITM-002)', () => {
    const ticket = {
      title: 'Order #4412 Missing Butter Chicken & Broken Seal',
      description: 'I just received order #4412 ten minutes ago. The garlic naans are here, but the butter chicken is missing completely. Furthermore, the restaurant safety tamper seal tape on the bag was torn open. Attached photo evidence within 15 minutes.'
    };
    const res = PolicyEngine.matchTicket(ticket, swiggyPolicies);
    assert.strictEqual(res.status, 'MATCH_FOUND');
    assert.strictEqual(res.topMatch.id, 'SWIGGY-ITM-002');
    assert(res.topMatch.resolution.includes('100% item-level refund'));
  });

  runTest('Scenario 3: Cancellation after kitchen started cooking (SWIGGY-CAN-003 Exception)', () => {
    const ticket = {
      title: 'Cancel Order #6201',
      description: 'Customer requests order cancellation 20 minutes after placing order. Restaurant accepted order and the kitchen has already begun food preparation without any delay.'
    };
    const res = PolicyEngine.matchTicket(ticket, swiggyPolicies);
    assert(res.matched);
    assert.strictEqual(res.topMatch.id, 'SWIGGY-CAN-003');
    assert(res.topMatch.resolution.includes('100% cancellation charge'));
  });

  runTest('Scenario 4: Double UPI debit with bank UTR number (SWIGGY-PAY-004)', () => {
    const ticket = {
      title: 'Payment deducted twice via UPI for order #7710',
      description: 'My bank account was debited multiple times via Google Pay UPI for single order #7710. The order failed on the app, but money was deducted twice. Bank transaction UTR reference number is 982341209121.'
    };
    const res = PolicyEngine.matchTicket(ticket, swiggyPolicies);
    assert.strictEqual(res.status, 'MATCH_FOUND');
    assert.strictEqual(res.topMatch.id, 'SWIGGY-PAY-004');
    assert(res.topMatch.resolution.includes('3 to 5 business days'));
  });

  runTest('Scenario 5: Multi-message Swiggy Chat Transcript', () => {
    const transcript = `
Customer [10:45 AM]: Hello, I just received order #ORD-5521 from Royal Biryani.
Agent [10:46 AM]: Hello! Thank you for contacting Swiggy. How may I assist you with order #ORD-5521 today?
Customer [10:47 AM]: The package arrived with the safety tamper tape torn, and the mutton biryani is completely missing from the container! I took a photo within 10 minutes of delivery.
Agent [10:48 AM]: I am so sorry to hear that. Let me look up our missing and damaged items policy for you right away.
    `;
    const parsed = ConversationParser.parseConversation(transcript);
    assert.strictEqual(parsed.hasStructuredMessages, true);
    assert.strictEqual(parsed.extractedIdentifiers[0], 'ORD-5521');

    const ticket = TicketModel.createNormalizedTicket({
      source: 'conversation_paste',
      title: `Conversation #${parsed.extractedIdentifiers[0]}`,
      description: transcript,
      conversation: parsed
    });

    const res = PolicyEngine.matchTicket(ticket, swiggyPolicies);
    assert.strictEqual(res.status, 'MATCH_FOUND');
    assert.strictEqual(res.topMatch.id, 'SWIGGY-ITM-002');
  });

  runTest('Scenario 6: Unrelated Software Ticket returns NO_POLICY_FOUND', () => {
    const ticket = {
      title: 'Patch Hello World',
      description: 'Fixing compilation warning in C runtime library hello-world.c by adding stdio.h include.'
    };
    const res = PolicyEngine.matchTicket(ticket, swiggyPolicies);
    assert.strictEqual(res.status, 'NO_POLICY_FOUND');
  });

  // 3. Hesk Adapter Tests
  console.log('\n--- 3. Hesk Help Desk Adapter Integration ---');

  runTest('HeskAdapter recognizes hesk.com URLs', () => {
    const adapter = TicketRetriever.getAdapter('https://www.hesk.com/demo/ticket.php');
    assert.strictEqual(adapter.name, 'hesk');
  });

  runTest('HeskAdapter extracts tracking ID from query param', () => {
    const adapter = TicketRetriever.getAdapter('https://support.hesk.com/ticket.php?track=ABC-123-WXYZ');
    assert.strictEqual(adapter.name, 'hesk');
    const trackId = adapter.extractTrackId('https://support.hesk.com/ticket.php?track=ABC-123-WXYZ');
    assert.strictEqual(trackId, 'ABC-123-WXYZ');
  });

  runTest('HeskAdapter detects tracking lookup gate requiring credentials', () => {
    const adapter = TicketRetriever.getAdapter('https://www.hesk.com/demo/ticket.php');
    const mockLookupHtml = `
      <html>
        <head><title>Help Desk Demo</title></head>
        <body>
          <h1>View existing ticket</h1>
          <form action="ticket.php">
            <label>Ticket tracking ID</label>
            <input name="track">
            <label>Email</label>
            <input name="email">
            <button>View ticket</button>
          </form>
          <div>Forgot tracking ID?</div>
        </body>
      </html>
    `;
    const parsed = adapter.parseHtml(mockLookupHtml, 'https://www.hesk.com/demo/ticket.php');
    assert(parsed.requiresAuth, 'Lookup form should require authentication / tracking ID');
    assert.strictEqual(parsed.failureReason, 'TRACKING_ID_REQUIRED');
  });

  runTest('HeskAdapter extracts actual ticket content when accessible', () => {
    const adapter = TicketRetriever.getAdapter('https://support.hesk.com/ticket.php?track=HESK-9912');
    const mockTicketHtml = `
      <html>
        <head><title>HESK-9912 - Order Delayed - HESK</title></head>
        <body>
          <h1 class="ticket-subject">Order Delayed in Transit</h1>
          <div class="ticket-message">Customer reports shipment has been stuck for 45 minutes past delivery window.</div>
        </body>
      </html>
    `;
    const parsed = adapter.parseHtml(mockTicketHtml, 'https://support.hesk.com/ticket.php?track=HESK-9912');
    assert.strictEqual(parsed.ticketId, 'HESK-9912');
    assert.strictEqual(parsed.title, 'Order Delayed in Transit');
    assert(parsed.description.includes('stuck for 45 minutes'));
    assert(!parsed.description.includes('Help Desk Demo'), 'Should not contain Help Desk Demo');
    assert(!parsed.description.includes('View existing ticket'), 'Should not contain form header');
  });

  runTest('HeskAdapter detects CAPTCHA barrier and returns CAPTCHA_REQUIRED', () => {
    const adapter = TicketRetriever.getAdapter('https://www.hesk.com/demo/ticket.php');
    const mockCaptchaHtml = `
      <html>
        <head><title>Help Desk Demo</title></head>
        <body>
          <h1>View existing ticket</h1>
          <form action="ticket.php">
            <label>Ticket tracking ID</label>
            <input name="track">
            <div>Type the number you see in the picture below.</div>
            <button>Send me my tracking ID</button>
          </form>
        </body>
      </html>
    `;
    const parsed = adapter.parseHtml(mockCaptchaHtml, 'https://www.hesk.com/demo/ticket.php');
    assert(parsed.requiresAuth, 'CAPTCHA page should require auth barrier');
    assert.strictEqual(parsed.failureReason, 'CAPTCHA_REQUIRED');
  });

  runTest('GenericWebAdapter rejects pages without semantic ticket content (zero form dumping)', () => {
    const adapter = TicketRetriever.getAdapter('https://example.com/login.html');
    const mockFormHtml = `
      <html>
        <head><title>Customer Portal</title></head>
        <body>
          <nav><a>Home</a><a>Login</a></nav>
          <form>
            <label>Username</label><input>
            <label>Password</label><input type="password">
            <button>Log In</button>
          </form>
          <footer>Copyright 2026</footer>
        </body>
      </html>
    `;
    const parsed = adapter.parseHtml(mockFormHtml, 'https://example.com/login.html');
    assert(parsed.failureReason === 'AUTHENTICATION_REQUIRED' || parsed.failureReason === 'UNSUPPORTED_PAGE');
  });

  console.log(`\n=============================================================`);
  console.log(`Results: ${passedCount} / ${totalCount} tests passed (${Math.round((passedCount/totalCount)*100)}%)`);
  console.log(`=============================================================\n`);

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

runAll().catch(err => {
  console.error(err);
  process.exit(1);
});
