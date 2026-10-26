#!/usr/bin/env node
// Pre-compiles server/src TypeScript files into pure JavaScript ESM (server/dist/index.mjs)
// using Node.js 22+ built-in module.stripTypeScriptTypes so KokioTalk runs with
// zero runtime dependencies inside Windows (.exe) and macOS (.dmg) packages.
const fs = require('node:fs');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'server', 'src');
const DIST_DIR = path.join(ROOT, 'server', 'dist');

function walkAndCompile(srcDir, distDir) {
  fs.mkdirSync(distDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    if (entry.isDirectory()) {
      walkAndCompile(srcPath, path.join(distDir, entry.name));
    } else if (entry.name.endsWith('.ts')) {
      const code = fs.readFileSync(srcPath, 'utf-8');
      let js = stripTypeScriptTypes(code, { mode: 'strip' });
      // Rewrite relative .ts imports to .mjs
      js = js.replace(/(from\s+['"]\.[^'"]+)\.ts(['"])/g, '$1.mjs$2');
      const outName = entry.name.replace(/\.ts$/, '.mjs');
      fs.writeFileSync(path.join(distDir, outName), js, 'utf-8');
    } else {
      fs.copyFileSync(srcPath, path.join(distDir, entry.name));
    }
  }
}

walkAndCompile(SRC_DIR, DIST_DIR);
console.log('✅ Built pure ESM server into server/dist/index.mjs');
