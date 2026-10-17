(function () {
  'use strict';

  let currentParseResult = null;
  let allExtractedPolicies = [];

  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const btnBrowse = document.getElementById('btn-browse');

  const resultsSection = document.getElementById('results-section');
  const metricTables = document.getElementById('metric-tables');
  const metricRows = document.getElementById('metric-rows');
  const metricPolicies = document.getElementById('metric-policies');
  const metricStatus = document.getElementById('metric-status');

  const reportItems = document.getElementById('report-items');
  const actionNotice = document.getElementById('action-notice');

  const btnSaveExtension = document.getElementById('btn-save-extension');
  const btnDownloadJson = document.getElementById('btn-download-json');
  const btnResetDefault = document.getElementById('btn-reset-default');

  const previewCount = document.getElementById('preview-count');
  const previewFilter = document.getElementById('preview-filter');
  const policyTbody = document.getElementById('policy-tbody');

  function init() {
    setupDragDrop();
    setupActions();
    checkExistingImportedPolicies();
  }

  function setupDragDrop() {
    if (btnBrowse && fileInput) {
      btnBrowse.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }

    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
          handleFile(fileInput.files[0]);
        }
      });
    }
  }

  async function handleFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.docx')) {
      alert('Please select a valid Word document (.docx).');
      return;
    }

    showNotice(`Parsing "${file.name}" locally...`, 'info');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const { DocxTableParser } = window;
      if (!DocxTableParser || typeof DocxTableParser.parseDocxTables !== 'function') {
        throw new Error('DocxTableParser engine is not loaded.');
      }

      const result = await DocxTableParser.parseDocxTables(arrayBuffer, {
        filename: file.name,
        isFictionalSample: false
      });

      currentParseResult = result;
      allExtractedPolicies = result.policies || [];

      renderResults(result, file.name);
    } catch (err) {
      console.error('[Importer] Parsing error:', err);
      showNotice(`Error parsing document: ${err.message}`, 'error');
    }
  }

  function renderResults(result, filename) {
    resultsSection.classList.remove('hidden');

    const { report, policies } = result;

    metricTables.textContent = report.tablesProcessed;
    metricRows.textContent = report.totalRowsExamined;
    metricPolicies.textContent = policies.length;

    if (result.isValid) {
      metricStatus.textContent = 'Valid';
      metricStatus.className = 'metric-val status-text valid';
    } else if (report.validationErrors.length > 0) {
      metricStatus.textContent = 'Errors Detected';
      metricStatus.className = 'metric-val status-text error';
    } else {
      metricStatus.textContent = 'With Warnings';
      metricStatus.className = 'metric-val status-text warning';
    }

    reportItems.innerHTML = '';

    const lines = [];
    lines.push({ type: 'info', text: `Successfully processed file: "${filename}" (${policies.length} policies extracted across ${report.tablesProcessed} tables).` });

    if (report.structuralWarnings.length > 0) {
      report.structuralWarnings.forEach(w => lines.push({ type: 'warning', text: `⚠️ Structural Notice: ${w}` }));
    }

    if (report.skippedRows.length > 0) {
      report.skippedRows.forEach(sr => lines.push({ type: 'info', text: `ℹ️ Skipped Row: Table #${sr.tableNumber}, Row #${sr.rowNumber} (${sr.reason})` }));
    }

    if (report.unmappedColumns.length > 0) {
      report.unmappedColumns.forEach(uc => {
        const names = uc.columns.map(c => `"${c.originalHeader}"`).join(', ');
        lines.push({ type: 'info', text: `📋 Preserved Custom Columns (Table #${uc.tableNumber}): ${names}` });
      });
    }

    if (report.validationErrors.length > 0) {
      report.validationErrors.forEach(e => lines.push({ type: 'error', text: `❌ Validation Error: ${e}` }));
    }

    lines.forEach(item => {
      const el = document.createElement('div');
      el.className = `report-item ${item.type}`;
      el.textContent = item.text;
      reportItems.appendChild(el);
    });

    renderTable(policies);
    showNotice(`Extracted ${policies.length} policy records. You can now apply them directly to the extension or download policies.json.`, 'success');
  }

  function renderTable(policies) {
    if (!policyTbody) return;
    policyTbody.innerHTML = '';
    previewCount.textContent = policies.length;

    policies.forEach(p => {
      const tr = document.createElement('tr');

      const cols = p.allColumns || {};
      const colKeys = Object.keys(cols);
      const colTags = colKeys.map(k => `<span class="col-tag" title="${escapeHtml(k)}: ${escapeHtml(cols[k])}">${escapeHtml(k)}</span>`).join(' ');

      tr.innerHTML = `
        <td><span class="badge-id">${escapeHtml(p.id)}</span></td>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td>${escapeHtml(p.conditions || p.problemDescription || '—')}</td>
        <td>${p.exceptions ? escapeHtml(p.exceptions) : '<em>None</em>'}</td>
        <td>${escapeHtml(p.resolution || p.approvedSolution || '—')}</td>
        <td>${colTags || '—'}</td>
      `;

      policyTbody.appendChild(tr);
    });
  }

  function setupActions() {

    if (previewFilter) {
      previewFilter.addEventListener('input', () => {
        const term = previewFilter.value.toLowerCase().trim();
        if (!term) {
          renderTable(allExtractedPolicies);
          return;
        }
        const filtered = allExtractedPolicies.filter(p => {
          return (p.id && p.id.toLowerCase().includes(term)) ||
                 (p.name && p.name.toLowerCase().includes(term)) ||
                 (p.conditions && p.conditions.toLowerCase().includes(term)) ||
                 (p.resolution && p.resolution.toLowerCase().includes(term));
        });
        renderTable(filtered);
      });
    }

    if (btnSaveExtension) {
      btnSaveExtension.addEventListener('click', async () => {
        if (!currentParseResult || !Array.isArray(currentParseResult.policies) || currentParseResult.policies.length === 0) {
          alert('No policies available to apply.');
          return;
        }

        if (chrome && chrome.storage && chrome.storage.local) {
          try {
            await chrome.storage.local.set({
              importedPolicies: currentParseResult.policies,
              importedMetadata: currentParseResult.metadata
            });
            showNotice(`✅ Successfully applied ${currentParseResult.policies.length} policies to the extension! Open your help desk tickets to evaluate with your real policies.`, 'success');
          } catch (storageErr) {
            showNotice(`Failed to save to extension storage: ${storageErr.message}`, 'error');
          }
        } else {
          showNotice('Chrome storage API unavailable in this context. Use "Download policies.json" instead.', 'error');
        }
      });
    }

    if (btnDownloadJson) {
      btnDownloadJson.addEventListener('click', () => {
        if (!currentParseResult || !currentParseResult.policies) {
          alert('No policies to export.');
          return;
        }

        const payload = {
          version: '1.0.0',
          lastUpdated: new Date().toISOString().split('T')[0],
          sourceDocument: (currentParseResult.metadata && currentParseResult.metadata.sourceFile) || 'imported_document.docx',
          disclaimer: 'ORGANIZATIONAL POLICIES - Locally imported from company Word document table structure.',
          policyCount: currentParseResult.policies.length,
          policies: currentParseResult.policies
        };

        const jsonStr = JSON.stringify(payload, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'policies.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    if (btnResetDefault) {
      btnResetDefault.addEventListener('click', async () => {
        if (!confirm('Reset extension to bundled sample policies? This clears any imported Word policies from extension storage.')) {
          return;
        }

        if (chrome && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.remove(['importedPolicies', 'importedMetadata']);
          showNotice('Extension reset to bundled sample policies.', 'info');
        }
      });
    }
  }

  async function checkExistingImportedPolicies() {
    if (chrome && chrome.storage && chrome.storage.local) {
      const stored = await chrome.storage.local.get(['importedPolicies', 'importedMetadata']);
      if (stored && Array.isArray(stored.importedPolicies) && stored.importedPolicies.length > 0) {
        showNotice(`Currently Active: Extension is using ${stored.importedPolicies.length} imported policies from "${(stored.importedMetadata && stored.importedMetadata.sourceFile) || 'Word Document'}".`, 'info');
      }
    }
  }

  function showNotice(msg, type = 'info') {
    if (!actionNotice) return;
    actionNotice.textContent = msg;
    actionNotice.className = `action-notice ${type}`;
    actionNotice.classList.remove('hidden');
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
