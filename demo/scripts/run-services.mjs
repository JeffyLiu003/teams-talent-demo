import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { root, selectedServices } from './services.mjs';
const children = selectedServices().map(service => spawn(process.execPath, ['--import', 'tsx', join(root, service.entry)], { cwd: root, stdio: 'inherit' }));
let stopping = false;
function stop() { if (stopping) return; stopping = true; for (const child of children) if (child.exitCode === null) child.kill('SIGTERM'); }
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, stop);
for (const child of children) { child.on('error', error => { console.error(error.message); process.exitCode = 1; stop(); }); child.on('exit', code => { if (!stopping) { process.exitCode = code ?? 1; stop(); } }); }
