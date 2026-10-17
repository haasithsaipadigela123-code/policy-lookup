const fs = require('fs');
const path = require('path');
const vm = require('vm');

const filesToClean = [
  'extension/extractor.js',
  'extension/matcher.js',
  'extension/popup.js',
  'extension/content.js',
  'extension/policy-service.js',
  'extension/importer.js',
  'extension/docx-table-parser.js',
  'bookmarklet/docx-table-parser.js',
  'scripts/docx-table-parser.js'
];

function stripComments(code) {
  // Remove multi-line comments
  let cleaned = code.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove single line comments that are on their own line
  cleaned = cleaned.replace(/^\s*\/\/.*$/gm, '');
  // Remove end of line comments where safe
  cleaned = cleaned.replace(/(;|{|\}|,)\s*\/\/.*$/gm, '$1');
  // Collapse excessive empty lines
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
  return cleaned.trim() + '\n';
}

const root = path.join(__dirname, '..');

for (const rel of filesToClean) {
  const full = path.join(root, rel);
  if (fs.existsSync(full)) {
    const raw = fs.readFileSync(full, 'utf8');
    const cleaned = stripComments(raw);
    // Verify syntax
    try {
      new vm.Script(cleaned);
      fs.writeFileSync(full, cleaned, 'utf8');
      console.log(`Cleaned: ${rel}`);
    } catch (e) {
      console.error(`Syntax check failed for ${rel}:`, e.message);
    }
  }
}
