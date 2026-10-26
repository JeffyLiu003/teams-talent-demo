import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Alert, Button, Descriptions, Space } from 'antd';
import { getTools, native, type NativeStatus } from '../api.js';
import { Context, useDemo, type DemoContext } from '../context.js';
import { Origin } from './common.js';
import { mount } from '../vendor/teams/agent-management/index.js';
import { mountConfigurationEditor } from '../vendor/teams/agent-management/configuration-editor.js';
import { AGENT_UI_API, type AgentCategory, type AgentConfigurationController, type AgentUiInstance, type AgentUiModule } from '../vendor/teams/agent-management/agent-ui-contract.js';
import type { ConfigurationDocument, ConfigurationGroup, ConfigurationPort, ManagedCategory } from '../vendor/teams/agent-management/configuration-contract.js';
import { ui, type ObservedUiMountContext } from '../vendor/teams/agent-management/ui-contract.js';
import './agent-management.css';

type Tool = 'icode' | 'opencode';
const names = { icode: 'iCode', opencode: 'OpenCode' };
const demoVersion = 'demo-local-1';

// This adapter supplies demonstration records to the copied Teams editor.
// It deliberately has no native configuration write, install, or catalog transport.
function configurationPort(tool: Tool, demo: DemoContext): ConfigurationPort {
  const source = '演示数据 · 当前页面只读';
  const project = demo.state.workspace.project.name;
  const records = new Map<ManagedCategory, ConfigurationDocument[]>();
  const add = (category: ManagedCategory, id: string, name: string, scope: string, value: Record<string, string>, origin: string) => {
    const document: ConfigurationDocument = {
      resource: { id, name, scope, source: origin, readOnly: true },
      content: JSON.stringify(value, null, 2), revision: 'demo-1', format: 'JSON',
      rawTitle: '演示配置内容', formatDescription: '演示配置投影 · 未读取或改写原生配置文件',
      native: value, readOnly: true,
    };
    records.set(category, [...(records.get(category) ?? []), document]);
  };
  if (tool === 'icode') {
    add('agent', 'code-agent', `Code Agent ${demo.state.adoptedAgent}`, `项目采用 · ${project}`, {
      name: 'Code Agent', version: demo.state.adoptedAgent,
      instructions: demo.state.adoptedAgent === 'r2'
        ? '读取项目上下文 → 分析与实施 → 检查实际测试退出码和报告 → 同步问题及证据 → 提交待确认成果。报告缺失保持待验证，功能与安全结论分别呈现。'
        : '读取项目上下文 → 分析与实施 → 运行项目检查 → 提交成果与验证依据。',
      model: '沿用原生 iCode 配置；本页未读取模型或凭据',
      scope: '项目共享定义；当前任务采用版本保持冻结',
      origin: 'Teams 演示定义；Talent 提供改进候选与评估',
    }, 'Teams 项目采用记录 · 演示数据');
    for (const skill of demo.data.skills.filter(item => demo.state.workspace.selectedSkills.includes(item.name))) {
      add('skill', skill.name, skill.name, `项目选用 · ${project}`, {
        name: skill.name, version: skill.version,
        description: skill.description,
        content: demo.data.skillContents[skill.name] ?? skill.description,
        scope: '项目选用；尚未核验原生 Agent 实际读取状态',
      }, '本机 Skill 素材 · 项目选用清单');
    }
  } else {
    add('agent', 'build', 'build · 接入示例', 'OpenCode 工作目录 · 示例', {
      name: 'build', description: 'OpenCode 原生 Agent 示例',
      instructions: '分析项目变更并实施；由原生工具管理 Agent、权限问答与会话。',
      model: '由 OpenCode 原生配置选择', scope: '当前工作目录 · 演示配置',
    }, 'OpenCode 接入样例');
    add('skill', 'change-impact', '变更影响分析 · 接入示例', 'OpenCode 工作目录 · 示例', {
      name: 'change-impact', description: '餐饮返现需求的接口、业务规则与验证影响分析',
      content: '核对需求范围、受影响模块和验证证据。此内容为演示素材。',
      scope: '本地发现路径示例；未写入 OpenCode',
    }, 'OpenCode 接入样例');
  }
  add('model', 'native-model', '原生模型配置 · 说明', '当前系统用户', {
    provider: '由原生工具管理', model: '未读取', variant: tool === 'opencode' ? '由 OpenCode 原生配置选择' : '由 iCode 原生配置选择',
    credentials: '凭据保留在原生工具；演示不读取、不复制',
  }, source);
  add('mcp', 'native-mcp', 'MCP 接入 · 说明', '原生 Agent 所属配置', {
    server: '尚未读取原生 MCP Server 列表', transport: '保留工具原生连接与权限语义',
    scope: '本演示不修改连接和凭据；不能据此判定已连接',
  }, source);

  const labels: Record<string, string> = { name: '名称', version: '版本', instructions: '指令', model: '模型', scope: '作用范围', origin: '来源与职责', description: '说明', content: 'Skill 内容', provider: '服务商', variant: 'Variant / 原生选项', credentials: '凭据', server: 'Server', transport: '连接与权限' };
  return {
    target: `${names[tool]} · 演示配置 · 未写入本机`, toolType: names[tool],
    categories: ['agent', 'model', 'skill', 'mcp'],
    async list(category) { return (records.get(category) ?? []).map(document => document.resource); },
    async read(category, resource) {
      const document = records.get(category)?.find(item => item.resource.id === resource.id);
      if (!document) throw new Error('演示资源已不存在，请重新读取');
      return document;
    },
    groups(_category, document): ConfigurationGroup[] {
      const values = document.native as Record<string, string>;
      return [{ title: '配置详情', description: '演示数据；配置来源、项目选用和运行时实际加载分别呈现。', fields: Object.entries(values).map(([id, value]) => ({ id, label: labels[id] ?? id, value, kind: ['instructions', 'content', 'description'].includes(id) ? 'textarea' as const : 'text' as const, readOnly: true })) }];
    },
    patch() { throw new Error('配置示例只读；真实配置请在原生工具中修改'); },
    validate() {},
    async save() { throw new Error('demo 未连接原生配置写入接口'); },
  };
}

