// Trace 服务：拉起 demo 内嵌的 Python trace_server（file 模式）
// 既是查询端（/api/v1 只读 JSONL），也是采集接收端（/v1/traces → 同一个 JSONL 目录）。
// iCode 通过 start-icode-trace2.bat 直接向本服务上报 OTLP，不再依赖容器版 trace2。
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { runtimeDir, traceDataDir, traceOrigin, tracePort, traceServerRoot } from './config.js';

let child: ChildProcess | null = null;
let starting: Promise<void> | null = null;

async function healthy() {
  try {
    const response = await fetch(traceOrigin + '/health', { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

/** 启动（或复用已在运行的）trace_server；失败时抛出带日志路径的错误。 */
export async function startTraceService() {
  if (await healthy()) return;
  if (starting) return starting;
  starting = (async () => {
    const entry = join(traceServerRoot, 'backend', 'scripts', 'run_api.py');
    if (!existsSync(entry)) throw new Error('缺少 trace-server 后端入口：' + entry);
    await mkdir(runtimeDir, { recursive: true });
    const logPath = join(runtimeDir, 'trace-server.log');
    const log = await open(logPath, 'a', 0o600);
    const python = process.env.DEMO_TRACE_PYTHON || 'python';
    const current = spawn(python, [entry], {
      cwd: traceServerRoot,
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        PORT: String(tracePort),
        STORAGE_BACKEND: 'file',
        DATA_FILE: traceDataDir,
        // 本地接收 iCode 的 OTLP/HTTP，直接落盘到同一目录，查询端立即可读
        OTLP_ENABLED: '1',
        OTLP_SINK: 'file',
        OTLP_FILE_DIR: traceDataDir,
        OTLP_DEFAULT_PROJECT_ID: 'icode',
        PYTHONUNBUFFERED: '1',
      },
      stdio: ['ignore', log.fd, log.fd],
      windowsHide: true,
    });
    child = current;
    await log.close();
    current.on('exit', () => { if (child === current) child = null; });
    for (let i = 0; i < 40; i++) {
      if (await healthy()) return;
      if (current.exitCode !== null) throw new Error(`trace-server 退出（code=${current.exitCode}），日志：${logPath}`);
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    current.kill();
    throw new Error(`trace-server 启动超时，日志：${logPath}`);
  })();
  try { await starting; } finally { starting = null; }
}

/** 停止由本进程拉起的 trace_server（复用外部实例时不做处理）。 */
export function stopTraceService() {
  if (child && child.exitCode === null) child.kill('SIGTERM');
  child = null;
}

/** 把 /trace-api/* 转发到 trace_server 的 /api/v1/*（同源，避免 iframe 跨域）。 */
export async function proxyTrace(path: string, search: string, response: ServerResponse) {
  const target = traceOrigin + '/api/v1' + path.slice('/trace-api'.length) + search;
  try {
    const upstream = await fetch(target, { method: 'GET', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
    const body = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ detail: 'trace 查询服务不可用，请确认 demo 启动正常' }));
  }
}

/** 请求路径是否属于 trace 代理（供服务端路由判断）。 */
export const isTraceApi = (path: string) => path === '/trace-api' || path.startsWith('/trace-api/');
