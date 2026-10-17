const TfIdfEngine = require('../app/js/tfidf.js');
const LocalClassifier = require('../app/js/classifier.js');
global.TfIdfEngine = TfIdfEngine;
global.LocalClassifier = LocalClassifier;
const PolicyEngine = require('../app/js/engine.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
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

    const { ticket, policies } = body || {};
    if (!ticket || !policies || !Array.isArray(policies)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: 'Missing ticket or policies array' }));
    }

    const result = PolicyEngine.matchTicket(ticket, policies);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify(result, null, 2));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: err.message }));
  }
};
