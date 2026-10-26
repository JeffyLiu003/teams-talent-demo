import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { selectedServices, serviceHealth } from './services.mjs';
for (const service of selectedServices()) {
  const path = join(service.runtimeDir, 'server.pid');
  let pid;
  try { pid = Number(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') { console.log(service.id + ' 没有由启动脚本记录的进程。'); continue; } throw error; }
  if (!Number.isSafeInteger(pid) || pid < 2) throw new Error(service.id + ' PID 无效');
  const health = await serviceHealth(service);
  if (!health || health.pid !== pid) throw new Error(service.id + ' 服务失联或 PID 不匹配，无法核对当前目录归属；未发送停止信号，保留 PID 供检查');
  process.kill(pid, 'SIGTERM');
  let stopped = false;
  for (let n = 0; n < 60; n++) { try { process.kill(pid, 0); } catch (error) { if (error.code === 'ESRCH') { stopped = true; break; } throw error; } await new Promise(resolve => setTimeout(resolve, 100)); }
  if (!stopped) throw new Error(service.id + ' 尚未退出，保留 PID 以便检查');
  await rm(path); console.log(service.id + ' 已停止。');
}
