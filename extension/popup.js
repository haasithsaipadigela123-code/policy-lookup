(function () {
  'use strict';

  let policyService = null;
  let customConfig = null;

  const viewLoading = document.getElementById('view-loading');
  const viewMatch = document.getElementById('view-match');
  const viewManualReview = document.getElementById('view-manual-review');
  const viewNoPolicy = document.getElementById('view-no-policy');
  const viewNotTicketPage = document.getElementById('view-not-ticket-page');
  const viewError = document.getElementById('view-error');

  const ticketContextBar = document.getElementById('ticket-context-bar');
  const displayTicketId = document.getElementById('display-ticket-id');
  const displayTicketTitle = document.getElementById('display-ticket-title');

  const ambiguityBanner = document.getElementById('ambiguity-banner');
  const ambiguityText = document.getElementById('ambiguity-text');
  const policyId = document.getElementById('policy-id');
  const policyReference = document.getElementById('policy-reference');
  const policyConfidence = document.getElementById('policy-confidence');
  const policyName = document.getElementById('policy-name');
  const policyResolution = document.getElementById('policy-resolution');
  const exceptionBanner = document.getElementById('exception-banner');
  const exceptionText = document.getElementById('exception-text');
  const matchExplanation = document.getElementById('match-explanation');
  const explanationText = document.getElementById('explanation-text');
  const btnOpenImporter = document.getElementById('btn-open-importer');

  const manualReviewReason = document.getElementById('manual-review-reason');
  const manualReviewDetails = document.getElementById('manual-review-details');

  const noPolicyReason = document.getElementById('no-policy-reason');

  const runnerUpCard = document.getElementById('runner-up-card');
  const runnerUpId = document.getElementById('runner-up-id');
  const runnerUpName = document.getElementById('runner-up-name');

  const manualTitle = document.getElementById('manual-title');
  const manualDesc = document.getElementById('manual-desc');
  const btnEvaluateManual = document.getElementById('btn-evaluate-manual');

  const cfgDomain = document.getElementById('cfg-domain');
  const cfgTitle = document.getElementById('cfg-title');
  const cfgDesc = document.getElementById('cfg-desc');
  const btnSaveConfig = document.getElementById('btn-save-config');

  const errorMessage = document.getElementById('error-message');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnRetry = document.getElementById('btn-retry');

  function showView(activeView) {
    [viewLoading, viewMatch, viewManualReview, viewNoPolicy, viewNotTicketPage, viewError].forEach(view => {
      if (view) {
        if (view === activeView) {
          view.classList.remove('hidden');
        } else {
          view.classList.add('hidden');
        }
      }
    });
  }

  async function init() {
    showView(viewLoading);

    try {
      if (!policyService) {
        const { PolicyService } = window.PolicyServiceModule || {};
        if (!PolicyService) {
          throw new Error('PolicyService module unavailable.');
        }
        policyService = new PolicyService();
      }

      if (chrome.storage && chrome.storage.local) {
        const stored = await chrome.storage.local.get(['customConfig']);
        if (stored && stored.customConfig) {
          customConfig = stored.customConfig;
          if (cfgDomain && customConfig.domain) cfgDomain.value = customConfig.domain;
          if (cfgTitle && customConfig.titleSelector) cfgTitle.value = customConfig.titleSelector;
          if (cfgDesc && customConfig.descSelector) cfgDesc.value = customConfig.descSelector;
        }
      }

      await inspectCurrentTab();
    } catch (err) {
      console.error('[Popup] Init error:', err);
      showErrorState(err.message || 'Initialization failed.');
    }
  }

  async function inspectCurrentTab() {
    showView(viewLoading);

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs && tabs[0];

      if (!currentTab || !currentTab.id || !currentTab.url) {
        showNotTicketPageState();
        return;
      }

      if (currentTab.url.startsWith('chrome://') || currentTab.url.startsWith('edge://') || currentTab.url.startsWith('chrome-extension://')) {
        showNotTicketPageState();
        return;
      }

      try {
        await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          files: ['extractor.js', 'content.js']
        });
      } catch (injectErr) {
        console.warn('[Popup] Injection note:', injectErr.message);
      }

      chrome.tabs.sendMessage(currentTab.id, { action: 'EXTRACT_TICKET', customConfig }, (response) => {
        if (chrome.runtime.lastError || !response) {
          console.warn('[Popup] Content script response:', chrome.runtime.lastError ? chrome.runtime.lastError.message : 'No response');
          showNotTicketPageState();
        } else {
          handleExtractionResult(response);
        }
      });
    } catch (err) {
      console.error('[Popup] Tab inspection error:', err);
      showErrorState(err.message);
    }
  }

  async function handleExtractionResult(response) {
    if (!response || !response.success || !response.ticket) {
      showNotTicketPageState();
      return;
    }

    const ticket = response.ticket;
    evaluateTicket(ticket);
  }

  async function evaluateTicket(ticket) {
    if (ticketContextBar) {
      ticketContextBar.classList.remove('hidden');
      if (displayTicketId) displayTicketId.textContent = ticket.id || 'TICKET';
      if (displayTicketTitle) displayTicketTitle.textContent = ticket.title || '(No Subject)';
    }

    try {
      const policies = await policyService.getPolicies();
      const { PolicyMatcher } = window;
      if (!PolicyMatcher || typeof PolicyMatcher.matchTicket !== 'function') {
        throw new Error('Matching engine unavailable.');
      }

      const result = PolicyMatcher.matchTicket(ticket, policies);

      if (result.status === 'MANUAL_REVIEW_REQUIRED') {
        renderManualReviewView(result);
      } else if (result.matched && result.topMatch) {
        renderMatchView(result);
      } else {
        renderNoPolicyView(ticket, result);
      }
    } catch (err) {
      showErrorState(err.message);
    }
  }

  function renderMatchView(result) {
    const { topMatch, runnerUp, isAmbiguous, ambiguityWarning, explanation } = result;

    if (ambiguityBanner) {
      if (isAmbiguous) {
        ambiguityBanner.classList.remove('hidden');
        if (ambiguityText) ambiguityText.textContent = ambiguityWarning || 'Multiple policies match.';
      } else {
        ambiguityBanner.classList.add('hidden');
      }
    }

    if (policyId) policyId.textContent = topMatch.id;
    if (policyReference) policyReference.textContent = topMatch.category || 'General';
    if (policyConfidence) policyConfidence.textContent = (explanation && explanation.confidence) || 'Standard';
    if (policyName) policyName.textContent = topMatch.name;

    if (policyResolution) {
      if (topMatch.resolution) {
        policyResolution.textContent = topMatch.resolution;
        policyResolution.classList.remove('hidden');
      } else {
        policyResolution.classList.add('hidden');
      }
    }

    if (exceptionBanner && exceptionText) {
      if (topMatch.exceptionTriggered && topMatch.matchedExceptions && topMatch.matchedExceptions.length > 0) {
        exceptionText.textContent = topMatch.matchedExceptions.join('; ');
        exceptionBanner.classList.remove('hidden');
      } else {
        exceptionBanner.classList.add('hidden');
      }
    }

    if (matchExplanation && explanationText && explanation) {
      const details = [];
      if (explanation.matchedPhrases && explanation.matchedPhrases.length > 0) {
        details.push(`Phrases: ${explanation.matchedPhrases.join(', ')}`);
      }
      if (explanation.matchedKeywords && explanation.matchedKeywords.length > 0) {
        details.push(`Keywords: ${explanation.matchedKeywords.slice(0, 4).join(', ')}`);
      }
      if (explanation.decisionRationale) {
        details.push(explanation.decisionRationale);
      }
      explanationText.textContent = details.join(' | ');
      matchExplanation.classList.remove('hidden');
    }

    if (runnerUpCard) {
      if (isAmbiguous && runnerUp) {
        runnerUpCard.classList.remove('hidden');
        if (runnerUpId) runnerUpId.textContent = runnerUp.id;
        if (runnerUpName) runnerUpName.textContent = runnerUp.name;
      } else {
        runnerUpCard.classList.add('hidden');
      }
    }

    showView(viewMatch);
  }

  function renderManualReviewView(result) {
    if (manualReviewReason) {
      manualReviewReason.textContent = result.message || 'Contradictory evidence detected in ticket.';
    }
    if (manualReviewDetails) {
      const rationale = result.explanation && result.explanation.decisionRationale ? result.explanation.decisionRationale : (result.reason || '');
      manualReviewDetails.textContent = rationale;
    }
    showView(viewManualReview);
  }

  function renderNoPolicyView(ticket, result) {
    if (noPolicyReason) {
      noPolicyReason.textContent = result && result.reason ? result.reason : 'No matching policy found.';
    }
    showView(viewNoPolicy);
  }

  function showNotTicketPageState() {
    if (ticketContextBar) ticketContextBar.classList.add('hidden');
    showView(viewNotTicketPage);
  }

  function showErrorState(msg) {
    if (ticketContextBar) ticketContextBar.classList.add('hidden');
    if (errorMessage) errorMessage.textContent = msg || 'An error occurred.';
    showView(viewError);
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      inspectCurrentTab();
    });
  }

  if (btnRetry) {
    btnRetry.addEventListener('click', () => {
      init();
    });
  }

  if (btnEvaluateManual) {
    btnEvaluateManual.addEventListener('click', () => {
      const t = manualTitle ? manualTitle.value.trim() : '';
      const d = manualDesc ? manualDesc.value.trim() : '';
      if (!t && !d) {
        alert('Please enter a ticket title or description.');
        return;
      }
      evaluateTicket({ id: 'MANUAL', title: t, description: d });
    });
  }

  if (btnSaveConfig) {
    btnSaveConfig.addEventListener('click', async () => {
      const newConfig = {
        domain: (cfgDomain ? cfgDomain.value.trim() : ''),
        titleSelector: (cfgTitle ? cfgTitle.value.trim() : ''),
        descSelector: (cfgDesc ? cfgDesc.value.trim() : '')
      };

      customConfig = newConfig;

      if (chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ customConfig: newConfig });
      }

      inspectCurrentTab();
    });
  }

  if (btnOpenImporter) {
    btnOpenImporter.addEventListener('click', () => {
      if (chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: chrome.runtime.getURL('importer.html') });
      } else {
        window.open('importer.html', '_blank');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
