(function () {
  'use strict';

  if (window.__TICKET_CONTENT_SCRIPT_INITIALIZED__) {
    return;
  }
  window.__TICKET_CONTENT_SCRIPT_INITIALIZED__ = true;

  const { TicketExtractorEngine } = window.TicketExtractor || {};
  const extractor = TicketExtractorEngine ? new TicketExtractorEngine() : null;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'PING') {
      sendResponse({ status: 'PONG', ready: true });
      return true;
    }

    if (request.action === 'EXTRACT_TICKET') {
      try {
        if (!extractor) {
          sendResponse({
            success: false,
            reason: 'EXTRACTOR_UNAVAILABLE',
            message: 'Ticket extraction engine not loaded.'
          });
          return true;
        }

        if (request.customConfig) {
          extractor.setCustomConfig(request.customConfig);
        }

        const outcome = extractor.extract(document, window.location.href);

        if (outcome.detected && outcome.ticket) {
          sendResponse({
            success: true,
            ticket: outcome.ticket,
            url: window.location.href
          });
        } else {
          sendResponse({
            success: false,
            reason: outcome.reason || 'NO_TICKET_FOUND',
            message: outcome.message || 'No support ticket identified on this webpage.',
            url: window.location.href
          });
        }
      } catch (err) {
        sendResponse({
          success: false,
          reason: 'EXTRACTION_ERROR',
          message: err.message
        });
      }
      return true;
    }
  });

})();
