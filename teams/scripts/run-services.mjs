import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { root, selectedServices } from './services.mjs';
import { tracePort } from '../server/config.ts';
import { releasePorts } from './ports.mjs';
// 重启时先让出端口：结束上一轮遗留的 Teams / Talent / trace-server 进程
const launching = selectedServices();
const ports = launching.map(service => Number(new URL(service.origin).port));
if (launching.some(service => service.id === 'teams')) ports.push(tracePort);
await releasePorts(ports);
const children = launching.map(service => spawn(process.execPath, ['--import', 'tsx', join(root, service.entry)], { cwd: root, stdio: 'inherit' }));
let stopping = false;
function stop() { if (stopping) return; stopping = true; for (const child of children) if (child.exitCode === null) child.kill('SIGTERM'); }
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, stop);
for (const child of children) { child.on('error', error => { console.error(error.message); process.exitCode = 1; stop(); }); child.on('exit', code => { if (!stopping) { process.exitCode = code ?? 1; stop(); } }); }
