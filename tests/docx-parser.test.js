/**
 * Automated Test Suite for DOCX Table Parser & Word-to-JSON Converter
 * 
 * Verifies:
 * 1. Extraction of multiple tables from .docx documents
 * 2. Preservation of all original columns in `allColumns`
 * 3. Handling of differing column names across tables
 * 4. Detection and reporting of missing cells
 * 5. Detection and skipping of empty rows
 * 6. Detection and disambiguation of duplicate policy IDs
 * 7. Handling of documents with no tables (empty documents)
 * 8. Validation of generated JSON schema
 * 9. Integration of extracted policies with PolicyMatcher (including exceptions and conditions)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { parseDocxTables, validatePolicyData, mapHeadersToFields } = require('../scripts/docx-table-parser');
const { createDocx } = require('../scripts/generate-sample-docx');
const PolicyMatcher = require('../extension/matcher');

console.log('====================================================');
console.log('🧪 RUNNING DOCX POLICY PARSER & CONVERTER TEST SUITE');
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

async function runAsyncTest(testName, fn) {
  totalTests++;
  try {
    await fn();
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

(async () => {
  // ----------------------------------------------------
  // TEST GROUP 1: HEADER MAPPING & NORMALIZATION
  // ----------------------------------------------------
  console.log('--- Test Group 1: Header Mapping & Column Normalization ---');

  runTest('Maps diverse column headers to canonical fields while identifying custom columns', () => {
    const headers = ['Policy Code', 'Topic', 'Scope', 'Exclusions', 'Resolution', 'Custom Department Note'];
    const { mapping, unmappedHeaders } = mapHeadersToFields(headers);

    assert.strictEqual(mapping.id.colIndex, 0, 'Policy Code should map to id');
    assert.strictEqual(mapping.name.colIndex, 1, 'Topic should map to name');
    assert.strictEqual(mapping.conditions.colIndex, 2, 'Scope should map to conditions');
    assert.strictEqual(mapping.exceptions.colIndex, 3, 'Exclusions should map to exceptions');
    assert.strictEqual(mapping.resolution.colIndex, 4, 'Resolution should map to resolution');
    assert.strictEqual(unmappedHeaders.length, 1, 'Custom Department Note should be identified as unmapped');
    assert.strictEqual(unmappedHeaders[0].originalHeader, 'Custom Department Note');
  });

  // ----------------------------------------------------
  // TEST GROUP 2: MULTI-TABLE EXTRACTION & DATA PRESERVATION
  // ----------------------------------------------------
  console.log('\n--- Test Group 2: Multi-Table DOCX Extraction & Content Preservation ---');

  const sampleDocxPath = path.join(__dirname, 'sample-policies.docx');
  const sampleBuffer = fs.readFileSync(sampleDocxPath);

  await runAsyncTest('Extracts all policies across multiple tables in sample DOCX', async () => {
    const result = await parseDocxTables(sampleBuffer, { filename: 'sample-policies.docx' });
    assert.strictEqual(result.success, true, 'Extraction should succeed');
    assert.strictEqual(result.report.tablesFound, 2, 'Should find 2 tables');
    assert.strictEqual(result.report.tablesProcessed, 2, 'Should process 2 tables');
    assert.strictEqual(result.policies.length, 5, 'Should extract 5 policies total');
  });

  await runAsyncTest('Preserves 100% of raw column headers and values in allColumns', async () => {
    const result = await parseDocxTables(sampleBuffer, { filename: 'sample-policies.docx' });
    const p1 = result.policies[0];

    assert.strictEqual(p1.id, 'POL-SEC-001');
    assert.strictEqual(p1.name, 'Corporate Password Reset');
    assert.ok(p1.allColumns, 'allColumns must be present');
    assert.strictEqual(p1.allColumns['Policy Code'], 'POL-SEC-001');
    assert.strictEqual(p1.allColumns['Topic'], 'Corporate Password Reset');
    assert.strictEqual(p1.allColumns['Department'], 'Security');
    assert.strictEqual(p1.allColumns['Exceptions'], 'VIP executives require immediate phone verification.');

    // Check table 2 custom column preservation
    const p4 = result.policies[3];
    assert.strictEqual(p4.id, 'POL-OPS-006');
    assert.strictEqual(p4.allColumns['Custom Department Note'], 'Tier 1 On-Site Dispatch', 'Custom column must be preserved');
  });

  // ----------------------------------------------------
  // TEST GROUP 3: EDGE CASES & REPORTING (MISSING CELLS, BLANK ROWS, DUPLICATES)
  // ----------------------------------------------------
  console.log('\n--- Test Group 3: Edge Cases, Malformed Rows & Validation Reporting ---');

  const edgeDocxPath = path.join(__dirname, 'edge-case-policies.docx');
  const edgeBuffer = fs.readFileSync(edgeDocxPath);

  await runAsyncTest('Detects missing cells, empty rows, and duplicate IDs with explicit warnings', async () => {
    const result = await parseDocxTables(edgeBuffer, { filename: 'edge-case-policies.docx' });
    const { report } = result;

    // Skipped blank row
    assert.strictEqual(report.skippedRows.length, 1, 'Should skip 1 completely blank row');
    assert.strictEqual(report.skippedRows[0].reason, 'Row is completely blank');

    // Missing cells warning
    const cellCountWarning = report.structuralWarnings.find(w => w.includes('Expected 5 cells, found 2'));
    assert.ok(cellCountWarning, 'Should warn about missing trailing cells in incomplete row');

    // Duplicate Policy ID error
    assert.strictEqual(report.validationErrors.length, 1, 'Should report 1 duplicate ID error');
    assert.ok(report.validationErrors[0].includes('Duplicate Policy ID "POL-EDGE-001"'), 'Should identify duplicate POL-EDGE-001');

    // Missing ID fallback
    const missingIdWarning = report.structuralWarnings.find(w => w.includes('Missing Policy ID'));
    assert.ok(missingIdWarning, 'Should report missing Policy ID and generate placeholder');
  });

  await runAsyncTest('Gracefully handles document with no tables', async () => {
    const emptyDocBuffer = await createDocx([], null);
    const result = await parseDocxTables(emptyDocBuffer, { filename: 'empty.docx' });

    assert.strictEqual(result.success, false, 'Should report false for document without tables');
    assert.strictEqual(result.policies.length, 0, 'Policies should be empty');
    assert.ok(result.report.structuralWarnings.some(w => w.includes('No tables')), 'Should warn about no tables');
  });

  // ----------------------------------------------------
  // TEST GROUP 4: SCHEMA VALIDATION ENGINE
  // ----------------------------------------------------
  console.log('\n--- Test Group 4: Schema Validation Engine ---');

  runTest('validatePolicyData passes valid policy array', () => {
    const validData = [
      {
        id: 'POL-VAL-001',
        name: 'Valid Policy',
        allColumns: { id: 'POL-VAL-001' },
        resolution: 'Test resolution'
      }
    ];
    const validation = validatePolicyData(validData);
    assert.strictEqual(validation.valid, true, 'Should be valid');
    assert.strictEqual(validation.errors.length, 0);
  });

  runTest('validatePolicyData rejects missing ID, missing name, or duplicate IDs', () => {
    const invalidData = [
      { name: 'Missing ID' },
      { id: 'POL-01', name: '' },
      { id: 'POL-01', name: 'Duplicate ID' }
    ];
    const validation = validatePolicyData(invalidData);
    assert.strictEqual(validation.valid, false, 'Should fail validation');
    assert.ok(validation.errors.some(e => e.includes('missing a valid string \'id\'')), 'Error on missing ID');
    assert.ok(validation.errors.some(e => e.includes('missing a valid string \'name\'')), 'Error on missing name');
    assert.ok(validation.errors.some(e => e.includes('duplicate \'id\'')), 'Error on duplicate ID');
  });

  // ----------------------------------------------------
  // TEST GROUP 5: MATCHING EXTRACTED POLICIES WITH CONDITIONS & EXCEPTIONS
  // ----------------------------------------------------
  console.log('\n--- Test Group 5: Matching Extracted Policies, Conditions & Exceptions ---');

  const sampleResult = await parseDocxTables(sampleBuffer, { filename: 'sample-policies.docx' });
  const extractedPolicies = sampleResult.policies;

  runTest('Matches extracted password policy by conditions and keywords', () => {
    const ticket = {
      title: 'Cannot authenticate with domain credentials',
      description: 'User forgot password and needs reset to log into workstation.'
    };
    const match = PolicyMatcher.matchTicket(ticket, extractedPolicies);
    assert.strictEqual(match.matched, true, 'Should match extracted policy');
    assert.strictEqual(match.topMatch.id, 'POL-SEC-001');
    assert.strictEqual(match.topMatch.name, 'Corporate Password Reset');
    assert.ok(match.topMatch.resolution.includes('SSPR'), 'Resolution must be preserved from Word table');
  });

  runTest('Detects exception condition in VPN policy ticket for contractors', () => {
    const ticket = {
      title: 'VPN connection failure for contractor',
      description: 'External contractor cannot establish connection to corporate GlobalProtect VPN tunnel.'
    };
    const match = PolicyMatcher.matchTicket(ticket, extractedPolicies);
    assert.strictEqual(match.matched, true, 'Should match VPN policy');
    assert.strictEqual(match.topMatch.id, 'POL-NET-003');
    assert.ok(match.topMatch.exceptionTriggered, 'Exception should be triggered for contractor');
  });

  runTest('Returns NO_POLICY_FOUND for unrelated issue against extracted policies', () => {
    const ticket = {
      title: 'Cafeteria lunch menu request',
      description: 'Is vegetarian sandwich available today for lunch?'
    };
    const match = PolicyMatcher.matchTicket(ticket, extractedPolicies);
    assert.strictEqual(match.matched, false, 'Should not match unrelated ticket');
    assert.strictEqual(match.status, 'NO_POLICY_FOUND');
  });

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('====================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
})();
