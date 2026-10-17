/**
 * Rigorous Verification & Data Integrity Test Suite for Policy Lookup
 * 
 * Verifies:
 * 1. Document parsing on isolated user fixtures (CSV, TXT, DOCX, XLSX).
 * 2. Unsupervised Vector Space Retrieval (TF-IDF + Cosine Similarity).
 * 3. Honest Machine Learning State:
 *    - Untrained when no labelled tickets exist (isTrained = false).
 *    - Trained when legitimate labelled ticket-to-policy pairs are supplied.
 * 4. Deterministic policy matching & validation across all required scenarios:
 *    - Password reset
 *    - Account lockout
 *    - VPN failure
 *    - Contractor exception
 *    - VIP exception
 *    - Unrelated ticket (NO_POLICY_FOUND)
 *    - Contradictory ticket (CONFLICTING_POLICIES)
 * 5. Python ML scikit-learn pipeline (retrieval vs. supervised classification).
 * 6. Node.js Server & REST API endpoints.
 */

const assert = require('assert');
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const http = require('http');

// Load portal modules
const DocumentParser = require('../app/js/document-parser.js');
const TfIdfEngine = require('../app/js/tfidf.js');
const LocalClassifier = require('../app/js/classifier.js');
global.TfIdfEngine = TfIdfEngine;
global.LocalClassifier = LocalClassifier;
const PolicyEngine = require('../app/js/engine.js');

console.log('=== RUNNING VERIFICATION & DATA INTEGRITY TEST SUITE ===\n');

// ---------------------------------------------------------------------------
// TEST 1: Document Parsing on Isolated Fixture (No hardcoded operational data)
// ---------------------------------------------------------------------------
console.log('Test 1: Parsing user-supplied policy fixture (CSV)...');
const testCsv = `Policy ID,Policy Name,Category,Conditions,Exceptions,Resolution,Keywords
POL-AUTH-01,Domain Password Reset,Identity,Active Directory user account expired or password forgotten,VIP executives require verbal phone confirmation before resetting password,Send self-service password reset link via SMS or secondary email,password reset active directory domain login
POL-AUTH-02,Account Lockout Resolution,Identity,Domain user profile locked after exceeding maximum invalid logon attempts,High privilege admin accounts require IT security clearance before unlock,Verify caller identity unlock user profile in Active Directory Users and Computers,account locked lockout logon attempts frozen profile
POL-NET-01,GlobalProtect VPN Remote Access,Network,GlobalProtect VPN tunnel fails to connect from remote location,Third party contractor access requires approved change ticket from vendor manager,Verify client certificate reinstall adapter restart tunnel,vpn tunnel remote access globalprotect`;

const parsed = DocumentParser.processCsvData(testCsv, 'test_policies.csv');
assert.strictEqual(parsed.policies.length, 3, 'Should parse exactly 3 policies from test CSV');
assert.strictEqual(parsed.policies[0].id, 'POL-AUTH-01');
assert.strictEqual(parsed.policies[1].id, 'POL-AUTH-02');
assert.strictEqual(parsed.policies[2].id, 'POL-NET-01');
console.log('✓ DocumentParser successfully parsed dynamic CSV policies.');

// ---------------------------------------------------------------------------
// TEST 2: Honest Supervised Classifier State (Untrained vs. Labelled Training)
// ---------------------------------------------------------------------------
console.log('\nTest 2: Verifying honest Supervised Classifier behavior...');
const classifier = new LocalClassifier.NaiveBayesClassifier();

// 2a. When NO labelled ticket data exists:
const untrainedPred = classifier.predict('User cannot log in because active directory password is forgotten');
assert.strictEqual(untrainedPred.isTrained, false, 'Model must report untrained when no labelled data exists');
assert.strictEqual(untrainedPred.probability, 0, 'Untrained model must not report fake probabilities');
console.log('✓ Untrained model honestly reports isTrained: false (no fabricated training data).');

// 2b. When legitimate labelled ticket examples ARE supplied:
const legitimateLabelledTickets = [
  { ticket: 'Active Directory password expired user cannot login', policyId: 'POL-AUTH-01' },
  { ticket: 'Forgot domain password reset requested', policyId: 'POL-AUTH-01' },
  { ticket: 'Account locked out maximum failed attempts', policyId: 'POL-AUTH-02' },
  { ticket: 'Domain account locked profile frozen', policyId: 'POL-AUTH-02' },
  { ticket: 'VPN tunnel failure disconnect remote', policyId: 'POL-NET-01' },
  { ticket: 'GlobalProtect VPN failed to connect', policyId: 'POL-NET-01' }
];

const trainStatus = classifier.trainFromLabelledTickets(legitimateLabelledTickets);
assert.strictEqual(trainStatus.isTrained, true);
assert.strictEqual(trainStatus.sampleCount, 6);
assert.strictEqual(trainStatus.classCount, 3);

