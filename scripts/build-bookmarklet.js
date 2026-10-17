const fs = require('fs');
const path = require('path');

function minifyJs(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/(;|{|})\s*\/\/.*$/gm, '$1')
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/`\s*([^`]+?)\s*`/g, (m, p1) => {
      const compacted = p1.replace(/\s*([:;{}])\s*/g, '$1').replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
      return '`' + compacted + '`';
    })
    .replace(/\s*([=+\-*\/%&|^!<>?:;,{}()\[\]])\s*/g, '$1')
    .replace(/\b(return|var|let|const|function|typeof|instanceof|throw|new|case|delete|in|of)\s+/g, '$1 ')
    .trim();
}

function buildBookmarklet() {
  const sourcePath = path.join(__dirname, '..', 'bookmarklet', 'bookmarklet.js');
  const outDir = path.join(__dirname, '..', 'bookmarklet');

  if (!fs.existsSync(sourcePath)) {
    console.error(`Source file not found: ${sourcePath}`);
    process.exit(1);
  }

  const rawSource = fs.readFileSync(sourcePath, 'utf8');
  const minified = minifyJs(rawSource);
  const bookmarkletUri = `javascript:${minified}`;
  const intranetLoaderUri = `javascript:(function(){var s=document.createElement('script');s.src='https://intranet.company.local/policy-lookup.js?t='+Date.now();document.body.appendChild(s);})();`;

  fs.writeFileSync(path.join(outDir, 'bookmarklet.min.js'), minified, 'utf8');
  fs.writeFileSync(path.join(outDir, 'bookmarklet-url.txt'), bookmarkletUri, 'utf8');
  fs.writeFileSync(path.join(outDir, 'hosted-bundle.js'), rawSource, 'utf8');
  fs.writeFileSync(path.join(outDir, 'loader-bookmarklet.js'), intranetLoaderUri, 'utf8');

  const indexPath = path.join(outDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    let indexHtml = fs.readFileSync(indexPath, 'utf8');
    indexHtml = indexHtml.replace(/const INLINE_BOOKMARKLET_URL = "[\s\S]*?";/, `const INLINE_BOOKMARKLET_URL = ${JSON.stringify(bookmarkletUri)};`);
    fs.writeFileSync(indexPath, indexHtml, 'utf8');
  }

  const rawSize = Buffer.byteLength(rawSource, 'utf8');
  const minSize = Buffer.byteLength(minified, 'utf8');
  const uriLength = bookmarkletUri.length;

  console.log(`Bookmarklet build:`);
  console.log(`- Source: ${(rawSize / 1024).toFixed(1)} KB`);
  console.log(`- Minified: ${(minSize / 1024).toFixed(1)} KB (${uriLength} chars)`);
  console.log(`- Chrome 32KB limit: ${uriLength <= 32768 ? 'OK' : 'EXCEEDED'}`);

  return {
    rawSize,
    minSize,
    uriLength,
    withinChromeLimit: uriLength <= 32768
  };
}

if (require.main === module) {
  buildBookmarklet();
}

module.exports = {
  buildBookmarklet,
  minifyJs
};
