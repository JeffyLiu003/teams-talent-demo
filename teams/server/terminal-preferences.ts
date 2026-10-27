import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runtimeDir } from './config.js';
import { atomicJson } from './store.js';
import { createTerminalLauncher, type TerminalOption } from './terminal-launcher.js';

// Same local preference boundary as Teams business/shared/local-terminal:
// a device user's launch preference, independent of project business state.
export class TerminalPreferences {
  constructor(private directory = runtimeDir, private platform = process.platform, private discover: () => Promise<TerminalOption[]> = () => createTerminalLauncher().terminals()) {}
  async context() {
    const terminals = await this.discover();
    let selectedTerminal = this.platform === 'darwin' ? 'terminal' : 'system', terminalError: string | undefined;
    try {
      const stored = JSON.parse(await readFile(join(this.directory, 'terminal-preference.json'), 'utf8'));
      if (!stored || typeof stored.terminal !== 'string' || !['terminal', 'ghostty', 'system'].includes(stored.terminal)) throw new Error('本机终端偏好格式无效');
      selectedTerminal = stored.terminal;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') terminalError = '终端偏好读取失败，请重新选择：' + (error as Error).message;
    }
    const selected = terminals.find(item => item.id === selectedTerminal);
    if (!selected) terminalError ??= '所选终端不可用，请安装或重新选择；不会改用其他终端';
    return { terminals: terminals.map(({ id, name }) => ({ id, name })), selectedTerminal, terminalName: selected?.name ?? selectedTerminal, ...(terminalError ? { terminalError } : {}) };
  }
  async select(terminal: unknown) {
    if (typeof terminal !== 'string' || !(await this.discover()).some(item => item.id === terminal)) throw new Error('所选终端不可用，未保存配置');
    await atomicJson(join(this.directory, 'terminal-preference.json'), { terminal });
    return this.context();
  }
  async selected(expected?: string) {
    const context = await this.context();
    if (context.terminalError) throw new Error(context.terminalError);
    if (expected !== undefined && context.selectedTerminal !== expected) throw new Error('终端配置已变化，请重新确认启动');
    return { id: context.selectedTerminal, name: context.terminalName };
  }
}
export const terminalPreferences = new TerminalPreferences();
