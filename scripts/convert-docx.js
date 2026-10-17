/**
 * CLI Tool: Convert Word (.docx) Policy Tables to Extension JSON
 * 
 * Usage:
 *   node scripts/convert-docx.js <path-to-document.docx> [path-to-output.json] [options]
 * 
 * Options:
 *   --validate-only    Validate and print extraction report without writing to disk
 *   --fictional        Mark metadata as fictional test data
 *   --force            Save output even if structural warnings were detected
 */

const fs = require('fs');
const path = require('path');
const { parseDocxTables, validatePolicyData } = require('./docx-table-parser');

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
========================================================================
📄 WORD (.DOCX) TO POLICY JSON CONVERTER
========================================================================

Extracts policy tables from Microsoft Word (.docx) documents and produces
validated JSON compatible with the Policy Chrome Extension.

Usage:
  node scripts/convert-docx.js <input.docx> [output.json] [options]

Arguments:
  <input.docx>         Path to source Word document containing policy tables
  [output.json]        Destination JSON file (default: extension/policies.json)

Options:
  --validate-only      Run extraction, generate report, but do not write output
  --fictional          Flag output metadata as fictional sample data
  --force              Write output even if warnings or non-critical errors occur
  --help, -h           Show this help message

Examples:
  node scripts/convert-docx.js corporate_policies.docx
  node scripts/convert-docx.js policies.docx extension/policies.json --fictional
  node scripts/convert-docx.js test.docx --validate-only
========================================================================
`);
    process.exit(0);
  }

  const flags = new Set(args.filter(a => a.startsWith('--')));
  const nonFlagArgs = args.filter(a => !a.startsWith('--'));

  const inputPath = nonFlagArgs[0];
  const outputPath = nonFlagArgs[1] || path.join(__dirname, '..', 'extension', 'policies.json');

  if (!inputPath) {
    console.error('❌ Error: Input .docx file path is required.');
    process.exit(1);
  }

  const resolvedInput = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`❌ Error: Input file not found: ${resolvedInput}`);
    process.exit(1);
  }

  console.log('========================================================================');
  console.log(`📂 Processing DOCX: ${path.basename(resolvedInput)}`);
  console.log(`📍 Full Path:       ${resolvedInput}`);
  console.log('========================================================================\n');

  try {
    const fileBuffer = fs.readFileSync(resolvedInput);
    const filename = path.basename(resolvedInput);
    const isFictional = flags.has('--fictional');

    const result = await parseDocxTables(fileBuffer, {
      filename,
      isFictionalSample: isFictional
    });

    const { report, policies, metadata } = result;

    console.log('--- 📊 EXTRACTION REPORT ---');
    console.log(`Tables detected:       ${report.tablesFound}`);
    console.log(`Tables processed:      ${report.tablesProcessed}`);
    console.log(`Total rows examined:   ${report.totalRowsExamined}`);
    console.log(`Policies extracted:    ${report.policiesExtracted}`);

    // Print structural warnings
    if (report.structuralWarnings.length > 0) {
      console.log(`\n⚠️  Structural Warnings (${report.structuralWarnings.length}):`);
      report.structuralWarnings.forEach((w, i) => {
        console.log(`   ${i + 1}. ${w}`);
      });
    }

    // Print skipped rows
    if (report.skippedRows.length > 0) {
      console.log(`\nℹ️  Skipped Rows (${report.skippedRows.length}):`);
      report.skippedRows.forEach(sr => {
        console.log(`   - Table #${sr.tableNumber}, Row #${sr.rowNumber}: ${sr.reason}`);
      });
    }

    // Print unmapped columns
    if (report.unmappedColumns.length > 0) {
      console.log(`\n📋 Custom/Unmapped Columns Preserved in allColumns:`);
      report.unmappedColumns.forEach(uc => {
        const cols = uc.columns.map(c => `"${c.originalHeader}" (${c.note})`).join(', ');
        console.log(`   - Table #${uc.tableNumber}: ${cols}`);
      });
    }

    // Print validation errors
    if (report.validationErrors.length > 0) {
      console.log(`\n❌ Validation Errors (${report.validationErrors.length}):`);
      report.validationErrors.forEach((e, i) => {
        console.log(`   ${i + 1}. ${e}`);
      });
    }

    // Validate generated output
    const validation = validatePolicyData({ policies });
    console.log('\n--- 🔍 VALIDATION SUMMARY ---');
    console.log(`Schema Validation:     ${validation.valid ? '✅ PASSED' : '❌ FAILED'}`);
    if (validation.errors.length > 0) {
      console.log(`Errors:                ${validation.errors.length}`);
      validation.errors.forEach(e => console.log(`   - ${e}`));
    }
    if (validation.warnings.length > 0) {
      console.log(`Warnings:              ${validation.warnings.length}`);
      validation.warnings.forEach(w => console.log(`   - ${w}`));
    }

    if (flags.has('--validate-only')) {
      console.log('\n[--validate-only specified. No files written.]');
      process.exit(validation.valid ? 0 : 1);
    }

    if (!validation.valid && !flags.has('--force')) {
      console.error('\n❌ Output aborted due to validation errors. Use --force to write anyway.');
      process.exit(1);
    }

    if (policies.length === 0) {
      console.error('\n❌ No policies extracted from document. Nothing to write.');
      process.exit(1);
    }

    // Construct final JSON payload
    const outputPayload = {
      version: metadata.version,
      lastUpdated: new Date().toISOString().split('T')[0],
      sourceDocument: filename,
      disclaimer: metadata.disclaimer,
      policyCount: policies.length,
      policies: policies
    };

    const resolvedOutput = path.resolve(process.cwd(), outputPath);
    const outDir = path.dirname(resolvedOutput);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(resolvedOutput, JSON.stringify(outputPayload, null, 2), 'utf8');

    console.log('\n========================================================================');
    console.log(`✅ SUCCESS! Exported ${policies.length} policies to:`);
    console.log(`📁 ${resolvedOutput}`);
    console.log('========================================================================\n');

  } catch (err) {
    console.error(`\n❌ Conversion failed: ${err.message}`);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

main();