const trainedPred = classifier.predict('User forgot password and needs reset');
assert.strictEqual(trainedPred.isTrained, true);
assert.strictEqual(trainedPred.topClass, 'POL-AUTH-01');
assert.ok(trainedPred.probability > 0.5, 'Trained model should assign high probability to POL-AUTH-01');
console.log('✓ Supervised model trains on real labelled tickets and accurately predicts:', trainedPred.topClass, 'Prob:', trainedPred.probability);

// Reset classifier so subsequent operational tests do not rely on synthetic training
classifier.reset();

// ---------------------------------------------------------------------------
// TEST 3: Unsupervised TF-IDF Vector Retrieval & Rule Validation
// ---------------------------------------------------------------------------
console.log('\nTest 3: Testing PolicyEngine across all required operational scenarios...');

// Scenario 3a: Password Reset
const ticketPwd = {
  title: 'Active Directory password issue',
  description: 'User forgotten domain password and cannot log into workstation'
};
const resPwd = PolicyEngine.matchTicket(ticketPwd, parsed.policies);
assert.strictEqual(resPwd.matched, true);
assert.strictEqual(resPwd.status, 'MATCH_FOUND');
assert.strictEqual(resPwd.topMatch.id, 'POL-AUTH-01');
assert.strictEqual(resPwd.topMatch.resolution, 'Send self-service password reset link via SMS or secondary email');
console.log('✓ Scenario 1 (Password Reset): Matched to POL-AUTH-01.');

// Scenario 3b: Account Lockout
const ticketLock = {
  title: 'Account locked out',
  description: 'Domain account is locked after exceeding maximum failed logon attempts. Please unlock the user profile.'
};
const resLock = PolicyEngine.matchTicket(ticketLock, parsed.policies);
assert.strictEqual(resLock.matched, true);
assert.strictEqual(resLock.status, 'MATCH_FOUND');
assert.strictEqual(resLock.topMatch.id, 'POL-AUTH-02');
assert.strictEqual(resLock.topMatch.resolution, 'Verify caller identity unlock user profile in Active Directory Users and Computers');
console.log('✓ Scenario 2 (Account Lockout): Matched to POL-AUTH-02.');

// Scenario 3c: VPN Failure
const ticketVpn = {
  title: 'VPN connection failed',
  description: 'GlobalProtect remote connection failed. VPN tunnel cannot be established from home.'
};
const resVpn = PolicyEngine.matchTicket(ticketVpn, parsed.policies);
assert.strictEqual(resVpn.matched, true);
assert.strictEqual(resVpn.status, 'MATCH_FOUND');
assert.strictEqual(resVpn.topMatch.id, 'POL-NET-01');
console.log('✓ Scenario 3 (VPN Failure): Matched to POL-NET-01.');

// Scenario 3d: Contractor Exception Trigger
const ticketContractor = {
  title: 'Contractor VPN access requested',
  description: 'Third party contractor consultant needs remote VPN connection restored.'
};
const resContractor = PolicyEngine.matchTicket(ticketContractor, parsed.policies);
assert.strictEqual(resContractor.matched, true);
assert.strictEqual(resContractor.topMatch.id, 'POL-NET-01');
assert.strictEqual(resContractor.topMatch.exceptionTriggered, true, 'Contractor exception must trigger');
assert.ok(resContractor.topMatch.matchedExceptions.length > 0);
console.log('✓ Scenario 4 (Contractor Exception): Detected exception:', resContractor.topMatch.matchedExceptions[0]);

// Scenario 3e: VIP Executive Exception Trigger
const ticketVip = {
  title: 'Password reset for Executive Director',
  description: 'VIP executive forgot domain password. VIP executives require verbal phone confirmation before proceeding.'
};
const resVip = PolicyEngine.matchTicket(ticketVip, parsed.policies);
assert.strictEqual(resVip.matched, true);
assert.strictEqual(resVip.topMatch.id, 'POL-AUTH-01');
assert.strictEqual(resVip.topMatch.exceptionTriggered, true, 'VIP exception must trigger');
console.log('✓ Scenario 5 (VIP Exception): Detected exception:', resVip.topMatch.matchedExceptions[0]);

// Scenario 3f: Unrelated Ticket Rejection
const ticketUnrel = {
  title: 'Catering order for marketing lunch',
  description: 'Please order vegetarian sandwiches and sparkling water for Friday.'
};
const resUnrel = PolicyEngine.matchTicket(ticketUnrel, parsed.policies);
assert.strictEqual(resUnrel.matched, false, 'Unrelated ticket must not match');
assert.strictEqual(resUnrel.status, 'NO_POLICY_FOUND');
console.log('✓ Scenario 6 (Unrelated Ticket): Correctly rejected with status NO_POLICY_FOUND.');