function unavailableConfiguration(container: HTMLElement, tool: Tool): AgentConfigurationController {
  const note = document.createElement('p'); note.className = ui.note; container.append(note);
  const selectCategory = (category: AgentCategory) => {
    note.textContent = `${names[tool]} ${category === 'hook' ? 'Hook' : 'Plugin'}：demo 尚未连接此原生配置接口。原 Teams 通过工具适配器按原生语义管理；本页不填充虚构配置。`;
  };
  return { activate() {}, selectCategory, hasDrafts: () => false, isBusy: () => false, getTargetLabel: () => names[tool], dispose() { container.replaceChildren(); } };
}

function OpenCodeDetails({ status }: { status: NativeStatus }) {
  const { role, run, showText } = useDemo();
  return <div className="agent-maintenance-detail"><Space><strong>OpenCode</strong><Origin kind="native" /></Space>
    <Descriptions column={1} size="small" items={[
      { key: 'status', label: '本机状态', children: status.opencode.installed ? '已发现可执行命令' : status.opencode.unsupportedReason ?? '当前 PATH 中未发现 OpenCode' },
      { key: 'version', label: '版本', children: status.opencode.version ?? '未取得' },
      { key: 'entry', label: '程序入口', children: status.opencode.path ?? '未配置' },
    ]} />
    <Button type="primary" disabled={!status.opencode.installed} onClick={() => void run(async () => {
      const receipt = await native(role, 'launch', { tool: 'opencode', restore: false, requestId: crypto.randomUUID() });
      showText('OpenCode 启动回执', JSON.stringify(receipt, null, 2));
    })}>启动 OpenCode</Button>
    <Alert type="info" title="OpenCode 原生 HTTP 接入示例" description="原 Teams 适配器支持会话与消息、Agent / Model / Variant 和权限问答。本演示保留配置示例及真实启动入口；尚未连接原生 HTTP 会话服务。" />
  </div>;
}

