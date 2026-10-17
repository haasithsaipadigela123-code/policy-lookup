/**
 * Policy Lookup — Multi-Domain Generalization & Provenance Test Suite
 * Validates domain-agnostic policy ingestion, metadata absence handling,
 * exact location citations, conflict detection, and history preservation.
 */

const assert = require('assert');
const DocumentParser = require('../app/js/document-parser.js');
const TfIdfEngine = require('../app/js/tfidf.js');
const LocalClassifier = require('../app/js/classifier.js');
global.TfIdfEngine = TfIdfEngine;
global.LocalClassifier = LocalClassifier;
const PolicyEngine = require('../app/js/engine.js');
const TicketModel = require('../app/js/ticket-model.js');
const ConversationParser = require('../app/js/conversation-parser.js');
const TicketRetriever = require('../app/js/ticket-retriever.js');

console.log('======================================================================');
console.log('🧪 MULTI-DOMAIN GENERAL-PURPOSE POLICY & PROVENANCE TEST SUITE');
console.log('======================================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
  }
}

// =========================================================================
// TEST GROUP 1: Policies from Diverse Domains & Ingestion Formats
// =========================================================================
console.log('--- TEST GROUP 1: Ingestion & Representation Across Diverse Domains ---');

test('1.1: HR Policy Ingestion (Paragraph format, No Policy IDs, No Tables)', () => {
  const hrText = `
BEREAVEMENT LEAVE POLICY
Employees are eligible for up to five consecutive business days of paid bereavement leave in the event of the loss of an immediate family member, including spouse, child, parent, or sibling.
Documentation such as a funeral program or obituary may be requested by Human Resources.
Bereavement leave must be taken within thirty days of the occurrence.

ANNUAL VACATION ACCRUAL
Full-time staff accrue paid time off at a rate of 1.25 days per completed calendar month of active service.
Unused vacation time in excess of five days does not roll over to the subsequent calendar year unless approved by the department director.
`;

  const parsed = DocumentParser.parseTxt(hrText, 'hr_handbook.txt');
  assert.strictEqual(parsed.policies.length >= 2, true);

  const bereavement = parsed.policies.find(p => /bereavement/i.test(p.name) || /bereavement/i.test(p.title));
  assert.ok(bereavement, 'Must parse Bereavement policy');
  assert.strictEqual(bereavement.hasExplicitId, false, 'HR policy has no policy ID');
  assert.strictEqual(bereavement.policyId, null, 'policyId must be null when absent');
  assert.ok(bereavement.internalReference, 'Must assign internalReference for indexing');
  assert.strictEqual(bereavement.sourceDocName, 'hr_handbook.txt');
  assert.ok(bereavement.pageOrRow.includes('Lines'), 'Must cite actual line range');
  assert.strictEqual(bereavement.hasExplicitResolution, false, 'No explicit resolution in text');
});

test('1.2: Finance Policy Ingestion (CSV format with row tracking & monetary limits)', () => {
  const financeCsv = `Policy Code,Category,Rule Description,Exceptions,Remedy
FIN-EXP-01,Travel & Expenses,Meals during domestic business travel are reimbursable up to $75 per day with itemized receipts,Alcohol purchases are strictly non-reimbursable,Process reimbursement via standard payroll cycle
FIN-EXP-02,Procurement,Software subscriptions over $500 annually require prior written approval from the IT Director,Emergency security patches may be procured immediately,Submit invoice to accounts payable
`;

  const parsed = DocumentParser.parseCsv(financeCsv, 'finance_procurement.csv');
  assert.strictEqual(parsed.policies.length, 2);

  const mealPolicy = parsed.policies[0];
  assert.strictEqual(mealPolicy.policyId, 'FIN-EXP-01');
  assert.strictEqual(mealPolicy.hasExplicitId, true);
  assert.strictEqual(mealPolicy.hasExplicitResolution, true);
  assert.strictEqual(mealPolicy.pageOrRow, 'Row 2');
  assert.strictEqual(mealPolicy.sourceDocName, 'finance_procurement.csv');
  assert.ok(mealPolicy.exceptions.includes('Alcohol'));
});

