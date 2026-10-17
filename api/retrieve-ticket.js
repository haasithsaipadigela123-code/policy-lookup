const ServerRetriever = require('../app/js/server-retriever.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    } else if (!body) {
      body = await new Promise((resolve) => {
        let raw = '';
        req.on('data', chunk => { raw += chunk; });
        req.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch (_) { resolve({}); }
        });
        req.on('error', () => resolve({}));
      });
    }

    const targetUrl = (body && (body.url || body.targetUrl)) ? String(body.url || body.targetUrl).trim() : '';
    if (!targetUrl) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({
        success: false,
        classification: 'MALFORMED_URL',
        failureReason: 'MALFORMED_URL',
        error: 'Missing or empty target URL'
      }));
    }

    let fetchResult;
    try {
      fetchResult = await ServerRetriever.safeOutboundFetch(targetUrl);
    } catch (fetchErr) {
      const isSsrf = fetchErr.code === 'SSRF_BLOCKED';
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({
        success: false,
        url: targetUrl,
        classification: fetchErr.code || 'NETWORK_ERROR',
        failureReason: fetchErr.code || 'NETWORK_ERROR',
        fallbackAction: 'SWITCH_TO_DESCRIPTION',
        error: fetchErr.message,
        suggestion: isSsrf
          ? 'Access to private, loopback, or cloud-metadata destinations is blocked for security.'
          : 'The remote host could not be reached. You can switch to Ticket Description or Conversation to paste the details manually.',
        diagnostics: {
          retrievalMethod: 'local_backend',
          errorDetail: fetchErr.code || 'FETCH_EXCEPTION'
        }
      }));
    }

    let platform = 'generic';
    try {
      const TicketRetrieverModule = require('../app/js/ticket-retriever.js');
      const adapter = TicketRetrieverModule.getAdapter(fetchResult.finalUrl);
      if (adapter) platform = adapter.name;
    } catch (_) {}

    const extraction = ServerRetriever.classifyAndExtract(
      fetchResult.body,
      fetchResult.finalUrl,
      fetchResult.statusCode,
      fetchResult.contentType
    );

    const isSuccess = extraction.ticketContentExtracted || extraction.classification === 'PAGE_RETRIEVED';

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({
      success: isSuccess,
      url: targetUrl,
      finalUrl: fetchResult.finalUrl,
      statusCode: fetchResult.statusCode,
      contentType: fetchResult.contentType,
      classification: extraction.classification,
      pageType: extraction.pageType,
      webpageRetrieved: extraction.webpageRetrieved,
      ticketContentExtracted: extraction.ticketContentExtracted,
      platform: platform,
      ticket: extraction.ticket,
      article: extraction.article,
      fieldsRetrieved: extraction.fieldsRetrieved || [],
      isIncomplete: Boolean(extraction.isIncomplete),
      diagnostics: {
        retrievalMethod: 'local_backend',
        resolvedIps: fetchResult.resolvedIps,
        redirectCount: fetchResult.redirects.length,
        redirectChain: fetchResult.redirects,
        byteSize: fetchResult.byteSize,
        durationMs: fetchResult.durationMs
      },
      error: extraction.error,
      message: extraction.message,
      suggestion: extraction.suggestion,
      fallbackAction: extraction.fallbackAction
    }));

  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({
      success: false,
      classification: 'SERVER_ERROR',
      failureReason: 'SERVER_ERROR',
      fallbackAction: 'SWITCH_TO_DESCRIPTION',
      error: `Internal retrieval error: ${err.message}`
    }));
  }
};
