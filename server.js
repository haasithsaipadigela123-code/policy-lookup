/**
 * Policy Lookup — Local Node.js Application Server
 * Serves the web portal and provides optional ML / API endpoints.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');

// Load local engines for server-side processing
const TfIdfEngine = require('./app/js/tfidf.js');
const LocalClassifier = require('./app/js/classifier.js');
global.TfIdfEngine = TfIdfEngine;
global.LocalClassifier = LocalClassifier;
const PolicyEngine = require('./app/js/engine.js');
const DocumentParser = require('./app/js/document-parser.js');
const ServerRetriever = require('./app/js/server-retriever.js');

const PORT = parseInt(process.env.PORT || '3000', 10);
const APP_DIR = path.join(__dirname, 'app');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(res, statusCode, data) {
  if (res.headersSent) return;
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data, null, 2));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) { // 50MB limit
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

function runPythonML(ticket, policies) {
  return new Promise((resolve) => {
    const pythonScript = path.join(__dirname, 'ml', 'policy_ml.py');
    const py = spawn('python', [pythonScript]);

    let stdout = '';
    let stderr = '';

    py.stdout.on('data', d => { stdout += d.toString(); });
    py.stderr.on('data', d => { stderr += d.toString(); });

    py.on('close', code => {
      if (code === 0 && stdout.trim()) {
        try {
          const res = JSON.parse(stdout);
          return resolve({ success: true, engine: 'python-scikit-learn', ...res });
        } catch (e) {
          // parse failed
        }
      }
      // If Python failed or not found, fall back to Node.js engine
      const fallback = PolicyEngine.matchTicket(ticket, policies);
      resolve({
        success: true,
        engine: 'node-fallback',
        warning: `Python ML returned code ${code}: ${stderr.trim() || 'unknown error'}`,
        ...fallback
      });
    });

    py.on('error', (err) => {
      const fallback = PolicyEngine.matchTicket(ticket, policies);
      resolve({
        success: true,
        engine: 'node-fallback',
        warning: `Python execution error: ${err.message}`,
        ...fallback
      });
    });

    const payload = JSON.stringify({ ticket, policies });
    py.stdin.write(payload);
    py.stdin.end();
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // API ROUTE: Server Status
  if (pathname === '/api/status' && req.method === 'GET') {
    return sendJson(res, 200, {
      status: 'active',
      server: 'Node.js ' + process.version,
      platform: process.platform,
      port: PORT,
      features: ['local-first-storage', 'hybrid-tfidf', 'naive-bayes', 'python-scikit-learn-bridge']
    });
  }

  // API ROUTE: Analyze Ticket (Deterministic + TF-IDF)
  if (pathname === '/api/analyze' && req.method === 'POST') {
    try {
      const { ticket, policies } = await parseJsonBody(req);
      if (!ticket) {
        return sendJson(res, 400, { error: 'Missing ticket object' });
      }
      const result = PolicyEngine.matchTicket(ticket, policies || []);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // API ROUTE: ML Classify via Python scikit-learn
  if (pathname === '/api/ml-classify' && req.method === 'POST') {
    try {
      const { ticket, policies } = await parseJsonBody(req);
      const result = await runPythonML(ticket, policies || []);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // API ROUTE: Server-side Ticket & URL Retrieval (SSRF-Protected Strategy B)
  if ((pathname === '/api/ticket/retrieve' || pathname === '/api/retrieve-ticket') && req.method === 'POST') {
    try {
      const { url: targetUrl } = await parseJsonBody(req);
      const val = ServerRetriever.validateUrl(targetUrl);
      if (!val.valid) {
        return sendJson(res, 400, {
          success: false,
          url: targetUrl || '',
          classification: val.reason,
          failureReason: val.reason,
          fallbackAction: 'CHECK_URL',
          error: val.error,
          suggestion: 'Please verify the ticket URL format. Only public HTTP and HTTPS links can be retrieved.'
        });
      }

      let fetchResult;
      try {
        fetchResult = await ServerRetriever.safeOutboundFetch(targetUrl);
      } catch (fetchErr) {
        const isSsrf = fetchErr.code === 'SSRF_BLOCKED';
        return sendJson(res, 200, {
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
        });
      }

      // Pluggable adapter check for specific platforms
      let platform = 'generic';
      try {
        const TicketRetrieverModule = require('./app/js/ticket-retriever.js');
        const adapter = TicketRetrieverModule.getAdapter(fetchResult.finalUrl);
        if (adapter) platform = adapter.name;
      } catch (_) {}

      // Classify and extract structured content
      const extraction = ServerRetriever.classifyAndExtract(
        fetchResult.body,
        fetchResult.finalUrl,
        fetchResult.statusCode,
        fetchResult.contentType
      );

      const isSuccess = extraction.ticketContentExtracted || extraction.classification === 'PAGE_RETRIEVED';

      return sendJson(res, 200, {
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
      });

    } catch (err) {
      return sendJson(res, 500, {
        success: false,
        classification: 'SERVER_ERROR',
        failureReason: 'SERVER_ERROR',
        fallbackAction: 'SWITCH_TO_DESCRIPTION',
        error: `Internal retrieval error: ${err.message}`
      });
    }
    return;
  }

  // Static File Serving
  let filePath = path.join(APP_DIR, pathname === '/' ? 'index.html' : pathname);

  // Security check: prevent directory traversal
  if (!filePath.startsWith(APP_DIR)) {
    res.writeHead(403);
    return res.end('Access denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for client-side routing
      const indexPath = path.join(APP_DIR, 'index.html');
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('404 Not Found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Error loading file');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

const HOST = process.env.HOST || '0.0.0.0';

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`=======================================================`);
    console.log(` Policy Lookup Portal running at:`);
    console.log(` > Local:   http://localhost:${PORT}`);
    console.log(` > API:     http://localhost:${PORT}/api/status`);
    console.log(` > Python:  Connected via ml/policy_ml.py (scikit-learn)`);
    console.log(`=======================================================`);
  });
}

module.exports = server;
