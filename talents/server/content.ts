// Artifact and Skill text lives in talents/content/ (the same files public/js/content.js bundles).
import { readFileSync } from 'node:fs';
import { join, normalize, isAbsolute } from 'node:path';
import { contentDir } from './config.ts';

/** Text of a content file by its key (path under content/), or null when it does not exist. */
export function readContent(key: string, dir = contentDir): string | null {
  if (isAbsolute(key) || normalize(key).startsWith('..')) return null;
  try { return readFileSync(join(dir, key), 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}

function prMap(dir = contentDir): Record<string, string> {
  return JSON.parse(readContent('miner/pr-map.json', dir) ?? '{}');
}
/** Files of a development-pattern library: index, then per spec 范式总结, 代码分析报告 and its PR records. */
export function minerFiles(specs: string[], dir = contentDir) {
  const map = prMap(dir), out = ['miner/index.md'];
  for (const name of specs) {
    out.push(`miner/${name}/summary.md`, `miner/${name}/analyzer.md`);
    for (const pr of Object.keys(map).filter(pr => map[pr] === name)) out.push(`miner/${name}/input/prs/${pr}/metadata.json`);
  }
  return out;
}
/** miner/index.md restricted to the given specs (same rule as K.minerIndex in public/js/knowledge.js). */
export function minerIndex(specs: string[], dir = contentDir) {
  const text = readContent('miner/index.md', dir) ?? '';
  const rows: Record<string, string> = {};
  for (const line of text.split('\n')) { const m = /^\|\s*\[([^\]]+)\]/.exec(line); if (m) rows[m[1]] = line; }
  const head = text.split('\n').filter(line => /^#|^>/.test(line)).join('\n');
  return head + '\n\n| 名称 | 描述 | 首次归档时间 |\n| --- | --- | --- |\n' + specs.map(n => rows[n] ?? `| [${n}](<./${n}/summary.md>) | — | — |`).join('\n') + '\n';
}
/** Human label of a file in an artifact (same rule as K.fileLabel). */
export function fileLabel(key: string) {
  const parts = key.split('/'), name = parts.pop() ?? key;
  if (name === 'summary.md') return parts[1] ? parts[1] + '：范式总结' : '范式总结';
  if (name === 'analyzer.md') return parts[1] ? parts[1] + '：代码分析报告' : '代码分析报告';
  if (name === 'metadata.json') return 'PR #' + parts.pop();
  if (name === 'index.md') return parts[0] === 'miner' ? '范式索引' : '索引';
  if (name.startsWith('Skill改进-')) return 'Skill 改进：' + name.replace(/^Skill改进-|\.md$/g, '');
  return name.replace(/\.(md|html)$/, '');
}
export function fileType(key: string): 'markdown' | 'html' | 'json' | 'text' {
  if (key.endsWith('.md')) return 'markdown';
  if (key.endsWith('.html')) return 'html';
  if (key.endsWith('.json')) return 'json';
  return 'text';
}
