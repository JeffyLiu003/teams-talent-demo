import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rm } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

export interface SkillPackageFile { path: string; sha256: string; executable: boolean; bytes: Buffer }
export interface NativeSkillPackage { id: string; name: string; version: string; sha256: string; files: SkillPackageFile[] }
export const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
export function portableSkillPath(path: string) {
  return path.length > 0 && path.length <= 240 && !/[\\\0-\x1f<>:"|?*]/.test(path) && path.split('/').every(part => !!part && !['.', '..'].includes(part) && !/[. ]$/.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}
export const skillPackageDigest = (files: Array<{path:string;sha256:string;executable:boolean}>) => sha256(JSON.stringify(files.map(({path,sha256,executable})=>({path,sha256,executable})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)));
export function validateSkillPackage(pkg: NativeSkillPackage) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pkg.name) || pkg.name.length > 64 || pkg.name !== pkg.id) throw new Error('Skill 包名称与资源标识不匹配');
  if (!/^[a-f0-9]{64}$/.test(pkg.sha256) || !pkg.version || pkg.files.length < 1 || pkg.files.length > 1024 || !pkg.files.some(file => file.path === 'SKILL.md')) throw new Error('Skill 包清单无效');
  const names = new Set<string>(); let bytes = 0;
  for (const file of pkg.files) {
    const key = file.path.toLowerCase();
    if (!portableSkillPath(file.path) || names.has(key) || typeof file.executable !== 'boolean' || !Buffer.isBuffer(file.bytes) || sha256(file.bytes) !== file.sha256) throw new Error('Skill 文件路径或内容校验失败：' + file.path);
    names.add(key); bytes += file.bytes.length;
  }
  if (skillPackageDigest(pkg.files) !== pkg.sha256) throw new Error('Skill 完整包摘要校验失败');
  if (bytes > 32 * 1024 * 1024) throw new Error('Skill 包超过 32 MiB');
}
async function directory(path: string, create: boolean) {
  try { const item = await lstat(path); if (!item.isDirectory() || item.isSymbolicLink()) throw new Error('Skill 目标包含符号链接或非目录：' + path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || !create) throw error; await mkdir(path); }
}
async function inspectFiles(root: string, prefix = ''): Promise<Array<{ path: string; sha256: string; executable: boolean }>> {
  const files = [];
  for (const name of (await readdir(join(root, prefix))).sort()) {
    const path = prefix ? prefix + '/' + name : name, absolute = join(root, path), entry = await lstat(absolute);
    if (entry.isSymbolicLink()) throw new Error('已存在的 Skill 包含符号链接：' + path);
    if (entry.isDirectory()) files.push(...await inspectFiles(root, path));
    else if (entry.isFile()) files.push({ path, sha256: sha256(await readFile(absolute)), executable: !!(entry.mode & 0o111) });
    else throw new Error('Skill 目录包含非普通文件：' + path);
  }
  return files.sort((a,b) => a.path<b.path?-1:a.path>b.path?1:0);
}
const manifest = (pkg: NativeSkillPackage) => pkg.files.map(({path,sha256,executable}) => ({path,sha256,executable})).sort((a,b) => a.path<b.path?-1:a.path>b.path?1:0);
export async function inspectSkillTarget(targetDirectory: string, pkg: NativeSkillPackage) {
  validateSkillPackage(pkg);
  const parent = await realpath(dirname(targetDirectory)); await directory(dirname(targetDirectory), false);
  const canonical = join(parent,basename(targetDirectory)), target = join(canonical,pkg.name);
  for (const path of [canonical,target]) {
    try { await directory(path, false); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { targetDirectory: canonical, skillDirectory: target, existing: 'none' as const }; throw error; }
  }
  const actual = await inspectFiles(target), expected = manifest(pkg);
  // Windows does not preserve POSIX executable bits; content and paths remain exact.
  const comparable = (items: typeof actual) => items.map(file => process.platform === 'win32' ? {path:file.path,sha256:file.sha256} : file);
  if (JSON.stringify(comparable(actual)) !== JSON.stringify(comparable(expected))) throw new Error('目标已存在不同内容的 Skill，未覆盖：' + target);
  return { targetDirectory: canonical, skillDirectory: target, existing: 'same' as const };
}
export async function installSkillPackage(targetDirectory: string, pkg: NativeSkillPackage) {
  const inspected = await inspectSkillTarget(targetDirectory, pkg);
  if (inspected.existing === 'same') return { ...inspected, status: 'already-applied' as const };
  await directory(inspected.targetDirectory, true);
  const staging = join(dirname(inspected.targetDirectory), '.skill-install-' + randomUUID()); await mkdir(staging, { mode: 0o700 });
  try {
    for (const file of pkg.files) {
      const path = resolve(staging, file.path); if (relative(staging,path).startsWith('..'+sep)) throw new Error('Skill 文件越过包目录');
      await mkdir(dirname(path),{recursive:true}); const handle = await open(path,'wx',file.executable ? 0o700 : 0o600);
      try { await handle.writeFile(file.bytes); await handle.sync(); } finally { await handle.close(); }
    }
    const beforeCommit = await inspectSkillTarget(inspected.targetDirectory, pkg);
    if (beforeCommit.existing === 'same') return { ...beforeCommit, status: 'already-applied' as const };
    await rename(staging, inspected.skillDirectory);
    const verified = await inspectSkillTarget(inspected.targetDirectory, pkg);
    if (verified.existing !== 'same') throw new Error('Skill 安装后的内容核验失败');
    return { ...verified, status: 'applied' as const };
  } finally { await rm(staging,{recursive:true,force:true}); }
}

/** Keep a successful native read tied to the exact installed package, including attachments. */
export async function readUnchangedSkillPackage<T>(targetDirectory: string, pkg: NativeSkillPackage, read: () => Promise<T>): Promise<T> {
  if ((await inspectSkillTarget(targetDirectory,pkg)).existing !== 'same') throw new Error('原生读取前的 Skill 包不存在');
  const result = await read();
  if ((await inspectSkillTarget(targetDirectory,pkg)).existing !== 'same') throw new Error('原生读取期间 Skill 包发生变化');
  return result;
}
