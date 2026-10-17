module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    status: 'active',
    server: 'Vercel Serverless Function',
    platform: process.platform,
    features: [
      'local-first-storage',
      'hybrid-tfidf',
      'naive-bayes',
      'serverless-retriever'
    ]
  }, null, 2));
};