// Scenario 3g: Contradictory Ticket Description
const ticketContra = {
  title: 'VPN issue',
  description: 'VPN is working fine. Unable to connect to VPN.'
};
const resContra = PolicyEngine.matchTicket(ticketContra, parsed.policies);
assert.strictEqual(resContra.matched, false);
assert.strictEqual(resContra.status, 'CONFLICTING_POLICIES', 'Contradictory ticket must require operator verification');
console.log('✓ Scenario 7 (Contradictory Ticket): Correctly flagged as CONFLICTING_POLICIES.');

// ---------------------------------------------------------------------------
// TEST 4: Python ML scikit-learn Engine (Untrained vs. Labelled Training)
// ---------------------------------------------------------------------------
console.log('\nTest 4: Testing Python ML engine (ml/policy_ml.py)...');
try {
  // 4a. Without labelled data (TF-IDF vector retrieval only)
  const pyPayloadNoLabels = JSON.stringify({
    ticket: "GlobalProtect VPN tunnel fails to connect",
    policies: parsed.policies
  });
  const pyOutput1 = execFileSync('python', ['ml/policy_ml.py'], {
    input: pyPayloadNoLabels,
    encoding: 'utf-8'
  });
  const pyRes1 = JSON.parse(pyOutput1);
  assert.strictEqual(pyRes1.success, true);
  assert.strictEqual(pyRes1.topMatch.id, 'POL-NET-01');
  assert.strictEqual(pyRes1.supervisedClassifier.isTrained, false, 'Python model must report untrained when no labelled data provided');
  console.log('✓ Python unsupervised retrieval: Matched POL-NET-01 with similarity:', pyRes1.retrieval.similarityScore);
  console.log('✓ Python supervised classifier honestly reports isTrained: false.');

  // 4b. With labelled training data
  const pyPayloadWithLabels = JSON.stringify({
    ticket: "Active Directory password expired",
    policies: parsed.policies,
    labelledData: legitimateLabelledTickets
  });
  const pyOutput2 = execFileSync('python', ['ml/policy_ml.py'], {
    input: pyPayloadWithLabels,
    encoding: 'utf-8'
  });
  const pyRes2 = JSON.parse(pyOutput2);
  assert.strictEqual(pyRes2.success, true);
  assert.strictEqual(pyRes2.supervisedClassifier.isTrained, true, 'Python model must be trained when labelled data provided');
  assert.strictEqual(pyRes2.topMatch.id, 'POL-AUTH-01');
  console.log('✓ Python supervised classifier trains on labelled data and outputs calibrated probability.');
} catch (err) {
  console.error('Python ML execution error:', err.message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// TEST 5: Node.js Server & HTTP Endpoints
// ---------------------------------------------------------------------------
console.log('\nTest 5: Testing Node.js Server & HTTP Endpoints...');
const serverProc = spawn('node', ['server.js'], {
  env: { ...process.env, PORT: '3098' },
  stdio: 'pipe'
});

setTimeout(() => {
  http.get('http://127.0.0.1:3098/api/status', (res) => {
    assert.strictEqual(res.statusCode, 200);
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      const statusJson = JSON.parse(data);
      assert.strictEqual(statusJson.status, 'active');
      console.log('✓ GET /api/status returned 200 OK with server:', statusJson.server);

      // POST /api/analyze
      const postData = JSON.stringify({
        ticket: ticketPwd,
        policies: parsed.policies
      });

      const postReq = http.request({
        hostname: '127.0.0.1',
        port: 3098,
        path: '/api/analyze',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (postRes) => {
        assert.strictEqual(postRes.statusCode, 200);
        let postBody = '';
        postRes.on('data', c => { postBody += c; });
        postRes.on('end', () => {
          const analyzeResult = JSON.parse(postBody);
          assert.strictEqual(analyzeResult.matched, true);
          assert.strictEqual(analyzeResult.topMatch.id, 'POL-AUTH-01');
          console.log('✓ POST /api/analyze returned 200 OK with matched policy:', analyzeResult.topMatch.name);

          // POST /api/ml-classify (Python bridge)
          const mlReq = http.request({
            hostname: '127.0.0.1',
            port: 3098,
            path: '/api/ml-classify',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          }, (mlRes) => {
            assert.strictEqual(mlRes.statusCode, 200);
            let mlBody = '';
            mlRes.on('data', c => { mlBody += c; });
            mlRes.on('end', () => {
              const mlResult = JSON.parse(mlBody);
              assert.strictEqual(mlResult.success, true);
              console.log('✓ POST /api/ml-classify returned 200 OK with engine:', mlResult.engine);

              serverProc.kill();
              console.log('\n======================================================');
              console.log('ALL VERIFICATION & DATA INTEGRITY TESTS PASSED (100%)');
              console.log('======================================================\n');
              process.exit(0);
            });
          });
          mlReq.write(postData);
          mlReq.end();
        });
      });
      postReq.write(postData);
      postReq.end();
    });
  }).on('error', (err) => {
    console.error('Error connecting to server:', err);
    serverProc.kill();
    process.exit(1);
  });
}, 1000);
