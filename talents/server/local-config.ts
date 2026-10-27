import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

// Same file format as teams/.local/config.json, so one file can serve both services.
// Keys only Teams uses are accepted and ignored here.
const pathKeys = new Set(['DEMO_TALENT_STATE_DIR', 'DEMO_SHARED_DIR', 'DEMO_MATERIAL_ROOT', 'DEMO_STATE_DIR', 'DEMO_ICODE_BINARY', 'DEMO_ICODE_PYTHON', 'DEMO_OPENCODE_BINARY']);
const portKeys = new Set(['DEMO_PORT', 'DEMO_TALENT_PORT']);
/** Local machine configuration is optional. Invalid present files always fail explicitly. */
export function loadLocalConfiguration(root: string, environment: NodeJS.ProcessEnv = process.env) {
  const file = environment.DEMO_LOCAL_CONFIG ?? join(root, '.local', 'config.json');
  if (!isAbsolute(file)) throw new Error('DEMO_LOCAL_CONFIG 必须是绝对路径');
  let text: string;
  try { text = readFileSync(file, 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT' && environment.DEMO_LOCAL_CONFIG === undefined) return { file, loaded: false }; throw error; }
  let values: unknown;
  try { values = JSON.parse(text); } catch { throw new Error('本机配置 JSON 无效：' + file); }
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('本机配置必须是键值对象：' + file);
  for (const [key, value] of Object.entries(values)) {
    if (pathKeys.has(key)) {
      if (typeof value !== 'string' || !isAbsolute(value) || value.includes('\0')) throw new Error('本机配置 ' + key + ' 必须是绝对路径');
    } else if (portKeys.has(key)) {
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1024 || value > 65535) throw new Error('本机配置 ' + key + ' 必须是 1024–65535 的整数');
    } else throw new Error('未知本机配置项：' + key);
  }
  for (const [key, value] of Object.entries(values)) if (environment[key] === undefined) environment[key] = String(value);
  return { file, loaded: true };
}