test('1.3: Airline Baggage Policy Ingestion (Markdown format, section headers, no explicit IDs)', () => {
  const airlineMd = `
# Passenger Baggage & Compensation Policy

## Section 3.1: Delayed Checked Baggage
Passengers whose checked baggage does not arrive on their scheduled flight are entitled to essential emergency expenses up to $150 after 24 hours of delay upon submission of purchase receipts.
Claims must be submitted within 21 days of the scheduled flight arrival.

## Section 3.2: Damaged Baggage
For baggage damaged during carrier transit, the airline will repair or replace the bag up to the maximum liability limit established by the Montreal Convention.
Normal wear and tear such as minor scuffs, broken zippers due to overpacking, or pre-existing baggage flaws are excluded from compensation.
`;

  const parsed = DocumentParser.parseTxt(airlineMd, 'baggage_rules.md');
  assert.strictEqual(parsed.policies.length >= 2, true);

  const delayedBag = parsed.policies.find(p => p.mainText.includes('Delayed') || p.name.includes('Delayed'));
  assert.ok(delayedBag);
  assert.strictEqual(delayedBag.hasExplicitId, false);
  assert.strictEqual(delayedBag.sourceDocName, 'baggage_rules.md');
  assert.ok(delayedBag.pageOrRow.includes('Lines'));
});

// =========================================================================
// TEST GROUP 2: General-Purpose Policy Matching Across Domains
// =========================================================================
console.log('\n--- TEST GROUP 2: Matching Across Diverse Industry Policies ---');

test('2.1: Matches HR bereavement policy without policy ID or explicit resolution', () => {
  const hrPolicies = DocumentParser.parseTxt(`
BEREAVEMENT LEAVE POLICY
Employees are eligible for up to five consecutive business days of paid bereavement leave in the event of the loss of an immediate family member, including spouse, child, parent, or sibling.
Documentation such as a funeral program or obituary may be requested by Human Resources.
`, 'hr_handbook.txt').policies;

  const ticket = TicketModel.createNormalizedTicket({
    source: 'manual_description',
    title: 'Time off for grandfather passing away',
    description: 'My immediate family member passed away yesterday and I need to request bereavement leave for funeral arrangements.'
  });

  const res = PolicyEngine.matchTicket(ticket, hrPolicies);
  assert.strictEqual(res.matched, true);
  assert.strictEqual(res.topMatch.hasExplicitId, false, 'Must honestly report hasExplicitId: false');
  assert.strictEqual(res.topMatch.id, null, 'Must not invent a policy ID');
  assert.ok(/bereavement/i.test(res.topMatch.name), 'Must identify policy by title');
  assert.strictEqual(res.topMatch.sourceDocName, 'hr_handbook.txt');
  assert.ok(res.topMatch.pageOrRow.includes('Lines'), 'Must cite actual lines');
  assert.strictEqual(res.topMatch.hasExplicitResolution, false, 'Must not invent an operational resolution');
  assert.strictEqual(res.topMatch.resolution, null, 'resolution must be null when absent from source');
});

