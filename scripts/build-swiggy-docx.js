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

function buildRowXml(cells) {
  return `<w:tr>${cells.map(buildCellXml).join('')}</w:tr>`;
}

async function run() {
  const csvContent = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'swiggy_policy_document.csv'), 'utf8');
  // Simple CSV parser for quoted fields
  const rows = [];
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim().length > 0);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const regex = /(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g;
    const row = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      if (match.index === regex.lastIndex) regex.lastIndex++;
      const val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
      row.push(val.trim());
    }
    if (row.length > 0) rows.push(row);
  }

  const headerRow = rows[0];
  const dataRows = rows.slice(1);

  const headerXml = buildRowXml(headerRow);
  const dataXml = dataRows.map(buildRowXml).join('');
  const tableXml = `
    <w:tbl>
      <w:tblPr>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        </w:tblBorders>
      </w:tblPr>
      ${headerXml}
      ${dataXml}
    </w:tbl>
  `;

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Swiggy Customer Support &amp; Delivery Operations Policies</w:t></w:r></w:p>
    ${tableXml}
  </w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', relsXml);
  zip.file('word/document.xml', docXml);

  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  const outPath = path.join(__dirname, '..', 'fixtures', 'swiggy_policy_document.docx');
  fs.writeFileSync(outPath, buf);
  console.log('✅ Generated swiggy_policy_document.docx:', outPath, 'Bytes:', buf.length);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
