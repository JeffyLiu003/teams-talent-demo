import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalConfiguration } from './local-config.ts';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const localConfiguration = loadLocalConfiguration(root);
export const materialRoot = resolve(process.env.DEMO_MATERIAL_ROOT ?? join(root, '..'));
export const workspace = join(materialRoot, 'workspace');
export const codeRoot = join(workspace, 'carddemo-java-1025');
export const runtimeDir = resolve(process.env.DEMO_STATE_DIR ?? join(root, '.runtime'));
export const sessionId = '6b82c08d-eb3b-4bdc-b373-54fed16a7fcd';
export const port = Number(process.env.DEMO_PORT ?? 45970);
export const origin = 'http://127.0.0.1:' + port;
export const talentPort = Number(process.env.DEMO_TALENT_PORT ?? 45980);
export const talentOrigin = 'http://127.0.0.1:' + talentPort;
export const talentRuntimeDir = resolve(process.env.DEMO_TALENT_STATE_DIR ?? join(root, '.talent-runtime'));
// 开发会话轨迹：demo 内嵌的 trace_server（Python/uvicorn，file 存储）
export const traceServerRoot = join(root, 'trace-server');
export const tracePort = Number(process.env.DEMO_TRACE_PORT ?? 8012);
export const traceOrigin = 'http://127.0.0.1:' + tracePort;
// 默认落在 trace-server/trace_data：查询端与 OTLP 接收端读写同一目录
export const traceDataDir = resolve(process.env.DEMO_TRACE_DATA_DIR ?? join(traceServerRoot, 'trace_data'));
if (!Number.isSafeInteger(port) || !Number.isSafeInteger(talentPort) || !Number.isSafeInteger(tracePort) || port < 1024 || port > 65535 || talentPort < 1024 || talentPort > 65535 || tracePort < 1024 || tracePort > 65535) throw new Error('Teams / Talent / Trace 需要有效的本机端口');
if (port === talentPort || port === tracePort || talentPort === tracePort) throw new Error('Teams / Talent / Trace 必须使用不同端口');
if (runtimeDir === talentRuntimeDir) throw new Error('Teams 与 Talent 必须使用独立状态目录');