test('2.2: Matches Finance expense policy with exception condition (alcohol exclusion)', () => {
  const finPolicies = DocumentParser.parseCsv(`Policy Code,Category,Rule Description,Exceptions,Remedy
FIN-EXP-01,Travel & Expenses,Meals during domestic business travel are reimbursable up to $75 per day with itemized receipts,Alcohol purchases and wine are strictly non-reimbursable,Process reimbursement via payroll
`, 'finance_travel.csv').policies;

  const ticketWithAlcohol = TicketModel.createNormalizedTicket({
    source: 'manual_description',
    title: 'Dinner receipt reimbursement on client visit',
    description: 'Submitting dinner bill for $60 which includes a glass of wine and an entree during business travel.'
  });

  const res = PolicyEngine.matchTicket(ticketWithAlcohol, finPolicies);
  assert.strictEqual(res.matched, true);
  assert.strictEqual(res.topMatch.id, 'FIN-EXP-01');
  assert.strictEqual(res.topMatch.hasExplicitId, true);
  assert.strictEqual(res.topMatch.exceptionTriggered, true, 'Must detect wine/alcohol exception');
  assert.strictEqual(res.topMatch.pageOrRow, 'Row 2');
});

test('2.3: Airline baggage claim with paraphrased wording & abbreviations', () => {
  const airlinePolicies = DocumentParser.parseTxt(`
## Section 3.1: Delayed Checked Baggage
Passengers whose checked baggage luggage does not arrive on flight are entitled to essential emergency expenses up to $150 after 24 hours of delay upon submission of purchase receipts.
## Section 3.2: Damaged Baggage Transit
For luggage damaged during transit carrier will repair broken suitcase.
`, 'carrier_rules.txt').policies;

  const ticket = TicketModel.createNormalizedTicket({
    source: 'conversation_paste',
    title: 'Luggage missing after 30 hours',
    description: 'My checked bags never arrived at baggage claim yesterday. It has been over 28 hrs and I had to buy clothes. Need reimbursement for emergency receipts.'
  });

  const res = PolicyEngine.matchTicket(ticket, airlinePolicies);
  assert.strictEqual(res.matched, true);
  assert.ok(res.topMatch.name.includes('Delayed') || res.topMatch.name.includes('Baggage'));
});

// =========================================================================
// TEST GROUP 3: Conflict Detection & Precedence Handling
// =========================================================================
console.log('\n--- TEST GROUP 3: Contradictions & Conflicting Policies ---');

test('3.1: Returns CONFLICTING_POLICIES when ticket asserts and negates same problem', () => {
  const policies = [
    {
      id: 'POL-01',
      name: 'Hardware Replacement',
      conditions: 'Monitor display flickering or broken screen',
      resolution: 'Dispatch replacement screen'
    }
  ];

  const contradictoryTicket = TicketModel.createNormalizedTicket({
    source: 'manual_description',
    title: 'Monitor issue',
    description: 'Screen is failing and broken but the monitor is working fine and not broken at all.'
  });

  const res = PolicyEngine.matchTicket(contradictoryTicket, policies);
  assert.strictEqual(res.status, 'CONFLICTING_POLICIES');
  assert.strictEqual(res.matched, false);
});

test('3.2: Returns CONFLICTING_POLICIES when two top candidate policies give opposite directives', () => {
  const policies = [
    {
      id: 'POL-RET-01',
      name: 'Open Box Return Policy (Standard Store)',
      category: 'Returns',
      conditions: 'Customer returning electronics within 14 days with receipt',
      resolution: 'Approve full refund to original payment method',
      keywords: ['open box', 'electronics return', 'refund']
    },
    {
      id: 'POL-RET-02',
      name: 'Clearance & Liquidated Goods Policy',
      category: 'Returns',
      conditions: 'Customer returning open box clearance electronics item',
      resolution: 'Reject request and deny refund. All clearance items strictly non-refundable and final sale.',
      keywords: ['open box', 'clearance', 'refund', 'electronics return']
    }
  ];

  const ticket = TicketModel.createNormalizedTicket({
    source: 'manual_description',
    title: 'Return open box electronics clearance item',
    description: 'Customer purchased an open box electronics laptop on clearance 5 days ago and wants to process a return and get a full refund.'
  });

  const res = PolicyEngine.matchTicket(ticket, policies);
  assert.strictEqual(res.status, 'CONFLICTING_POLICIES');
  assert.strictEqual(res.matched, false);
  assert.ok(res.reason.includes('Conflicting policy directives'));
});

