const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function zipDirectory(sourceDir, outZipPath) {
  const zip = new JSZip();

  function addDir(currentPath, zipFolder) {
    const items = fs.readdirSync(currentPath);
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const nextFolder = zipFolder.folder(item);
        addDir(fullPath, nextFolder);
      } else {
        const content = fs.readFileSync(fullPath);
        zipFolder.file(item, content);
      }
    }
  }

  addDir(sourceDir, zip);
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(outZipPath, buffer);
  console.log(`Created ${path.basename(outZipPath)} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  const root = path.join(__dirname, '..');
  const extDir = path.join(root, 'extension');
  const bmDir = path.join(root, 'bookmarklet');

  if (fs.existsSync(extDir)) {
    await zipDirectory(extDir, path.join(root, 'extension.zip'));
  }

  if (fs.existsSync(bmDir)) {
    await zipDirectory(bmDir, path.join(root, 'bookmarklet.zip'));
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { zipDirectory };
