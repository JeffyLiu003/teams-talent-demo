import { writeFile, rename } from 'node:fs/promises';

// This is the configured tool for the runtime probe. It performs no model or network calls.
const [output, nonce, ...argv] = process.argv.slice(2);
if (!output || !/^[0-9a-f-]{36}$/.test(nonce ?? '')) throw new Error('Probe output and nonce are required');
const result = {
  nonce, pid: process.pid, parentPid: process.ppid, cwd: process.cwd(), executable: process.execPath, argv,
  consoleHandles: { stdin: process.stdin.isTTY === true, stdout: process.stdout.isTTY === true, stderr: process.stderr.isTTY === true },
};
const pending = output + '.pending';
await writeFile(pending, JSON.stringify(result), { encoding: 'utf8', flag: 'wx' });
await rename(pending, output);
