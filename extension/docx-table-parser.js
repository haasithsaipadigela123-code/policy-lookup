(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const JSZip = require('jszip');
    const { DOMParser } = require('@xmldom/xmldom');
    module.exports = factory(JSZip, DOMParser);
  } else {
    root.DocxTableParser = factory(root.JSZip, root.DOMParser);
  }
})(typeof self !== 'undefined' ? self : this, function (JSZip, DOMParserClass) {
  'use strict';

  function cleanCellText(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').trim();
  }

  function normalizeHeaderKey(header) {
    if (!header || typeof header !== 'string') return '';
    return header.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  const HEADER_ALIASES = {
    id: [
      'id', 'policyid', 'policycode', 'policynumber', 'policyno', 'polno', 'polcode',
      'ref', 'policyref', 'reference', 'item', 'itemno', 'code', 'pid', 'num', 'ruleid'
    ],
    name: [
      'name', 'policyname', 'title', 'policytitle', 'topic', 'subject', 'policysubject',
      'policy', 'polname', 'heading', 'issue', 'rulename'
    ],
    category: [
      'category', 'cat', 'department', 'dept', 'domain', 'area', 'classification',
      'type', 'group', 'division', 'module', 'system'
    ],
    conditions: [
      'conditions', 'condition', 'cond', 'conds', 'scope', 'appliesto', 'applies',
      'applicability', 'whenapplicable', 'prerequisites', 'trigger', 'criteria',
      'symptoms', 'problem', 'problemdescription', 'description', 'desc', 'scenario'
    ],
    exceptions: [
      'exceptions', 'exception', 'exc', 'excl', 'exclusions', 'exclusion', 'notcovered',
      'notapplicable', 'specialcases', 'escalation', 'restrictions', 'outcomes', 'override'
    ],
    resolution: [
      'resolution', 'res', 'approvedsolution', 'solution', 'procedure', 'action',
      'remediation', 'steps', 'instructions', 'instr', 'standardoperatingprocedure',
      'sop', 'guidance', 'outcome', 'fix', 'workflow', 'troubleshooting'
    ],
    keywords: [
      'keywords', 'kw', 'tags', 'searchterms', 'keyterms', 'phrases', 'signals'
    ],
    synonyms: [
      'synonyms', 'syn', 'alternativeterms', 'aliases', 'colloquialterms', 'colloquial'
    ]
  };

  function mapHeadersToFields(headers) {
    const mapping = {};
    const unmappedHeaders = [];

    headers.forEach((h, colIndex) => {
      const norm = normalizeHeaderKey(h);
      let matchedCanonical = null;

      for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
        if (aliases.includes(norm)) {
          matchedCanonical = canonical;
          break;
        }
      }

      if (matchedCanonical) {
        if (!mapping[matchedCanonical]) {
          mapping[matchedCanonical] = { colIndex, originalHeader: h };
        } else {
          unmappedHeaders.push({ colIndex, originalHeader: h, note: `Duplicate candidate for ${matchedCanonical}` });
        }
      } else {
        unmappedHeaders.push({ colIndex, originalHeader: h, note: 'Custom / domain-specific column' });
      }
    });

    return { mapping, unmappedHeaders };
  }

  function extractCellInfo(tcNode) {
    let paraText = '';
    const paragraphs = [];
    let vMerge = null;
    let gridSpan = 1;

    for (let i = 0; i < tcNode.childNodes.length; i++) {
      const child = tcNode.childNodes[i];
      const localName = child.localName || child.nodeName.split(':').pop();

      if (localName === 'tcPr') {
        for (let j = 0; j < child.childNodes.length; j++) {
          const prChild = child.childNodes[j];
          const prName = prChild.localName || prChild.nodeName.split(':').pop();

          if (prName === 'vMerge') {
            const val = prChild.getAttribute ? (prChild.getAttribute('w:val') || prChild.getAttribute('val')) : null;
            if (val === 'restart') {
              vMerge = 'restart';
            } else {
              vMerge = 'continue';
            }
          } else if (prName === 'gridSpan') {
            const val = prChild.getAttribute ? (prChild.getAttribute('w:val') || prChild.getAttribute('val')) : null;
            const parsed = parseInt(val, 10);
            if (!isNaN(parsed) && parsed > 1) {
              gridSpan = parsed;
            }
          }
        }
      } else if (localName === 'p') {
        let pText = '';
        function walkText(node) {
          if (!node) return;
          const lName = node.localName || node.nodeName.split(':').pop();
          if (lName === 't') {
            pText += node.textContent || '';
          }
          if (node.childNodes) {
            for (let k = 0; k < node.childNodes.length; k++) {
              walkText(node.childNodes[k]);
            }
          }
        }
        walkText(child);
        const cleaned = cleanCellText(pText);
        if (cleaned) {
          paragraphs.push(cleaned);
        }
      }
    }

    paraText = paragraphs.join('\n');
    return {
      text: paraText,
      vMerge,
      gridSpan
    };
  }

  function extractCellContent(tcNode) {
    return extractCellInfo(tcNode).text;
  }

  async function parseDocxTables(fileData, options = {}) {
    const report = {
      timestamp: new Date().toISOString(),
      tablesFound: 0,
      tablesProcessed: 0,
      totalRowsExamined: 0,
      policiesExtracted: 0,
      continuationRowsAttached: [],
      skippedRows: [],
      structuralWarnings: [],
      unmappedColumns: [],
      validationErrors: []
    };

    if (!fileData) {
      throw new Error('No DOCX file data provided for parsing.');
    }

    const zip = new JSZip();
    let loadedZip;
    try {
      loadedZip = await zip.loadAsync(fileData);
    } catch (zipErr) {
      throw new Error(`Failed to read DOCX file as ZIP archive: ${zipErr.message}`);
    }

    const docXmlFile = loadedZip.file('word/document.xml');
    if (!docXmlFile) {
      throw new Error('Invalid DOCX format: word/document.xml not found in archive.');
    }

    const xmlContent = await docXmlFile.async('string');
    const parser = new DOMParserClass();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    const parserErrors = xmlDoc.getElementsByTagName('parsererror');
    if (parserErrors && parserErrors.length > 0) {
      const errText = parserErrors[0].textContent || 'Unknown XML parsing error';
      throw new Error(`XML parsing failed on word/document.xml: ${errText}`);
    }

    const tblNodes = [];
    const allElements = xmlDoc.getElementsByTagName('*');
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      const localName = el.localName || el.nodeName.split(':').pop();
      if (localName === 'tbl') {
        tblNodes.push(el);
      }
    }

    report.tablesFound = tblNodes.length;

    if (tblNodes.length === 0) {
      report.structuralWarnings.push('No tables (<w:tbl>) found in the provided document.');
      return {
        success: false,
        policies: [],
        metadata: { source: 'docx', disclaimer: 'NO_TABLES_FOUND' },
        report
      };
    }

    const extractedPolicies = [];
    const seenPolicyIds = new Map();

    tblNodes.forEach((tbl, tableIndex) => {
      const tableNumber = tableIndex + 1;
      const trNodes = [];

      for (let i = 0; i < tbl.childNodes.length; i++) {
        const child = tbl.childNodes[i];
        const localName = child.localName || child.nodeName.split(':').pop();
        if (localName === 'tr') {
          trNodes.push(child);
        }
      }

      if (trNodes.length === 0) {
        report.structuralWarnings.push(`Table #${tableNumber} contains no rows (<w:tr>). Skipped.`);
        return;
      }

      report.tablesProcessed++;

      const headerRow = trNodes[0];
      const headerCells = [];
      for (let i = 0; i < headerRow.childNodes.length; i++) {
        const child = headerRow.childNodes[i];
        const localName = child.localName || child.nodeName.split(':').pop();
        if (localName === 'tc') {
          headerCells.push(child);
        }
      }

      if (headerCells.length === 0) {
        report.structuralWarnings.push(`Table #${tableNumber} has empty header row. Skipped.`);
        return;
      }

      const rawHeaders = [];
      headerCells.forEach((tc, idx) => {
        const info = extractCellInfo(tc);
        const text = info.text || `Column_${idx + 1}`;
        rawHeaders.push(text);
        if (info.gridSpan > 1) {
          for (let g = 1; g < info.gridSpan; g++) {
            rawHeaders.push(`${text}_Part${g + 1}`);
          }
        }
      });

      const { mapping, unmappedHeaders } = mapHeadersToFields(rawHeaders);
      if (unmappedHeaders.length > 0) {
        report.unmappedColumns.push({
          tableNumber,
          columns: unmappedHeaders
        });
      }

      const activeVMerges = new Map();
      let lastPolicyRecord = null;

      for (let r = 1; r < trNodes.length; r++) {
        const rowNode = trNodes[r];
        const rowNumber = r + 1;
        report.totalRowsExamined++;

        const cellNodes = [];
        for (let i = 0; i < rowNode.childNodes.length; i++) {
          const child = rowNode.childNodes[i];
          const localName = child.localName || child.nodeName.split(':').pop();
          if (localName === 'tc') {
            cellNodes.push(child);
          }
        }

        if (cellNodes.length === 0) {
          report.skippedRows.push({
            tableNumber,
            rowNumber,
            reason: 'Row has no cells'
          });
          continue;
        }

        const cellValues = [];
        let gridCol = 0;

        cellNodes.forEach(tc => {
          const info = extractCellInfo(tc);
          let cellText = info.text;

          if (info.vMerge === 'restart') {
            activeVMerges.set(gridCol, cellText);
          } else if (info.vMerge === 'continue') {
            cellText = activeVMerges.get(gridCol) || cellText || '';
          } else {
            activeVMerges.delete(gridCol);
          }

          cellValues[gridCol] = cellText;
          if (info.gridSpan > 1) {
            for (let g = 1; g < info.gridSpan; g++) {
              cellValues[gridCol + g] = '';
            }
            gridCol += info.gridSpan;
          } else {
            gridCol++;
          }
        });

        const isCompletelyEmpty = cellValues.every(val => !val || !val.trim());
        if (isCompletelyEmpty) {
          report.skippedRows.push({
            tableNumber,
            rowNumber,
            reason: 'Row is completely blank'
          });
          continue;
        }

        if (cellValues.length < rawHeaders.length) {
          report.structuralWarnings.push(
            `Table #${tableNumber}, Row #${rowNumber}: Expected ${rawHeaders.length} cells, found ${cellValues.length}. Missing trailing cells filled with empty string.`
          );
        } else if (cellValues.length > rawHeaders.length) {
          report.structuralWarnings.push(
            `Table #${tableNumber}, Row #${rowNumber}: Found ${cellValues.length} cells but header has ${rawHeaders.length}. Extra cells preserved in allColumns.`
          );
        }

        const allColumns = {};
        rawHeaders.forEach((h, idx) => {
          allColumns[h] = cellValues[idx] || '';
        });
        if (cellValues.length > rawHeaders.length) {
          for (let extraIdx = rawHeaders.length; extraIdx < cellValues.length; extraIdx++) {
            allColumns[`Extra_Column_${extraIdx + 1}`] = cellValues[extraIdx];
          }
        }

        function getField(canonicalKey) {
          if (mapping[canonicalKey] && mapping[canonicalKey].colIndex < cellValues.length) {
            return (cellValues[mapping[canonicalKey].colIndex] || '').trim();
          }
          return '';
        }

        let policyId = getField('id');
        let policyName = getField('name');
        const category = getField('category') || 'General';
        const conditions = getField('conditions');
        const exceptions = getField('exceptions');
        const resolution = getField('resolution');
        const keywordsField = getField('keywords');
        const synonymsField = getField('synonyms');

        if (!policyId && !policyName && lastPolicyRecord) {
          const hasContinuationContent = !!(conditions || exceptions || resolution);
          if (hasContinuationContent) {
            if (resolution) {
              lastPolicyRecord.resolution = (lastPolicyRecord.resolution + '\n' + resolution).trim();
              lastPolicyRecord.approvedSolution = lastPolicyRecord.resolution;
            }
            if (conditions) {
              lastPolicyRecord.conditions = (lastPolicyRecord.conditions + '\n' + conditions).trim();
              lastPolicyRecord.problemDescription = lastPolicyRecord.conditions;
            }
            if (exceptions) {
              lastPolicyRecord.exceptions = (lastPolicyRecord.exceptions + '\n' + exceptions).trim();
            }
            report.continuationRowsAttached.push({
              tableNumber,
              rowNumber,
              targetPolicyId: lastPolicyRecord.id
            });
            continue;
          }
        }

        let isReliable = true;
        let requiresManualReview = false;
        let structuralAmbiguityReason = null;

        if (!policyId) {
          policyId = `POL-TBL${tableNumber}-ROW${rowNumber}`;
          isReliable = false;
          requiresManualReview = true;
          structuralAmbiguityReason = `Missing Policy ID in Table #${tableNumber}, Row #${rowNumber}`;
          report.structuralWarnings.push(structuralAmbiguityReason);
        }

        if (!policyName) {
          policyName = conditions ? conditions.slice(0, 60) : `Policy T${tableNumber}-R${rowNumber}`;
          if (!structuralAmbiguityReason) {
            isReliable = false;
            requiresManualReview = true;
            structuralAmbiguityReason = `Missing Policy Name in Table #${tableNumber}, Row #${rowNumber}`;
          }
          report.structuralWarnings.push(
            `Table #${tableNumber}, Row #${rowNumber}: Missing Policy Name. Derived fallback: "${policyName}"`
          );
        }

        if (seenPolicyIds.has(policyId)) {
          const original = seenPolicyIds.get(policyId);
          report.validationErrors.push(
            `Duplicate Policy ID "${policyId}" found at Table #${tableNumber}, Row #${rowNumber}. Original was at Table #${original.tableNumber}, Row #${original.rowNumber}.`
          );
          policyId = `${policyId}-T${tableNumber}R${rowNumber}`;
          requiresManualReview = true;
        }
        seenPolicyIds.set(policyId, { tableNumber, rowNumber });

        let keywords = [];
        if (keywordsField) {
          keywords = keywordsField.split(/[,;\n]+/).map(k => k.trim()).filter(Boolean);
        }
        if (keywords.length === 0) {
          const nameTokens = policyName.split(/[\s,/-]+/).map(k => k.trim().toLowerCase()).filter(k => k.length > 2);
          keywords = Array.from(new Set(nameTokens));
        }

        let synonyms = [];
        if (synonymsField) {
          synonyms = synonymsField.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
        }

        let stepByStepInstructions = [];
        if (resolution) {
          const lines = resolution.split('\n').map(l => l.trim()).filter(Boolean);
          if (lines.length > 1) {
            stepByStepInstructions = lines;
          }
        }

        const policyRecord = {
          id: policyId,
          name: policyName,
          category,
          problemDescription: conditions,
          conditions,
          exceptions,
          resolution,
          approvedSolution: resolution || 'See policy document for details.',
          stepByStepInstructions,
          keywords,
          synonyms,
          allColumns,
          isReliable,
          requiresManualReview,
          structuralAmbiguityReason,
          sourceMeta: {
            tableIndex: tableNumber,
            rowIndex: rowNumber,
            documentSource: options.filename || 'uploaded_document.docx'
          }
        };

        extractedPolicies.push(policyRecord);
        lastPolicyRecord = policyRecord;
        report.policiesExtracted++;
      }
    });

    const isValid = extractedPolicies.length > 0 && report.validationErrors.length === 0;

    return {
      success: extractedPolicies.length > 0,
      isValid,
      policies: extractedPolicies,
      metadata: {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        sourceFile: options.filename || 'imported.docx',
        policiesCount: extractedPolicies.length,
        disclaimer: options.isFictionalSample 
          ? 'FICTIONAL TEST CONTENT - For prototype demonstration and testing purposes only.' 
          : 'ORGANIZATIONAL POLICIES - Imported from company Word document table structure.'
      },
      report
    };
  }

  function validatePolicyData(data) {
    const errors = [];
    const warnings = [];

    const policies = Array.isArray(data) ? data : (data && Array.isArray(data.policies) ? data.policies : null);

    if (!policies) {
      errors.push('Input data is not an array of policies and has no "policies" property.');
      return { valid: false, errors, warnings };
    }

    if (policies.length === 0) {
      warnings.push('Policy list is empty.');
    }

    const idSet = new Set();

    policies.forEach((p, idx) => {
      const pos = `Policy #${idx + 1}`;
      if (!p || typeof p !== 'object') {
        errors.push(`${pos} is not an object.`);
        return;
      }

      if (!p.id || typeof p.id !== 'string' || !p.id.trim()) {
        errors.push(`${pos} is missing a valid string 'id'.`);
      } else {
        if (idSet.has(p.id.trim())) {
          errors.push(`${pos} has duplicate 'id': "${p.id.trim()}".`);
        }
        idSet.add(p.id.trim());
      }

      if (!p.name || typeof p.name !== 'string' || !p.name.trim()) {
        errors.push(`${pos} is missing a valid string 'name'.`);
      }

      if (!p.allColumns || typeof p.allColumns !== 'object') {
        warnings.push(`${pos} (${p.id || 'unnamed'}) does not preserve 'allColumns' mapping.`);
      }

      if (!p.resolution && !p.approvedSolution) {
        warnings.push(`${pos} (${p.id || 'unnamed'}) does not have a resolution or approvedSolution.`);
      }

      if (p.requiresManualReview) {
        warnings.push(`${pos} (${p.id || 'unnamed'}) flagged for manual review: ${p.structuralAmbiguityReason || 'Structural ambiguity'}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      count: policies.length
    };
  }

  return {
    parseDocxTables,
    validatePolicyData,
    HEADER_ALIASES,
    mapHeadersToFields,
    cleanCellText,
    extractCellInfo,
    extractCellContent
  };
});
