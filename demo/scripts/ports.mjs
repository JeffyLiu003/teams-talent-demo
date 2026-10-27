// 启动前释放端口：重启时先结束占用端口的旧进程（含其子进程），避免 EADDRINUSE。
// 只处理明确占用目标端口的监听进程，不做全局清理。
import { execFileSync } from 'node:child_process';

function listenerPids(port) {
  if (process.platform === 'win32') {
    let out = '';
    try { out = execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8', windowsHide: true }); } catch { return []; }
    const pids = [];
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes('LISTENING')) continue;
      const cols = line.trim().split(/\s+/);
      // TCP  127.0.0.1:45970  0.0.0.0:0  LISTENING  2108
      if (cols.length < 5 || !cols[1].endsWith(':' + port)) continue;
      const pid = Number(cols[4]);
      if (Number.isSafeInteger(pid)) pids.push(pid);
    }
    return pids;
  }
  try {
    const out = execFileSync('lsof', ['-t', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
    return out.split(/\s+/).filter(Boolean).map(Number);
  } catch { return []; }
}

function killTree(pid) {
  if (process.platform === 'win32') {
    try { execFileSync('taskkill', ['/PID', String(pid), '/F', '/T'], { stdio: 'ignore', windowsHide: true }); return; } catch {}
  }
  try { process.kill(pid, 'SIGKILL'); } catch {}
}

async function waitForFree(port, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (listenerPids(port).length === 0) return true;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  return false;
}

export async function releasePorts(ports) {
  for (const port of [...new Set(ports)]) {
    const pids = [...new Set(listenerPids(port))].filter(pid => pid > 1 && pid !== process.pid);
    if (!pids.length) continue;
    for (const pid of pids) killTree(pid);
    const freed = await waitForFree(port);
    console.log(`已结束占用 ${port} 的旧进程（PID ${pids.join(', ')}）${freed ? '' : '，端口仍被占用，请手动检查'}`);
  }
}
