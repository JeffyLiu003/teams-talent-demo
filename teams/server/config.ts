import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalConfiguration } from './local-config.ts';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const localConfiguration = loadLocalConfiguration(root);
export const materialRoot = resolve(process.env.DEMO_MATERIAL_ROOT ?? join(root, '..'));
export const workspace = join(materialRoot, 'workspace');
export const codeRoot = join(workspace, 'carddemo-java-1025');
export const runtimeDir = resolve(process.env.DEMO_STATE_DIR ?? join(root, '.runtime'));
export const binary = resolve(process.env.DEMO_ICODE_BINARY ?? join(materialRoot, 'runtime/icode-0.31.0/icode'));
export const sessionId = '6b82c08d-eb3b-4bdc-b373-54fed16a7fcd';
export const port = Number(process.env.DEMO_PORT ?? 45970);
export const origin = 'http://127.0.0.1:' + port;
export const talentPort = Number(process.env.DEMO_TALENT_PORT ?? 45980);
export const talentOrigin = 'http://127.0.0.1:' + talentPort;
/** Exchange directory shared with Talents: Teams writes teams/, Talents writes talents/. */
export const sharedDir = resolve(process.env.DEMO_SHARED_DIR ?? join(root, '..', 'shared', 'data'));
/** Committed copies of the shared files, read when the other project has not written its own yet. */
export const sharedSeedDir = resolve(process.env.DEMO_SHARED_SEED_DIR ?? join(root, '..', 'shared', 'seed'));
if (!Number.isSafeInteger(port) || !Number.isSafeInteger(talentPort) || port < 1024 || port > 65535 || talentPort < 1024 || talentPort > 65535 || port === talentPort) throw new Error('Teams 与 Talents 需要有效且不同的本机端口');