export function AgentManagement({ nativeControls }: { nativeControls: ReactNode }) {
  const demo = useDemo(), latest = useRef(demo), node = useRef<HTMLDivElement>(null);
  const controls = useRef(nativeControls);
  const [panels, setPanels] = useState<Array<{ element: HTMLElement; content: () => ReactNode }>>([]);
  latest.current = demo; controls.current = nativeControls;
  useEffect(() => {
    const container = node.current!;
    const abort = new AbortController();
    let statusPromise: Promise<NativeStatus> | undefined;
    const status = () => statusPromise ??= getTools();
    const mountReact = (element: HTMLElement, content: () => ReactNode) => {
      setPanels(previous => [...previous, { element, content }]);
      return () => setPanels(previous => previous.filter(panel => panel.element !== element));
    };
    const registrations = (['icode', 'opencode'] as const).map(id => ({ id, name: names[id], uiBundleId: id }));
    const observation: ObservedUiMountContext['observation'] = {
      observeBrowserOperation: async (_name, _attributes, body) => body({ event() {} }),
      async tracedFetch() { throw new Error('演示适配器未声明该网络操作'); },
      async tracedJson<T>(_name: string, input: RequestInfo | URL, init?: RequestInit) {
        let value: unknown;
        if (input === '/api/bundles/contributions') {
          value = { bundles: registrations.map(item => ({ id: item.id, version: demoVersion, module: item.id })) };
        } else if (input === '/api/bundles/agent-management/call') {
          const command = JSON.parse(String(init?.body)) as Record<string, unknown>;
          if (command.action === 'adapter.list') { statusPromise = undefined; value = { result: { adapters: registrations } }; }
          else if (command.action === 'working-directory.list') value = { result: { directories: {} } };
          else if (command.action === 'working-directory.set') {
            if (command.cwd !== (await status()).icode.workspace) throw new Error('当前演示启动固定到项目工作目录；尚未接入原 Teams 目录选择服务');
            value = { result: {} };
          } else throw new Error(`demo 未接入 Teams 管理操作：${String(command.action)}`);
        } else throw new Error(`演示适配器未声明该数据源：${String(input)}`);
        return { response: new Response(null, { status: 200 }), value: value as T };
      },
    };
    const context: ObservedUiMountContext = {
      contributionId: 'agent-management-demo', device: 'local', preview: true, signal: abort.signal, observation,
      setDirty() {}, reportError(error) { void latest.current.run(async () => { throw error; }); },
    };
    const loadModule = async (id: string): Promise<AgentUiModule & { version: string }> => {
      if (id !== 'icode' && id !== 'opencode') throw new Error('未知演示工具适配器');
      const tool = id;
      return { agentUiApi: AGENT_UI_API, version: demoVersion, createAgentUi() {
        return {
          async loadInstances(): Promise<AgentUiInstance[]> {
            const current = await status(), found = current[tool], port = configurationPort(tool, latest.current);
            return [{
              id: tool, name: names[tool], kind: '本机命令行工具', path: found.path ?? undefined, version: found.version ?? undefined,
              state: found.installed ? '本机已发现' : '本机未安装 · 接入示例',
              identity: `${found.version ?? '版本未取得'} · 当前设备 / 当前系统用户 · 配置展示为演示数据`,
              facts: [{ label: '数据来源', value: '本机探测 /api/tools；配置为只读演示数据' }, { label: '程序路径', value: found.path ?? '未配置' }, { label: '版本', value: found.version ?? '未取得' }, { label: '维护能力', value: 'demo 未连接原 Teams 安装、升级和配置写入服务' }],
              categories: [
                { category: 'agent', label: 'Agent', description: tool === 'icode' ? `项目采用 Code Agent ${latest.current.state.adoptedAgent} · 演示定义` : 'Agent / 角色 · OpenCode 接入示例' },
                { category: 'model', label: 'Model', description: '服务商与模型由原生工具管理 · 查看接入说明' },
                { category: 'skill', label: 'Skill', description: tool === 'icode' ? `${latest.current.state.workspace.selectedSkills.length} 个项目选用 Skill · 只读素材` : 'Skill / 本地发现路径 · 接入示例' },
                { category: 'mcp', label: 'MCP', description: '保留原生 Server 连接与权限 · 查看接入说明' },
                { category: 'hook', label: 'Hook', description: '事件与执行配置', unavailableReason: 'demo 未连接原生 Hook 配置接口' },
                { category: 'plugin', label: 'Plugin', description: '工具原生扩展', unavailableReason: tool === 'opencode' ? '原 Teams 支持原生 Plugin；demo 未连接' : '当前 iCode 适配器未开放 Plugin 管理' },
              ],
              startup: {
                cwd: current.icode.workspace,
                terminals: [{ id: 'native', name: tool === 'icode' && current.icode.active ? current.icode.active.application ?? '已有终端' : current.terminalName ?? '系统终端' }], selectedTerminal: 'native',
                launchLabel: tool === 'icode' && current.icode.active ? '打开已运行会话' : `启动 ${names[tool]}`,
                hint: tool === 'icode' && current.icode.active ? `历史会话由 ${current.icode.active.application ?? '已有终端'} 持有；请在原终端继续，未重复启动。恢复与核验入口在实例管理中。` : '使用演示项目的固定工作目录；启动实际本机工具。',
                disabledReason: tool === 'icode' && current.icode.active && !current.icode.active.application ? '请在原终端继续，未重复启动；当前系统没有可靠的窗口定位。' : found.installed ? undefined : tool === 'opencode' && current.opencode.unsupportedReason ? current.opencode.unsupportedReason : '当前设备尚未发现此工具，配置入口提供接入示例。',
                async chooseDirectory() { throw new Error('演示固定使用项目工作目录；原 Teams 的目录选择服务尚未接入'); },
                async selectTerminal() {},
                async launch(input) {
                  if (input.cwd !== current.icode.workspace) throw new Error('演示仅支持当前项目工作目录，请恢复显示的项目路径后启动');
                  const fresh = await getTools();
                  if (tool === 'icode' && fresh.icode.active) {
                    if (!fresh.icode.active.application) throw new Error('请在原终端继续，未重复启动；当前系统没有可靠的窗口定位。');
                    const receipt = await native(latest.current.role, 'focus');
                    return { message: receipt.note ?? '已打开现有原生会话。' };
                  }
                  const receipt = await native(latest.current.role, 'launch', { tool, restore: false, requestId: crypto.randomUUID() });
                  return { message: receipt.note ?? '已请求本机终端启动。' };
                },
              },
              mountConfiguration(element, child) {
                return mountConfigurationEditor(element, child, port, target => unavailableConfiguration(target, tool));
              },
              mountMaintenance(element) {
                return mountReact(element, () => tool === 'icode' ? <div className="agent-maintenance-detail"><Space><strong>iCode · 本机实例</strong><Origin kind="native" /></Space>{controls.current}<Alert type="info" title="安装与版本维护" description="原 Teams 提供安装、升级及核对流程。演示保留当前配套 iCode，不执行安装升级或修改默认命令。" /></div> : <OpenCodeDetails status={current} />);
              },
            }];
          },
          mountAdoption(element) {
            return mountReact(element, () => <div className="agent-maintenance-detail"><Space><strong>{names[tool]} 接入</strong><Origin kind="simulated" /></Space><Alert type="info" title="本机状态按实际探测呈现" description={tool === 'icode' ? '演示已接入配套 iCode。原 Teams 支持发现候选、核对安装和明确接入；此演示只使用已配置实例。' : 'OpenCode 保留原生 HTTP、Agent / Model / Variant、权限问答及 Plugin 语义。当前演示未接入原生 HTTP 服务；配置菜单可浏览只读样例。'} /><p className="ui-note">Teams 管理工具和共享入口；原生工具负责执行；Talent 提供知识整合、分析和能力改进。</p></div>);
          },
          dispose() {},
        };
      } };
    };
    const dispose = mount(container, context, { loadModule, configurationOwnerLabel: '演示配置 · 本机实际配置由原生工具管理' });
    return () => { abort.abort(); dispose(); };
  }, []);
  return <div className="agent-management-demo"><div ref={node} />{panels.map((panel, index) => createPortal(
    <Context.Provider value={{ ...demo, showText(title, content) {
      // The host drawer lives outside this native dialog's top layer.
      panel.element.closest('dialog')?.close();
      demo.showText(title, content);
    } }}>{panel.content()}</Context.Provider>, panel.element, String(index),
  ))}<p className="agent-demo-source">本机状态来自实际探测；配置来自项目演示定义和 Skill 素材。共享范围与版本在共享能力中管理。</p></div>;
}
