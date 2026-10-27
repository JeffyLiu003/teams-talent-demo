import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createTerminalLauncher, type TerminalReceipt } from '../server/terminal-launcher.js';

const execute = promisify(execFile);
const reportPath = fileURLToPath(new URL('../test-results/windows-terminal-runtime.json', import.meta.url));
const fixture = fileURLToPath(new URL('./fixtures/windows-terminal-probe.mjs', import.meta.url));
const coverage = {
  route: 'Production createTerminalLauncher, standalone Windows PowerShell 5.1 and PowerShell 7',
  operatingSystem: 'Actual tool process, cwd, argv, parent PID, and stdin/stdout/stderr console handles',
  windowsTerminal: 'Not exercised: WT routing is covered by the separate spawn-contract unit tests',
  visibleDesktop: 'Not verified: a console handle does not prove visible GUI, window focus, or keyboard interaction',
  models: 'No iCode, model, or network calls; configured tool is node.exe with a local probe fixture',
};
const results: Record<string, unknown>[] = [];
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const encoded = (script: string) => Buffer.from(script, 'utf16le').toString('base64');
const errorText = (error: unknown): string => error instanceof AggregateError
  ? [error.stack ?? error.message, ...error.errors.map(errorText)].join('\nCaused by:\n')
  : error instanceof Error ? error.stack ?? error.message : String(error);

