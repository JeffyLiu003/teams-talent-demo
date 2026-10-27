// Bundles content/ into js/content.js so the page can read artifact text when opened via file://.
// Usage: node tools/bundle-content.mjs
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, sep, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'content');
const outFile = join(root, 'js', 'content.js');
const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.py', '.yaml', '.yml', '.json', '.html']);
const MAX_BYTES = 1.5 * 1024 * 1024;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.') || name === '__pycache__') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (TEXT_EXTENSIONS.has(extname(name).toLowerCase())) out.push(full);
  }
  return out;
}

const toKey = path => relative(contentDir, path).split(sep).join('/').normalize('NFC');
const readText = path => readFileSync(path, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');

function build(includeFile) {
  const files = {};
  const trees = {};
  for (const path of walk(contentDir)) {
    const key = toKey(path);
    const skill = key.match(/^(skills\/[^/]+)\/(.+)$/);
    if (skill && !includeFile(skill[2])) continue;
    files[key] = readText(path);
    if (skill) (trees[skill[1]] ??= []).push(skill[2]);
  }
  for (const list of Object.values(trees)) list.sort((a, b) => (a === 'SKILL.md' ? -1 : b === 'SKILL.md' ? 1 : a.localeCompare(b)));
  return `window.TALENTS_CONTENT = ${JSON.stringify({ files, trees })};\n`;
}

// Full skills first; if too large, keep SKILL.md plus first-level text files only.
let output = build(() => true);
if (Buffer.byteLength(output) > MAX_BYTES) output = build(file => !file.includes('/'));
writeFileSync(outFile, output);
console.log(`wrote ${relative(root, outFile)} (${Buffer.byteLength(output)} bytes)`);
