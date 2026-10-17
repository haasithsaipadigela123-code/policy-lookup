/**
 * Sample Word (.docx) Generator for Testing
 * 
 * Generates valid OpenXML .docx files containing multi-table policies,
 * varying column headers, conditions, exceptions, and deliberate edge cases
 * (missing cells, empty rows, duplicate IDs).
 */

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

function escapeXml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildCellXml(text) {
  const lines = (text || '').split('\n');
  const paras = lines.map(line => `
    <w:p>
      <w:r>
        <w:t>${escapeXml(line)}</w:t>
      </w:r>
    </w:p>
  `).join('');
  return `<w:tc>${paras}</w:tc>`;
}

function buildRowXml(cellTexts) {
  const cells = cellTexts.map(buildCellXml).join('');
  return `<w:tr>${cells}</w:tr>`;
}

function buildTableXml(headers, rows) {
  const headerRow = buildRowXml(headers);
  const dataRows = rows.map(buildRowXml).join('');
  return `
    <w:tbl>
      <w:tblPr>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        </w:tblBorders>
      </w:tblPr>
      ${headerRow}
      ${dataRows}
    </w:tbl>
  `;
}

async function createDocx(tables, outputPath) {
  const zip = new JSZip();

  // 1. [Content_Types].xml
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  // 2. _rels/.rels
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  // 3. word/document.xml
  const tablesXml = tables.map(t => {
    const titleP = `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(t.title || 'Policy Table')}</w:t></w:r></w:p>`;
    return titleP + buildTableXml(t.headers, t.rows);
  }).join('<w:p><w:r><w:t></w:t></w:r></w:p>');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="32"/></w:rPr>
        <w:t>Corporate IT Support Standard Operating Policies</w:t>
      </w:r>
    </w:p>
    <w:p><w:r><w:t>Fictional Test Data for Automated Testing</w:t></w:r></w:p>
    ${tablesXml}
    <w:sectPr/>
  </w:body>
</w:document>`;

  zip.file('word/document.xml', documentXml);

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buffer);
  }
  return buffer;
}

// Generate test documents if run directly
if (require.main === module) {
  (async () => {
    const testDocxPath = path.join(__dirname, '..', 'tests', 'sample-policies.docx');
    const edgeDocxPath = path.join(__dirname, '..', 'tests', 'edge-case-policies.docx');

    // Table 1: Security & Access Policies (Standard headers)
    const table1 = {
      title: 'Table 1: Security & Access Management Policies',
      headers: ['Policy Code', 'Topic', 'Department', 'Conditions', 'Exceptions', 'Approved Solution', 'Keywords'],
      rows: [
        [
          'POL-SEC-001',
          'Corporate Password Reset',
          'Security',
          'User cannot log in due to forgotten or expired domain credentials.',
          'VIP executives require immediate phone verification.',
          'Direct user to self-service portal (SSPR) or reset via Active Directory console.',
          'password, sspr, credentials, forgot password'
        ],
        [
          'POL-SEC-002',
          'Account Lockout Remediation',
          'Security',
          'Account locked after 5 consecutive bad login attempts.',
          'Accounts flagged for suspicious geolocation cannot be unlocked without security officer sign-off.',
          'Verify user identity and clear lockout flag in Active Directory domain controller.',
          'account locked, lockout, unlock, bad password'
        ],
        [
          'POL-NET-003',
          'Remote Access VPN Connection Troubleshooting',
          'Infrastructure',
          'User is unable to establish connection to corporate GlobalProtect or AnyConnect VPN.',
          'Contractors require active sponsor approval token before reconnecting.',
          'Reinstall root security certificates, verify MFA push notification, and restart VPN tunnel service.',
          'vpn, globalprotect, anyconnect, remote connection'
        ]
      ]
    };

    // Table 2: Operations & Hardware (Different header names)
    const table2 = {
      title: 'Table 2: Hardware and Office Operations',
      headers: ['Item No', 'Policy Title', 'Scope', 'Exclusions', 'Resolution', 'Custom Department Note'],
      rows: [
        [
          'POL-OPS-006',
          'Office Network Printer Maintenance',
          'Print spooler errors, paper jams, or missing networked office printers.',
          'Personal USB printers not purchased through IT are not serviced.',
          'Power-cycle the printer, clear jammed paper tray, and restart print spooler service.',
          'Tier 1 On-Site Dispatch'
        ],
        [
          'POL-OPS-009',
          'Blue Screen and Operating System Crash',
          'Workstation BSOD, kernel panic, or frequent spontaneous operating system restarts.',
          'Physical liquid damage requires hardware warranty replacement.',
          'Inspect minidump files with WinDbg, roll back recent driver updates, and test RAM integrity.',
          'Tier 2 Hardware Support'
        ]
      ]
    };

    await createDocx([table1, table2], testDocxPath);
    console.log(`✅ Created test document: ${testDocxPath}`);

    // Edge Cases Document: Missing cells, empty rows, duplicate IDs, custom columns
    const edgeTable1 = {
      title: 'Edge Case Table 1: Malformed and Incomplete Rows',
      headers: ['Policy ID', 'Policy Name', 'Conditions', 'Exceptions', 'Resolution'],
      rows: [
        // Normal row
        ['POL-EDGE-001', 'Software License Request', 'Need paid developer tool license', 'No personal licenses', 'Submit purchase request'],
        // Row with missing cells (only 2 cells provided)
        ['POL-EDGE-002', 'Incomplete Cell Count Row'],
        // Blank row
        ['', '', '', '', ''],
        // Duplicate ID
        ['POL-EDGE-001', 'Duplicate License Policy', 'Duplicate ID edge test', 'None', 'Reject duplicate'],
        // Row missing ID (has condition and resolution)
        ['', 'Nameless Policy Without ID', 'User lost access to network share', 'External guests', 'Map Z drive via group policy']
      ]
    };

    await createDocx([edgeTable1], edgeDocxPath);
    console.log(`✅ Created edge cases document: ${edgeDocxPath}`);
  })();
}

module.exports = {
  createDocx
};
