#!/usr/bin/env node
// Portable import of the supplied history; never launches iCode or edits credentials.
import { cp, lstat, mkdir, open, readdir, readFile, realpath, rename, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
const demo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const material = resolve(process.env.DEMO_MATERIAL_ROOT ?? join(demo, '..'));
const shortId = '6b82c08deb3b', sessionId = '6b82c08d-eb3b-4bdc-b373-54fed16a7fcd';
const args = process.argv.slice(2); let dryRun = false, sessionRoot = join(homedir(), '.chrys/sessions');
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dry-run') { dryRun = true; continue; }
  if (args[i] === '--session-root' && args[i + 1]) { sessionRoot = resolve(args[++i]); continue; }
  if (args[i] === '--help') { console.log('node scripts/restore-history.mjs [--dry-run] [--session-root DIRECTORY]\n默认导入到 ~/.chrys/sessions；拒绝已有目标或锁。不启动 iCode，不改凭据。'); process.exit(0); }
  throw new Error('未知或缺少值的参数：' + args[i]);
}
const source = join(material, 'sessions-original', shortId), target = join(sessionRoot, shortId);
const parseHistory = text => JSON.parse(text, (_key, value, context) => typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value) ? JSON.rawJSON(context.source) : value);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function exists(path) { try { await lstat(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
async function assertUnused() {
  if (await exists(target)) throw new Error('目标会话已存在，拒绝覆盖或合并：' + target);
  for (const name of ['active.json', 'active.lock', 'write.lock']) if (await exists(join(sessionRoot, '.locks', shortId + '.' + name))) throw new Error('目标会话存在锁，拒绝导入：' + name);
}
async function filesAt(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true }), files = [];
  for (const entry of entries) {
    const name = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error('历史输入包含软链，拒绝导入：' + name);
    if (entry.isDirectory()) files.push(...await filesAt(join(directory, entry.name), name + '/'));
    else if (entry.isFile()) files.push(name); else throw new Error('历史输入包含非普通文件：' + name);
  }
  return files;
}
const mappings = [
  ['/Users/louis/work-space/Code-projects/iCode/carddemo-java-1025-dev-src-20261026.zip', join(material, 'archives/carddemo-java-1025-dev-src-20261026.zip')],
  ['/Users/louis/work-space/Code-projects/iCode', join(material, 'workspace')],
  ['/Users/louis/.config/opencode/skills', join(material, 'workspace/skills')],
  ['/Users/louis/.chrys/sessions/' + shortId, target],
  ['/Users/louis', homedir()],
];
const pathPattern = new RegExp(mappings.map(([old]) => old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
function migrate(value, counts) {
  if (JSON.isRawJSON(value)) return value;
  if (typeof value === 'string') {
    // Only rewrite original input prefixes, once: a destination containing an old prefix is not rewritten again.
    return value.replace(pathPattern, matched => { counts[matched] = (counts[matched] ?? 0) + 1; return mappings.find(([old]) => old === matched)[1]; });
  }
  if (Array.isArray(value)) return value.map(item => migrate(item, counts));
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, item]) => [migrate(key, counts), migrate(item, counts)]);
    if (new Set(entries.map(([key]) => key)).size !== entries.length) throw new Error('路径迁移造成对象键冲突，拒绝丢失历史字段');
    return Object.fromEntries(entries);
  }
  return value;
}
async function writeSynced(path, bytes) { const handle = await open(path, 'wx', 0o600); try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); } }
let staging;
try {
  await assertUnused(); await realpath(join(material, 'workspace'));
  const files = await filesAt(source), changed = files.filter(name => name === 'session.json' || name === 'session.json.bak' || /^snapshots\/[^/]+\.json$/.test(name) || /^sub_agents\/sessions\/[^/]+\.json$/.test(name));
  const main = parseHistory(await readFile(join(source, 'session.json'), 'utf8'));
  if (main.meta?.session_id !== sessionId || main.meta?.primary_cwd !== mappings[1][0]) throw new Error('原始会话身份或工作目录不符，拒绝按其他来源迁移');
  if (changed.length !== 16) throw new Error('历史输入不完整：预期 16 个结构化会话文件，实际 ' + changed.length);
  if (!dryRun) { await mkdir(sessionRoot, { recursive: true, mode: 0o700 }); staging = join(sessionRoot, '.import-' + shortId + '-' + randomUUID()); await mkdir(staging, { mode: 0o700 }); }
  const modifications = [];
  for (const name of changed) {
    const original = await readFile(join(source, name)), counts = {}, value = migrate(parseHistory(original.toString('utf8')), counts);
    const previousCheckpoint = value.session_checkpoint_id ?? null;
    // iCode state/store.py mints a new analytics id for every saved envelope, not a content digest.
    if (Object.hasOwn(value, 'session_checkpoint_id')) value.session_checkpoint_id = dryRun ? '<new-32-hex-on-import>' : randomBytes(16).toString('hex');
    const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
    modifications.push({ file: name, replacements: counts, sourceSha256: digest(original), ...(dryRun ? {} : { importedSha256: digest(bytes), checkpoint: value.session_checkpoint_id ?? null }), previousCheckpoint });
    if (!dryRun) { const path = join(staging, name); await mkdir(dirname(path), { recursive: true, mode: 0o700 }); await writeSynced(path, bytes); }
  }
  const report = { contract: 'teams-demo-history-import-v1', dryRun, source, target, sessionId, workspace: join(material, 'workspace'), files: files.length, modifiedFiles: modifications, preservedFiles: files.length - changed.length, checkpointRule: 'Fresh random 32-hex id per rewritten envelope; SHA256 describes the bytes actually written. Original trajectory references remain historical.', nativeLoadVerified: false, credentialsCopied: false };
  if (!dryRun) {
    for (const name of files.filter(name => !changed.includes(name))) { const path = join(staging, name); await mkdir(dirname(path), { recursive: true, mode: 0o700 }); await cp(join(source, name), path, { force: false, errorOnExist: true, mode: constants.COPYFILE_EXCL }); }
    await writeSynced(join(staging, 'demo-import.json'), JSON.stringify(report, null, 2) + '\n');
    await assertUnused();
    // Exclusive mkdir prevents replacing even an empty existing destination. Publish the primary last.
    await mkdir(target, { mode: 0o700 });
    const marker = join(target, '.import-in-progress'); await writeSynced(marker, 'Import in progress; do not load this session.\n');
    const entries = await readdir(staging); entries.sort((a, b) => Number(a === 'session.json') - Number(b === 'session.json'));
    for (const entry of entries) await rename(join(staging, entry), join(target, entry));
    await rm(marker); await rm(staging, { recursive: true }); staging = undefined;
  }
  console.log(JSON.stringify(report, null, 2));
} catch (error) { console.error('历史导入失败：' + error.message + '。未启动 iCode；如目标含 .import-in-progress，请核对部分导入，不要加载。'); process.exitCode = 1; }
finally { if (staging) await rm(staging, { recursive: true, force: true }); }