// =========================================================================
// TEST GROUP 4: Zero Fabricated Data & Location Precision
// =========================================================================
console.log('\n--- TEST GROUP 4: Zero Fabricated Metadata & Exact Location Tracking ---');

test('4.1: Missing metadata is not fabricated as blank string or invented text', () => {
  const rawClause = {
    internalReference: 'ref_clause_009',
    policyId: null,
    hasExplicitId: false,
    title: null,
    hasExplicitTitle: false,
    category: null,
    hasExplicitCategory: false,
    conditions: 'Subscribers who cancel service within trial period receive prorated invoice adjustment.',
    hasExplicitConditions: true,
    exceptions: null,
    hasExplicitExceptions: false,
    resolution: null,
    hasExplicitResolution: false,
    sourceDocName: 'subscription_terms.txt',
    pageOrRow: 'Lines 45-52',
    mainText: 'Subscribers who cancel service within trial period receive prorated invoice adjustment.'
  };

  const ticket = TicketModel.createNormalizedTicket({
    source: 'manual_description',
    title: 'Cancellation within trial period',
    description: 'I want to cancel service during my trial period. Please adjust my invoice.'
  });

  const res = PolicyEngine.matchTicket(ticket, [rawClause]);
  assert.strictEqual(res.matched, true);
  assert.strictEqual(res.topMatch.id, null);
  assert.strictEqual(res.topMatch.hasExplicitId, false);
  assert.strictEqual(res.topMatch.hasExplicitTitle, false);
  assert.strictEqual(res.topMatch.resolution, null);
  assert.strictEqual(res.topMatch.hasExplicitResolution, false);
  assert.strictEqual(res.topMatch.sourceDocName, 'subscription_terms.txt');
  assert.strictEqual(res.topMatch.pageOrRow, 'Lines 45-52');
  assert.strictEqual(res.topMatch.hasExplicitExceptions, false);
});

test('4.2: Exact row number preserved in CSV and spreadsheet records', () => {
  const csvText = `Policy ID,Title,Clause,Remedy
POL-OPS-01,Damaged Goods,Packages marked damaged in transit qualify for immediate reshipment,Reship item
POL-OPS-02,Lost In Transit,Shipments with no courier scan for 7 days qualify for refund,Refund customer
POL-OPS-03,Wrong Item,Customer received incorrect SKU,Exchange item
`;

  const parsed = DocumentParser.parseCsv(csvText, 'courier_sop.csv');
  assert.strictEqual(parsed.policies[0].pageOrRow, 'Row 2');
  assert.strictEqual(parsed.policies[1].pageOrRow, 'Row 3');
  assert.strictEqual(parsed.policies[2].pageOrRow, 'Row 4');

  const ticket = TicketModel.createNormalizedTicket({
    source: 'manual_description',
    title: 'Package lost with no scan for a week',
    description: 'My courier shipment has had no scan for 8 days and is lost in transit.'
  });

  const res = PolicyEngine.matchTicket(ticket, parsed.policies);
  assert.strictEqual(res.matched, true);
  assert.strictEqual(res.topMatch.id, 'POL-OPS-02');
  assert.strictEqual(res.topMatch.pageOrRow, 'Row 3');
  assert.strictEqual(res.topMatch.sourceDocName, 'courier_sop.csv');
});

// =========================================================================
// TEST GROUP 5: Condition & Exception Verification Breakdown
// =========================================================================
console.log('\n--- TEST GROUP 5: Structured Condition & Exception Breakdown ---');

