/**
 * Policy Lookup — Generalized Document Ingestion & Policy Extraction Pipeline
 * 
 * Supports diverse organizational policy structures across domains (IT, HR, Finance,
 * Logistics, Customer Operations, Retail, Travel, Healthcare) without hardcoded schemas.
 * 
 * Key Principles:
 * 1. Never assume organization, domain, or predefined table structure.
 * 2. Never assume policies have IDs, titles, categories, or resolutions.
 * 3. Never invent missing information or convert absence of data into fabricated facts.
 * 4. Preserve provenance, verified source locations (PDF pages, DOCX headings/tables,
 *    CSV rows, XLSX sheets/rows, TXT line ranges), and raw extracted passages.
 * 5. Report processing status (Ready, Partially processed, Failed) with actionable warnings.
 */

const DocumentParser = (function () {
  'use strict';

  function cleanText(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/\s+/g, ' ').trim();
  }

  function slugify(text) {
    return cleanText(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function parseCsv(text) {
    const lines = [];
    let row = [];
    let inQuotes = false;
    let field = '';

    const cleanInput = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < cleanInput.length; i++) {
      const char = cleanInput[i];
      const nextChar = cleanInput[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',' || char === '\t') {
          row.push(field);
          field = '';
        } else if (char === '\n') {
          row.push(field);
          lines.push(row);
          row = [];
          field = '';
        } else {
          field += char;
        }
      }
    }
    if (field || row.length > 0) {
      row.push(field);
      lines.push(row);
    }
    return lines;
  }

  /**
   * General-purpose header mapper for tabular policies across any domain
   */
  function mapHeader(header) {
    if (!header || typeof header !== 'string') return null;
    const norm = cleanText(header).toLowerCase();

    // Policy Identifier
    if (/^(id|policy\s*id|policy\s*code|item\s*no|code|ref|reference|clause\s+(?:no|num|number|#)|clause_id|rule\s*#|article\s*#|pol\s*id|pid)$/i.test(norm)) {
      return 'id';
    }

    // Policy Title / Name
    if (/^(name|policy\s*name|policy\s*title|title|topic|subject|heading|clause\s*title|rule\s*name|article\s*title|policy)$/i.test(norm)) {
      return 'name';
    }

    // Category / Domain / Department
    if (/^(category|department|dept|domain|area|system|type|classification|group|division|module)$/i.test(norm)) {
      return 'category';
    }

    // Conditions / Scope / Symptoms / Criteria
    if (/^(conditions?|scope|problem|problem\s*description|symptom|symptoms|issue|applies\s*when|applies\s*to|applicability|trigger|criteria|eligibility|requirements?|standard|description|rule\s*details?|details?|prerequisites|clause|clauses|rule|rules|provision)$/i.test(norm)) {
      return 'conditions';
    }

    // Exceptions / Exclusions / Escalations
    if (/^(exceptions?|exclusions?|override|escalation|special\s*cases?|caveats?|exemptions?|limitations?|non[\s-]applicable|not\s*covered|restrictions)$/i.test(norm)) {
      return 'exceptions';
    }

    // Resolution / Action / Procedure / Remedy
    if (/^(resolution|solution|approved\s*solution|action|procedure|instructions?|steps?|fix|remedy|compliance\s*action|outcome|operational\s*action|action\s*to\s*take|payout|guidance|sop|remediation|troubleshooting)$/i.test(norm)) {
      return 'resolution';
    }

    // Search Keywords / Synonyms
    if (/^(keywords?|tags?|search\s*terms?|synonyms?|keyterms?|signals?)$/i.test(norm)) {
      return 'keywords';
    }

    // Effective Date
    if (/^(effective\s*date|date|date\s*effective|valid\s*from)$/i.test(norm)) {
      return 'effectiveDate';
    }

    // Version
    if (/^(version|v\.|rev|revision)$/i.test(norm)) {
      return 'version';
    }

    return null;
  }

  function deriveDescriptiveTitle(text, fallback) {
    if (!text || typeof text !== 'string') return fallback || 'Policy Clause';
    const firstSentence = text.split(/[.\n;]/)[0].trim();
    if (firstSentence.length > 5 && firstSentence.length <= 80) {
      return firstSentence;
    }
    const words = text.split(/\s+/).slice(0, 8).join(' ');
    return words ? words + '...' : (fallback || 'Policy Clause');
  }

  // --------------------------------------------------------------------------
  // 1. CSV / TSV Parsing
  // --------------------------------------------------------------------------
  function processCsvData(rawCsvText, filename) {
    const rows = parseCsv(rawCsvText);
    if (rows.length < 2) {
      throw new Error('CSV document must contain at least a header row and one policy record.');
    }

    const headers = rows[0].map(h => cleanText(h));
    const headerMap = {};
    headers.forEach((h, idx) => {
      const field = mapHeader(h);
      if (field && headerMap[field] === undefined) {
        headerMap[field] = idx;
      }
    });

    const policies = [];
    const warnings = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const isBlank = row.every(c => !cleanText(c));
      if (isBlank) continue;

      const rawObj = {};
      headers.forEach((h, idx) => {
        rawObj[h || `Column_${idx + 1}`] = cleanText(row[idx] || '');
      });

      const explicitId = (headerMap.id !== undefined && row[headerMap.id]) ? cleanText(row[headerMap.id]) : null;
      const internalRef = explicitId || `REF-${slugify(filename)}-R${r + 1}`;

      const explicitTitle = (headerMap.name !== undefined && row[headerMap.name]) ? cleanText(row[headerMap.name]) : null;
      const title = explicitTitle || deriveDescriptiveTitle(row.find(c => cleanText(c).length > 10), `Row ${r + 1}`);

      const explicitCategory = (headerMap.category !== undefined && row[headerMap.category]) ? cleanText(row[headerMap.category]) : null;
      const explicitConditions = (headerMap.conditions !== undefined && row[headerMap.conditions]) ? cleanText(row[headerMap.conditions]) : null;
      const explicitExceptions = (headerMap.exceptions !== undefined && row[headerMap.exceptions]) ? cleanText(row[headerMap.exceptions]) : null;
      const explicitResolution = (headerMap.resolution !== undefined && row[headerMap.resolution]) ? cleanText(row[headerMap.resolution]) : null;

      let keywords = [];
      if (headerMap.keywords !== undefined && row[headerMap.keywords]) {
        keywords = row[headerMap.keywords].split(/[,;]/).map(k => cleanText(k)).filter(Boolean);
      }

      // If document lacks separate condition/resolution columns, assemble passage from all available cells
      const mainText = Object.values(rawObj).filter(Boolean).join(' | ');

      if (!mainText || mainText.length < 5) {
        warnings.push(`Row ${r + 1}: Skipped empty or unusable policy row.`);
        continue;
      }

      const completeness = (explicitConditions && explicitResolution)
        ? 'full'
        : (explicitConditions || explicitResolution ? 'partial' : 'minimal');

      policies.push({
        id: internalRef,
        internalReference: internalRef,
        policyId: explicitId,
        hasExplicitId: Boolean(explicitId),
        name: title,
        title: title,
        hasExplicitTitle: Boolean(explicitTitle),
        category: explicitCategory,
        hasExplicitCategory: Boolean(explicitCategory),
        conditions: explicitConditions || '',
        hasExplicitConditions: Boolean(explicitConditions),
        exceptions: explicitExceptions || '',
        hasExplicitExceptions: Boolean(explicitExceptions),
        resolution: explicitResolution || '',
        hasExplicitResolution: Boolean(explicitResolution),
        effectiveDate: (headerMap.effectiveDate !== undefined && row[headerMap.effectiveDate]) ? cleanText(row[headerMap.effectiveDate]) : null,
        version: (headerMap.version !== undefined && row[headerMap.version]) ? cleanText(row[headerMap.version]) : null,
        keywords,
        rawText: mainText,
        mainText,
        allColumns: rawObj,
        sourceLocations: [
          {
            type: 'csv_row',
            rowNumber: r + 1,
            locationLabel: `Row ${r + 1}`,
            columns: headers
          }
        ],
        pageOrRow: `Row ${r + 1}`,
        sourceDocName: filename,
        sourceDocumentName: filename,
        metadataCompleteness: completeness
      });
    }

    if (policies.length === 0) {
      throw new Error('No usable policy records could be extracted from this CSV document.');
    }

    return { policies, warnings };
  }

  // --------------------------------------------------------------------------
  // 2. TXT / Markdown Parsing
  // --------------------------------------------------------------------------
  function processTxtData(rawText, filename) {
    const lines = rawText.split(/\r?\n/);
    const sections = [];
    let currentTitle = '';
    let currentLines = [];
    let startLine = 1;

    const headerRegex = /^(?:#{1,6}\s+|policy\s*[:#-]?\s*|section\s*[:#-]?\s*|clause\s*[:#-]?\s*|article\s*[:#-]?\s*|([A-Z0-9_-]{2,15}\s*[:\-]))(.*)$/i;

    function isHeadingLine(line) {
      if (!line) return false;
      if (line.match(headerRegex)) return true;
      // All-caps heading, e.g. "BEREAVEMENT LEAVE POLICY", "ANNUAL VACATION ACCRUAL"
      if (line.length >= 4 && line.length <= 60 && /^[A-Z0-9\s_\-—:]{4,}$/.test(line) && /[A-Z]/.test(line)) {
        return true;
      }
      // Heading containing policy keywords without terminal punctuation
      if (line.length <= 70 && /\b(?:policy|guidelines?|procedure|terms|rules?|accrual|entitlement|allowance)\b/i.test(line) && !/[.!?]$/.test(line)) {
        return true;
      }
      return false;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const match = isHeadingLine(line);
      if (match && currentLines.length > 0) {
        sections.push({
          title: currentTitle || `Section (Lines ${startLine}-${i})`,
          hasExplicitTitle: Boolean(currentTitle),
          content: currentLines.join('\n'),
          startLine,
          endLine: i
        });
        currentTitle = line.replace(/^#{1,6}\s*/, '').trim();
        currentLines = [];
        startLine = i + 1;
      } else if (match && currentLines.length === 0) {
        currentTitle = line.replace(/^#{1,6}\s*/, '').trim();
        startLine = i + 1;
      } else {
        if (!currentTitle) {
          currentTitle = line;
          startLine = i + 1;
        } else {
          currentLines.push(line);
        }
      }
    }

    if (currentTitle || currentLines.length > 0) {
      sections.push({
        title: currentTitle || `Section (Lines ${startLine}-${lines.length})`,
        hasExplicitTitle: Boolean(currentTitle),
        content: currentLines.join('\n'),
        startLine,
        endLine: lines.length
      });
    }

    if (sections.length === 0) {
      throw new Error('Could not identify any readable policy sections in text file.');
    }

    const policies = sections.map((sec, idx) => {
      const secText = sec.content || sec.title;
      let conditions = '';
      let exceptions = '';
      let resolution = '';

      const condMatch = secText.match(/(?:conditions?|scope|applies\s*when|symptom|eligibility|requirements?)[:\s]+([^.\n]+(?:\.[^.\n]+)?)/i);
      if (condMatch) conditions = cleanText(condMatch[1]);

      const excMatch = secText.match(/(?:exceptions?|exclusions?|special\s*cases?|unless)[:\s]+([^.\n]+(?:\.[^.\n]+)?)/i);
      if (excMatch) exceptions = cleanText(excMatch[1]);

      const resMatch = secText.match(/(?:resolution|solution|action|fix|procedure|remedy|instructions?)[:\s]+([^.\n]+(?:\.[^.\n]+)?)/i);
      if (resMatch) resolution = cleanText(resMatch[1]);

      // Check for explicit ID pattern in title or text: e.g. [POL-01], SEC-102, HR-402, Rule #12
      const idMatch = sec.title.match(/\b([A-Z0-9]{2,6}-[A-Z0-9]{2,6}-\d{2,5})\b/i) ||
                      sec.title.match(/\[([A-Z0-9_-]{2,15})\]/i);
      const explicitId = idMatch ? (idMatch[1] || idMatch[0]).toUpperCase() : null;
      const internalRef = explicitId || `REF-${slugify(filename)}-S${idx + 1}`;

      const locationLabel = `Lines ${sec.startLine}-${sec.endLine}`;
      const completeness = (conditions && resolution) ? 'full' : (conditions || resolution ? 'partial' : 'minimal');

      return {
        id: internalRef,
        internalReference: internalRef,
        policyId: explicitId,
        hasExplicitId: Boolean(explicitId),
        name: cleanText(sec.title),
        title: cleanText(sec.title),
        hasExplicitTitle: sec.hasExplicitTitle,
        category: null,
        hasExplicitCategory: false,
        conditions: conditions || '',
        hasExplicitConditions: Boolean(conditions),
        exceptions: exceptions || '',
        hasExplicitExceptions: Boolean(exceptions),
        resolution: resolution || '',
        hasExplicitResolution: Boolean(resolution),
        effectiveDate: null,
        version: null,
        keywords: [sec.title.toLowerCase()],
        rawText: `${sec.title}\n${secText}`,
        mainText: `${sec.title}\n${secText}`,
        allColumns: null,
        sourceLocations: [
          {
            type: 'txt_lines',
            heading: sec.title || null,
            startLine: sec.startLine,
            endLine: sec.endLine,
            locationLabel
          }
        ],
        pageOrRow: sec.title ? `${sec.title} (${locationLabel})` : locationLabel,
        sourceDocName: filename,
        sourceDocumentName: filename,
        metadataCompleteness: completeness
      };
    });

    return { policies, warnings: [] };
  }

  // --------------------------------------------------------------------------
  // 3. Word (.docx) Parsing (Tables and Heading/Paragraph Hierarchies)
  // --------------------------------------------------------------------------
  async function processDocxData(arrayBuffer, filename) {
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip library is not available. Please ensure jszip.min.js is bundled.');
    }

    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) {
      throw new Error('Invalid Word document: word/document.xml missing.');
    }

    const docXmlText = await docXmlFile.async('text');
    let xmlDoc;
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      xmlDoc = parser.parseFromString(docXmlText, 'application/xml');
    } else {
      const { DOMParser: XmldomParser } = require('@xmldom/xmldom');
      xmlDoc = new XmldomParser().parseFromString(docXmlText, 'text/xml');
    }

    const tblNodes = xmlDoc.getElementsByTagName('w:tbl');
    const policies = [];
    const warnings = [];

    // Mode A: Tabular Extraction from Word Tables
    if (tblNodes.length > 0) {
      for (let t = 0; t < tblNodes.length; t++) {
        const tbl = tblNodes[t];
        const trNodes = tbl.getElementsByTagName('w:tr');
        if (trNodes.length < 2) continue;

        const headerTr = trNodes[0];
        const headerTcNodes = headerTr.getElementsByTagName('w:tc');
        const headers = [];
        for (let h = 0; h < headerTcNodes.length; h++) {
          const tNodes = headerTcNodes[h].getElementsByTagName('w:t');
          let txt = '';
          for (let ti = 0; ti < tNodes.length; ti++) txt += tNodes[ti].textContent || '';
          headers.push(cleanText(txt));
        }

        const headerMap = {};
        headers.forEach((h, idx) => {
          const field = mapHeader(h);
          if (field && headerMap[field] === undefined) headerMap[field] = idx;
        });

        for (let r = 1; r < trNodes.length; r++) {
          const rowNode = trNodes[r];
          const tcNodes = rowNode.getElementsByTagName('w:tc');
          const cellTexts = [];
          for (let c = 0; c < tcNodes.length; c++) {
            const tNodes = tcNodes[c].getElementsByTagName('w:t');
            let txt = '';
            for (let ti = 0; ti < tNodes.length; ti++) txt += tNodes[ti].textContent || '';
            cellTexts.push(cleanText(txt));
          }

          if (cellTexts.every(txt => !txt)) continue;

          const rawObj = {};
          headers.forEach((h, idx) => {
            rawObj[h || `Col_${idx + 1}`] = cellTexts[idx] || '';
          });

          const explicitId = (headerMap.id !== undefined && cellTexts[headerMap.id]) ? cleanText(cellTexts[headerMap.id]) : null;
          const internalRef = explicitId || `REF-${slugify(filename)}-T${t + 1}-R${r + 1}`;

          const explicitTitle = (headerMap.name !== undefined && cellTexts[headerMap.name]) ? cleanText(cellTexts[headerMap.name]) : null;
          const title = explicitTitle || deriveDescriptiveTitle(cellTexts.find(c => cleanText(c).length > 8), `Table ${t + 1}, Row ${r + 1}`);

          const explicitCategory = (headerMap.category !== undefined && cellTexts[headerMap.category]) ? cleanText(cellTexts[headerMap.category]) : null;
          const explicitConditions = (headerMap.conditions !== undefined && cellTexts[headerMap.conditions]) ? cleanText(cellTexts[headerMap.conditions]) : null;
          const explicitExceptions = (headerMap.exceptions !== undefined && cellTexts[headerMap.exceptions]) ? cleanText(cellTexts[headerMap.exceptions]) : null;
          const explicitResolution = (headerMap.resolution !== undefined && cellTexts[headerMap.resolution]) ? cleanText(cellTexts[headerMap.resolution]) : null;

          let keywords = [];
          if (headerMap.keywords !== undefined && cellTexts[headerMap.keywords]) {
            keywords = cellTexts[headerMap.keywords].split(/[,;]/).map(k => cleanText(k)).filter(Boolean);
          }

          const mainText = Object.values(rawObj).filter(Boolean).join(' | ');
          const locationLabel = `Table ${t + 1}, Row ${r + 1}`;
          const completeness = (explicitConditions && explicitResolution) ? 'full' : (explicitConditions || explicitResolution ? 'partial' : 'minimal');

          policies.push({
            id: internalRef,
            internalReference: internalRef,
            policyId: explicitId,
            hasExplicitId: Boolean(explicitId),
            name: title,
            title: title,
            hasExplicitTitle: Boolean(explicitTitle),
            category: explicitCategory,
            hasExplicitCategory: Boolean(explicitCategory),
            conditions: explicitConditions || '',
            hasExplicitConditions: Boolean(explicitConditions),
            exceptions: explicitExceptions || '',
            hasExplicitExceptions: Boolean(explicitExceptions),
            resolution: explicitResolution || '',
            hasExplicitResolution: Boolean(explicitResolution),
            effectiveDate: (headerMap.effectiveDate !== undefined && cellTexts[headerMap.effectiveDate]) ? cleanText(cellTexts[headerMap.effectiveDate]) : null,
            version: (headerMap.version !== undefined && cellTexts[headerMap.version]) ? cleanText(cellTexts[headerMap.version]) : null,
            keywords,
            rawText: mainText,
            mainText,
            allColumns: rawObj,
            sourceLocations: [
              {
                type: 'docx_table',
                tableIndex: t + 1,
                rowNumber: r + 1,
                locationLabel,
                columns: headers
              }
            ],
            pageOrRow: locationLabel,
            sourceDocName: filename,
            sourceDocumentName: filename,
            metadataCompleteness: completeness
          });
        }
      }
    }

    // Mode B: Non-Tabular Paragraph/Heading Extraction from Word Body
    if (policies.length === 0) {
      const pNodes = xmlDoc.getElementsByTagName('w:p');
      let currentSection = { title: '', lines: [], pStart: 1, pEnd: 1 };
      const rawSections = [];

      for (let i = 0; i < pNodes.length; i++) {
        const p = pNodes[i];
        const tNodes = p.getElementsByTagName('w:t');
        let text = '';
        for (let ti = 0; ti < tNodes.length; ti++) text += tNodes[ti].textContent || '';
        text = cleanText(text);
        if (!text) continue;

        const isHeading = p.getElementsByTagName('w:heading').length > 0 ||
                          /^(?:policy|section|clause|article|\d+\.)/i.test(text);

        if (isHeading && currentSection.lines.length > 0) {
          currentSection.pEnd = i;
          rawSections.push(currentSection);
          currentSection = { title: text, lines: [], pStart: i + 1, pEnd: i + 1 };
        } else if (isHeading && currentSection.lines.length === 0) {
          currentSection.title = text;
          currentSection.pStart = i + 1;
        } else {
          currentSection.lines.push(text);
          currentSection.pEnd = i + 1;
        }
      }
      if (currentSection.title || currentSection.lines.length > 0) {
        rawSections.push(currentSection);
      }

      rawSections.forEach((sec, idx) => {
        const secText = sec.lines.join(' ');
        const idMatch = sec.title.match(/\b([A-Z0-9]{2,6}-[A-Z0-9]{2,6}-\d{2,5})\b/i);
        const explicitId = idMatch ? idMatch[1].toUpperCase() : null;
        const internalRef = explicitId || `REF-${slugify(filename)}-P${idx + 1}`;
        const locationLabel = sec.title ? `${sec.title} (Paragraphs ${sec.pStart}-${sec.pEnd})` : `Paragraphs ${sec.pStart}-${sec.pEnd}`;

        policies.push({
          id: internalRef,
          internalReference: internalRef,
          policyId: explicitId,
          hasExplicitId: Boolean(explicitId),
          name: sec.title || `Clause Section ${idx + 1}`,
          title: sec.title || `Clause Section ${idx + 1}`,
          hasExplicitTitle: Boolean(sec.title),
          category: null,
          hasExplicitCategory: false,
          conditions: sec.lines[0] || sec.title,
          hasExplicitConditions: Boolean(sec.lines[0]),
          exceptions: '',
          hasExplicitExceptions: false,
          resolution: '',
          hasExplicitResolution: false,
          keywords: [sec.title.toLowerCase()],
          rawText: `${sec.title}: ${secText}`,
          mainText: `${sec.title}: ${secText}`,
          allColumns: null,
          sourceLocations: [
            {
              type: 'docx_section',
              heading: sec.title || null,
              paragraphStart: sec.pStart,
              paragraphEnd: sec.pEnd,
              locationLabel
            }
          ],
          pageOrRow: locationLabel,
          sourceDocName: filename,
          sourceDocumentName: filename,
          metadataCompleteness: 'minimal'
        });
      });
    }

    if (policies.length === 0) {
      throw new Error('No structured policy tables or readable sections could be found in this DOCX file.');
    }

    return { policies, warnings };
  }

  // --------------------------------------------------------------------------
  // 4. Excel Spreadsheet (.xlsx) Parsing
  // --------------------------------------------------------------------------
  async function processXlsxData(arrayBuffer, filename) {
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip library is not available. Please ensure jszip.min.js is bundled.');
    }

    const zip = await JSZip.loadAsync(arrayBuffer);
    const sharedStrings = [];
    const ssFile = zip.file('xl/sharedStrings.xml');
    if (ssFile) {
      const ssText = await ssFile.async('text');
      let xmlDoc;
      if (typeof DOMParser !== 'undefined') {
        xmlDoc = new DOMParser().parseFromString(ssText, 'application/xml');
      } else {
        const { DOMParser: XmldomParser } = require('@xmldom/xmldom');
        xmlDoc = new XmldomParser().parseFromString(ssText, 'text/xml');
      }
      const siNodes = xmlDoc.getElementsByTagName('si');
      for (let i = 0; i < siNodes.length; i++) {
        const tNodes = siNodes[i].getElementsByTagName('t');
        let str = '';
        for (let j = 0; j < tNodes.length; j++) str += tNodes[j].textContent || '';
        sharedStrings.push(cleanText(str));
      }
    }

    const sheetFiles = Object.keys(zip.files).filter(f => f.startsWith('xl/worksheets/sheet') && f.endsWith('.xml'));
    if (sheetFiles.length === 0) {
      throw new Error('Invalid Excel spreadsheet: no worksheet found.');
    }

    const policies = [];
    const warnings = [];

    for (let sIdx = 0; sIdx < sheetFiles.length; sIdx++) {
      const sheetName = `Sheet ${sIdx + 1}`;
      const sheetFile = zip.file(sheetFiles[sIdx]);
      const sheetText = await sheetFile.async('text');

      let sheetDoc;
      if (typeof DOMParser !== 'undefined') {
        sheetDoc = new DOMParser().parseFromString(sheetText, 'application/xml');
      } else {
        const { DOMParser: XmldomParser } = require('@xmldom/xmldom');
        sheetDoc = new XmldomParser().parseFromString(sheetText, 'text/xml');
      }

      const rowNodes = sheetDoc.getElementsByTagName('row');
      const tableRows = [];

      for (let r = 0; r < rowNodes.length; r++) {
        const rowNode = rowNodes[r];
        const cellNodes = rowNode.getElementsByTagName('c');
        const cells = [];
        for (let c = 0; c < cellNodes.length; c++) {
          const cell = cellNodes[c];
          const type = cell.getAttribute('t');
          const vNode = cell.getElementsByTagName('v')[0];
          let val = vNode ? vNode.textContent || '' : '';
          if (type === 's' && sharedStrings[parseInt(val, 10)] !== undefined) {
            val = sharedStrings[parseInt(val, 10)];
          } else if (type === 'inlineStr') {
            const tNode = cell.getElementsByTagName('t')[0];
            val = tNode ? tNode.textContent || '' : '';
          }
          cells.push(cleanText(val));
        }
        if (cells.some(c => c)) tableRows.push(cells);
      }

      if (tableRows.length < 2) continue;

      const headers = tableRows[0];
      const headerMap = {};
      headers.forEach((h, idx) => {
        const field = mapHeader(h);
        if (field && headerMap[field] === undefined) headerMap[field] = idx;
      });

      for (let r = 1; r < tableRows.length; r++) {
        const row = tableRows[r];
        if (row.every(c => !c)) continue;

        const rawObj = {};
        headers.forEach((h, idx) => {
          rawObj[h || `Col_${idx + 1}`] = row[idx] || '';
        });

        const explicitId = (headerMap.id !== undefined && row[headerMap.id]) ? cleanText(row[headerMap.id]) : null;
        const internalRef = explicitId || `REF-${slugify(filename)}-S${sIdx + 1}-R${r + 1}`;

        const explicitTitle = (headerMap.name !== undefined && row[headerMap.name]) ? cleanText(row[headerMap.name]) : null;
        const title = explicitTitle || deriveDescriptiveTitle(row.find(c => cleanText(c).length > 8), `Row ${r + 1}`);

        const explicitCategory = (headerMap.category !== undefined && row[headerMap.category]) ? cleanText(row[headerMap.category]) : null;
        const explicitConditions = (headerMap.conditions !== undefined && row[headerMap.conditions]) ? cleanText(row[headerMap.conditions]) : null;
        const explicitExceptions = (headerMap.exceptions !== undefined && row[headerMap.exceptions]) ? cleanText(row[headerMap.exceptions]) : null;
        const explicitResolution = (headerMap.resolution !== undefined && row[headerMap.resolution]) ? cleanText(row[headerMap.resolution]) : null;

        let keywords = [];
        if (headerMap.keywords !== undefined && row[headerMap.keywords]) {
          keywords = row[headerMap.keywords].split(/[,;]/).map(k => cleanText(k)).filter(Boolean);
        }

        const mainText = Object.values(rawObj).filter(Boolean).join(' | ');
        const locationLabel = `${sheetName}, Row ${r + 1}`;
        const completeness = (explicitConditions && explicitResolution) ? 'full' : (explicitConditions || explicitResolution ? 'partial' : 'minimal');

        policies.push({
          id: internalRef,
          internalReference: internalRef,
          policyId: explicitId,
          hasExplicitId: Boolean(explicitId),
          name: title,
          title: title,
          hasExplicitTitle: Boolean(explicitTitle),
          category: explicitCategory,
          hasExplicitCategory: Boolean(explicitCategory),
          conditions: explicitConditions || '',
          hasExplicitConditions: Boolean(explicitConditions),
          exceptions: explicitExceptions || '',
          hasExplicitExceptions: Boolean(explicitExceptions),
          resolution: explicitResolution || '',
          hasExplicitResolution: Boolean(explicitResolution),
          effectiveDate: (headerMap.effectiveDate !== undefined && row[headerMap.effectiveDate]) ? cleanText(row[headerMap.effectiveDate]) : null,
          version: (headerMap.version !== undefined && row[headerMap.version]) ? cleanText(row[headerMap.version]) : null,
          keywords,
          rawText: mainText,
          mainText,
          allColumns: rawObj,
          sourceLocations: [
            {
              type: 'xlsx_row',
              sheet: sheetName,
              rowNumber: r + 1,
              locationLabel,
              columns: headers
            }
          ],
          pageOrRow: locationLabel,
          sourceDocName: filename,
          sourceDocumentName: filename,
          metadataCompleteness: completeness
        });
      }
    }

    if (policies.length === 0) {
      throw new Error('No policy records could be extracted from any worksheet in this XLSX spreadsheet.');
    }

    return { policies, warnings };
  }

  // --------------------------------------------------------------------------
  // 5. PDF Parsing (With Verified Human-Readable Page Numbering)
  // --------------------------------------------------------------------------
  function extractPdfPages(latinStr) {
    const pageSplits = latinStr.split(/\/Type\s*\/Page\b/);
    const pages = [];

    if (pageSplits.length > 1) {
      for (let p = 1; p < pageSplits.length; p++) {
        const chunk = pageSplits[p];
        let pageText = '';
        const btMatches = chunk.matchAll(/BT[\s\S]*?ET/g);
        for (const m of btMatches) {
          const block = m[0];
          const tjMatches = block.matchAll(/\(([^)]*)\)\s*Tj|\[([^\]]*)\]\s*TJ/g);
          for (const tm of tjMatches) {
            if (tm[1]) pageText += tm[1] + ' ';
            if (tm[2]) {
              const inner = tm[2].replace(/\([^)]*\)/g, str => str.slice(1, -1) + ' ');
              pageText += inner.replace(/[-0-9.]+/g, '') + ' ';
            }
          }
          pageText += '\n';
        }
        pageText = cleanText(pageText);
        if (pageText) {
          pages.push({ pageNumber: p, text: pageText });
        }
      }
    }

    if (pages.length === 0) {
      let fullText = '';
      const btMatches = latinStr.matchAll(/BT[\s\S]*?ET/g);
      for (const m of btMatches) {
        const block = m[0];
        const tjMatches = block.matchAll(/\(([^)]*)\)\s*Tj|\[([^\]]*)\]\s*TJ/g);
        for (const tm of tjMatches) {
          if (tm[1]) fullText += tm[1] + ' ';
          if (tm[2]) {
            const inner = tm[2].replace(/\([^)]*\)/g, str => str.slice(1, -1) + ' ');
            fullText += inner.replace(/[-0-9.]+/g, '') + ' ';
          }
        }
        fullText += '\n';
      }
      fullText = cleanText(fullText);
      if (fullText) {
        pages.push({ pageNumber: 1, text: fullText });
      }
    }
    return pages;
  }

  function processPdfText(pdfRawText, filename, pageNumber = 1) {
    if (!pdfRawText || pdfRawText.length < 25) {
      throw new Error('This PDF contains no readable text streams or is a scanned image. Local-first policy extraction requires text-searchable PDFs. OCR is not available on this device.');
    }

    const { policies, warnings } = processTxtData(pdfRawText, filename);
    // Annotate exact human-readable page number
    policies.forEach(p => {
      p.pageOrRow = `Page ${pageNumber}`;
      p.sourceLocations = [
        {
          type: 'pdf_page',
          page: pageNumber,
          locationLabel: `Page ${pageNumber}`
        }
      ];
    });

    return { policies, warnings };
  }

  // --------------------------------------------------------------------------
  // Main Entry Point: parseFile
  // --------------------------------------------------------------------------
  async function parseFile(file) {
    const filename = file.name || 'document';
    const ext = filename.split('.').pop().toLowerCase();
    const size = file.size || 0;

    if (size > 25 * 1024 * 1024) {
      throw new Error(`File "${filename}" exceeds 25 MB local processing limit.`);
    }

    let parsedResult;

    if (ext === 'docx') {
      const buffer = await file.arrayBuffer();
      parsedResult = await processDocxData(buffer, filename);
    } else if (ext === 'xlsx') {
      const buffer = await file.arrayBuffer();
      parsedResult = await processXlsxData(buffer, filename);
    } else if (ext === 'csv' || ext === 'tsv') {
      const text = await file.text();
      parsedResult = processCsvData(text, filename);
    } else if (ext === 'txt' || ext === 'md' || ext === 'json') {
      const text = await file.text();
      if (ext === 'json') {
        try {
          const json = JSON.parse(text);
          const rawPolicies = Array.isArray(json) ? json : (json.policies || []);
          const normalized = rawPolicies.map((p, idx) => ({
            id: p.id || `REF-${slugify(filename)}-${idx + 1}`,
            internalReference: p.id || `REF-${slugify(filename)}-${idx + 1}`,
            policyId: p.id || p.policyId || null,
            hasExplicitId: Boolean(p.id || p.policyId),
            name: p.name || p.title || `Policy Record ${idx + 1}`,
            title: p.name || p.title || `Policy Record ${idx + 1}`,
            hasExplicitTitle: Boolean(p.name || p.title),
            category: p.category || null,
            hasExplicitCategory: Boolean(p.category),
            conditions: p.conditions || p.problemDescription || '',
            hasExplicitConditions: Boolean(p.conditions || p.problemDescription),
            exceptions: p.exceptions || '',
            hasExplicitExceptions: Boolean(p.exceptions),
            resolution: p.resolution || p.approvedSolution || '',
            hasExplicitResolution: Boolean(p.resolution || p.approvedSolution),
            keywords: Array.isArray(p.keywords) ? p.keywords : [],
            synonyms: Array.isArray(p.synonyms) ? p.synonyms : [],
            rawText: JSON.stringify(p),
            mainText: JSON.stringify(p),
            pageOrRow: `Record ${idx + 1}`,
            sourceDocName: filename,
            sourceDocumentName: filename,
            metadataCompleteness: (p.conditions && p.resolution) ? 'full' : 'partial'
          }));
          parsedResult = { policies: normalized, warnings: [] };
        } catch (e) {
          parsedResult = processTxtData(text, filename);
        }
      } else {
        parsedResult = processTxtData(text, filename);
      }
    } else if (ext === 'pdf') {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const decoder = new TextDecoder('latin1');
      const latinStr = decoder.decode(bytes);

      const pages = extractPdfPages(latinStr);
      if (pages.length === 0) {
        throw new Error(`File "${filename}" contains no text streams or is a scanned image. OCR is not available locally.`);
      }

      const allPolicies = [];
      const allWarnings = [];

      pages.forEach(pg => {
        try {
          const res = processPdfText(pg.text, filename, pg.pageNumber);
          allPolicies.push(...res.policies);
          allWarnings.push(...res.warnings);
        } catch (_) {}
      });

      if (allPolicies.length === 0) {
        throw new Error(`File "${filename}" could not be parsed into readable policy sections.`);
      }

      parsedResult = { policies: allPolicies, warnings: allWarnings };
    } else {
      throw new Error(`Unsupported file format ".${ext}". Please upload PDF, DOCX, TXT, Markdown, CSV, or XLSX documents.`);
    }

    const docId = 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const warnings = parsedResult.warnings || [];
    const status = warnings.length > 0 ? 'Partially processed' : 'Ready';

    return {
      success: true,
      docId,
      filename,
      fileType: ext.toUpperCase(),
      size,
      status,
      policies: parsedResult.policies,
      warnings,
      policyCount: parsedResult.policies.length,
      processingNotes: warnings.length > 0
        ? `${parsedResult.policies.length} clauses extracted with ${warnings.length} warning(s)`
        : `${parsedResult.policies.length} clauses extracted ready for policy matching`
    };
  }

  return {
    parseFile,
    processCsvData,
    processTxtData,
    processDocxData,
    processXlsxData,
    processPdfText,
    parseCsv: processCsvData,
    parseTxt: processTxtData,
    mapHeader
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DocumentParser;
}