interface ProbeRecord {
  nonce: string; pid: number; parentPid: number; cwd: string; executable: string; argv: string[];
  consoleHandles: { stdin: boolean; stdout: boolean; stderr: boolean };
}
function alive(pid: number) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false; throw error; }
}
async function powershellJson<T>(shell: string, script: string): Promise<T> {
  const utf8 = '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)';
  const { stdout } = await execute(shell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded(utf8 + '\n' + script)], { timeout: 10_000, windowsHide: true, maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout.replace(/^\uFEFF/, '').trim()) as T;
}
async function waitForRecord(path: string, pid: number): Promise<ProbeRecord> {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try { return JSON.parse(await readFile(path, 'utf8')) as ProbeRecord; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (!alive(pid)) throw new Error('The production PowerShell process exited before the probe produced evidence');
    await delay(100);
  }
  throw new Error('Timed out after 45 seconds waiting for the configured tool');
}
async function waitForExit(pid: number) {
  const deadline = Date.now() + 15_000;
  while (alive(pid) && Date.now() < deadline) await delay(100);
  assert.equal(alive(pid), false, 'keepOpen:false must close the probe shell after the tool exits');
}
async function cleanupOwnConsole(pid: number, nonce: string, inspector: string, systemRoot: string) {
  if (!alive(pid)) return 'already-exited';
  assert.ok(Number.isSafeInteger(pid) && pid > 0 && pid !== process.pid);
  const info = await powershellJson<{ ProcessId: number; Name: string; CommandLine: string } | null>(inspector,
    `$p = Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}'\nif ($null -eq $p) { 'null' } else { $p | Select-Object ProcessId, Name, CommandLine | ConvertTo-Json -Compress }`);
  if (!info) return 'already-exited';
  assert.equal(info.ProcessId, pid);
  assert.match(info.Name, /^(powershell|pwsh)\.exe$/i, 'Cleanup is restricted to the PowerShell PID returned by this launch');
  const payload = info.CommandLine.match(/(?:^|\s)-EncodedCommand\s+"?([A-Za-z0-9+/=]+)/i)?.[1];
  assert.ok(payload && Buffer.from(payload, 'base64').toString('utf16le').includes(nonce), 'Refusing cleanup: receipt PID does not contain this probe nonce');
  try { await execute(join(systemRoot, 'System32', 'taskkill.exe'), ['/PID', String(pid), '/T', '/F'], { timeout: 10_000, windowsHide: true }); }
  catch (error) { if (alive(pid)) throw error; }
  await waitForExit(pid);
  return 'terminated-only-verified-probe-tree';
}

async function runShell(shell: string, expectedMajor: number, directory: string, inspector: string, systemRoot: string) {
  const nonce = randomUUID(), output = join(directory, `result-${nonce}.json`);
  const script = join(directory, 'probe tool 中文.mjs');
  const version = await powershellJson<{ major: number; minor: number; edition: string }>(shell,
    '[ordered]@{ major = $PSVersionTable.PSVersion.Major; minor = $PSVersionTable.PSVersion.Minor; edition = $PSVersionTable.PSEdition } | ConvertTo-Json -Compress');
  assert.equal(version.major, expectedMajor, 'The selected shell must exercise the intended PowerShell family');
  if (expectedMajor === 5) assert.equal(version.minor, 1);
  const argv = ['', 'with spaces', '中文 参数', "single'quote", 'ampersand&literal', '%PATH%', '$HOME $(1+1)', 'semi;colon', 'back`tick', 'double"quote', 'trailing\\', 'quote" and trailing\\', 'both\\"quoted\\', '--agent', '角色 含空格', '--model', 'model/name; & % $ ` "'];
  const entry: Record<string, unknown> = { shell, version, nonce, expectedArgv: argv, status: 'running' };
  results.push(entry);
  let receipt: TerminalReceipt | undefined, failure: unknown;
  try {
    // Only configuration is supplied; production resolver, spawning and execution remain real.
    const launcher = createTerminalLauncher({ env: { ...process.env, DEMO_WINDOWS_TERMINAL: 'none', DEMO_POWERSHELL_BINARY: shell } });
    receipt = await launcher.launch({ executable: process.execPath, directory, args: [script, output, nonce, ...argv], instruction: `Local Windows runtime probe ${nonce} — no model calls`, keepOpen: false });
    entry.receipt = receipt;
    assert.equal(receipt.terminal, 'PowerShell');
    assert.equal(receipt.status, 'terminal-requested');
    assert.ok(Number.isSafeInteger(receipt.pid) && receipt.pid! > 0 && receipt.pid !== process.pid, 'Production launch must return its new PowerShell PID');
    const record = await waitForRecord(output, receipt.pid!);
    entry.observed = record;
    assert.equal(record.nonce, nonce);
    assert.equal(record.parentPid, receipt.pid, 'The configured tool must be a child of the reported shell');
    assert.ok(record.pid > 0 && record.pid !== record.parentPid && record.pid !== process.pid);
    assert.equal((await realpath(record.cwd)).toLowerCase(), (await realpath(directory)).toLowerCase());
    assert.equal((await realpath(record.executable)).toLowerCase(), (await realpath(process.execPath)).toLowerCase());
    assert.deepEqual(record.argv, argv, 'All literal argument boundaries and characters must survive the production launcher');
    assert.deepEqual(record.consoleHandles, { stdin: true, stdout: true, stderr: true }, 'The actual tool must receive three console handles; a file receipt alone cannot verify an interactive TUI');
    await waitForExit(receipt.pid!);
    entry.status = 'passed';
    entry.shellExited = true;
  } catch (error) { failure = error; entry.status = 'failed'; entry.error = errorText(error); }
  finally {
    if (receipt?.pid) {
      try { entry.cleanup = await cleanupOwnConsole(receipt.pid, nonce, inspector, systemRoot); }
      catch (error) { entry.cleanupError = errorText(error); failure = failure ? new AggregateError([failure, error], 'Probe and verified cleanup failed') : error; }
    }
  }
  if (failure) throw failure;
}

async function main() {
  await mkdir(dirname(reportPath), { recursive: true });
  if (process.platform !== 'win32') {
    const required = process.env.WINDOWS_TERMINAL_RUNTIME_REQUIRED === '1';
    await writeFile(reportPath, JSON.stringify({ status: required ? 'failed' : 'skipped', platform: process.platform, coverage, reason: 'Requires real Windows processes and console handles' }, null, 2));
    if (required) throw new Error('Windows runtime validation was required on a non-Windows host');
    console.log('SKIP: Windows process/console runtime probe requires Windows; no GUI or Windows result is claimed.');
    return;
  }
  let directory: string | undefined, failure: unknown;
  try {
    const systemRoot = process.env.SystemRoot;
    assert.ok(systemRoot && isAbsolute(systemRoot), 'SystemRoot is required to locate Windows PowerShell 5.1');
    const windowsPowerShell = join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    await access(windowsPowerShell);
    const found = await execute(join(systemRoot, 'System32', 'where.exe'), ['pwsh.exe'], { timeout: 10_000, windowsHide: true });
    const pwsh = found.stdout.trim().split(/\r?\n/)[0];
    assert.ok(pwsh && isAbsolute(pwsh), 'PowerShell 7 is required; no substitute shell is accepted');
    await access(pwsh);
    directory = await mkdtemp(join(tmpdir(), 'teams-terminal-runtime-'));
    const cwd = join(directory, "cwd space 中文 ' & % $ ; `");
    await mkdir(cwd);
    await copyFile(fixture, join(cwd, 'probe tool 中文.mjs'));
    const errors: unknown[] = [];
    for (const [shell, major] of [[windowsPowerShell, 5], [pwsh, 7]] as const) {
      try { await runShell(shell, major, cwd, windowsPowerShell, systemRoot); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, 'Windows production terminal runtime probe failed');
  } catch (error) { failure = error; }
  finally {
    if (directory) {
      try { await rm(directory, { recursive: true, force: true }); }
      catch (error) { failure = failure ? new AggregateError([failure, error], 'Runtime probe cleanup failed') : error; }
    }
    await writeFile(reportPath, JSON.stringify({ status: failure ? 'failed' : 'passed', platform: process.platform, at: new Date().toISOString(), coverage, results, ...(failure ? { error: errorText(failure) } : {}) }, null, 2));
  }
  if (failure) throw failure;
  console.log('PASS: Windows PowerShell 5.1 and PowerShell 7 launched the real probe tool with exact cwd/argv and three console handles. Visible GUI/keyboard/WT routing remain unverified by this probe.');
}
await main();