test('5.1: Structured evaluation identifies satisfied and unknown conditions', () => {
  const policy = {
    id: 'POL-MED-01',
    name: 'Medical Expense Claim',
    conditions: 'Claimant must submit official medical certificate; Itemized hospital bill must be attached; Incident must occur during policy year',
    hasExplicitConditions: true,
    hasExplicitResolution: true,
    resolution: 'Issue reimbursement within 10 business days',
    sourceDocName: 'health_plan.docx',
    pageOrRow: 'Table 2, Row 1'
  };

  const ticket = TicketModel.createNormalizedTicket({
    source: 'manual_description',
    title: 'Hospital bill claim submission',
    description: 'Attaching my itemized hospital bill for treatment received last week during active policy year.'
  });

  const res = PolicyEngine.matchTicket(ticket, [policy]);
  assert.strictEqual(res.matched, true);
  assert.ok(res.evaluatedConditions.length >= 3);

  const billCond = res.evaluatedConditions.find(c => c.text.includes('hospital bill'));
  assert.ok(billCond);
  assert.strictEqual(billCond.status, 'SUPPORTED', 'Hospital bill is explicitly mentioned in ticket');

  const certCond = res.evaluatedConditions.find(c => c.text.includes('medical certificate'));
  assert.ok(certCond);
  assert.strictEqual(certCond.status, 'UNKNOWN', 'Medical certificate unverified in ticket');
});

// =========================================================================
// TEST GROUP 6: Other Relevant Policies
// =========================================================================
console.log('\n--- TEST GROUP 6: Multiple Competing & Related Policies ---');

test('6.1: Populates otherMatches with runner-up policies and evidence excerpts', () => {
  const policies = [
    {
      id: 'POL-NET-01',
      name: 'VPN Gateway Failure',
      category: 'Network',
      conditions: 'User unable to establish VPN remote tunnel',
      resolution: 'Restart VPN client and reinstall certificate'
    },
    {
      id: 'POL-NET-02',
      name: 'Wi-Fi Office Network Access',
      category: 'Network',
      conditions: 'User unable to connect to corporate Wi-Fi network',
      resolution: 'Renew 802.1x network profile'
    },
    {
      id: 'POL-NET-03',
      name: 'DNS Resolution Error',
      category: 'Network',
      conditions: 'User unable to resolve internal domain names',
      resolution: 'Flush DNS cache'
    }
  ];

  const ticket = TicketModel.createNormalizedTicket({
    source: 'manual_description',
    title: 'Network connection dropped',
    description: 'Unable to connect to company network resources remotely or access internal tools.'
  });

  const res = PolicyEngine.matchTicket(ticket, policies);
  assert.strictEqual(res.matched, true);
  assert.ok(Array.isArray(res.otherMatches));
  assert.ok(res.otherMatches.length > 0, 'Must provide other relevant policies');
  assert.ok(res.otherMatches[0].evidence.length > 0, 'Must include supporting evidence excerpt for other match');
});

// =========================================================================
// TEST GROUP 7: Unrelated Ticket & No Policy Found
// =========================================================================
console.log('\n--- TEST GROUP 7: Out-of-Domain & Unrelated Ticket Handling ---');

test('7.1: Returns NO_POLICY_FOUND without fabricating answers for out-of-domain ticket', () => {
  const hrPolicies = DocumentParser.parseTxt(`
BEREAVEMENT LEAVE POLICY
Paid bereavement leave in the event of the loss of an immediate family member.
`, 'hr_handbook.txt').policies;

  const unrelatedTicket = TicketModel.createNormalizedTicket({
    source: 'manual_description',
    title: 'MySQL database deadlock error 1205',
    description: 'Transaction deadlock occurred on table users during high concurrency lock wait timeout exceeded.'
  });

  const res = PolicyEngine.matchTicket(unrelatedTicket, hrPolicies);
  assert.strictEqual(res.matched, false);
  assert.strictEqual(res.status, 'NO_POLICY_FOUND');
  assert.ok(res.reason.includes('No matching policies'));
});

// =========================================================================
// SUMMARY
// =========================================================================
console.log('\n======================================================================');
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('======================================================================\n');

if (passedTests < totalTests) {
  process.exit(1);
}
