import { useState } from 'react';
import { Button, Drawer, Input, Modal, Space, Switch, Tabs, Tag } from 'antd';
import { BookOutlined, BulbOutlined, BranchesOutlined, BugOutlined, ExperimentOutlined, FileTextOutlined } from '@ant-design/icons';
import { useDemo } from '../context.js';
import { FrameworkCard } from '../vendor/teams/components/page-layout.js';
import { EnterpriseSourceData } from '../components/enterprise-source-data.js';
import { Origin } from '../components/common.js';
import { TeamsPageIntro } from '../components/teams-reuse.js';
import { externalPlatforms, externalPlatformDefault } from '../external-platforms.js';
import type { WorkspaceState } from '../workspace.js';
import '../operations.css';
import '../enterprise-connections.css';

type Connection = WorkspaceState['connections'][number];
type PlatformRow = Connection & { pluginId: string; platform: string; summary: string; dataTypes: readonly string[] };
const platformIcons = { repository: <BranchesOutlined />, requirements: <FileTextOutlined />, defects: <BugOutlined />, 'design-library': <BookOutlined />, 'test-assets': <ExperimentOutlined />, 'business-knowledge': <BulbOutlined /> };
const configurationTabs = [{ key: 'quality', label: '质量与安全' }, { key: 'services', label: '模型与工具服务' }, { key: 'talent', label: 'Talent 接入' }];
/** The upstream enterprise-connection route currently supplies CapabilityState.
 * Keep its route vocabulary and port the existing resource-card/header/meta/footer
 * structure from agent-resources/src/client/ui/index.ts. Platform cards are demo adapters. */
export function Organization() {
  const { state, role, update, busy, navigate } = useDemo();
  const legacyTab = new URLSearchParams(location.hash.split('?')[1]).get('tab');
  const [configurationOpen, setConfigurationOpen] = useState(configurationTabs.some(item => item.key === legacyTab));
  const [configurationTab, setConfigurationTab] = useState(legacyTab && configurationTabs.some(item => item.key === legacyTab) ? legacyTab : 'quality');
  const [sourcePlatform, setSourcePlatform] = useState<(typeof externalPlatforms)[number] | null>(null);
  const [editing, setEditing] = useState<Connection | null>(null), [description, setDescription] = useState(''), [enabled, setEnabled] = useState(true);
  const rows: PlatformRow[] = externalPlatforms.map(source => ({ ...externalPlatformDefault(source.id)!, ...state.workspace.connections.find(item => item.id === ('connectionId' in source ? source.connectionId : source.id)), pluginId: source.id, platform: source.name, summary: source.description, dataTypes: source.dataTypes }));
  const configs = state.workspace.connections.filter(item => configurationTab === 'quality' ? item.kind === 'quality' : configurationTab === 'services' ? ['model','tool'].includes(item.kind) : item.kind === 'talent');
  const edit = (item: Connection) => { setEditing(item); setDescription(item.description); setEnabled(item.enabled); };
  return <div className="page-stack enterprise-connections">
    <TeamsPageIntro extension="原 Teams 已有企业连接入口和待接入占位。本页使用演示来源说明 Teams 汇总外部数据供项目交付使用。" actions={<Space wrap><Origin kind="simulated" /><Button size="small" onClick={() => setConfigurationOpen(true)}>其他能力配置</Button></Space>}>汇总外部资产与数据，在项目交付中关联使用。</TeamsPageIntro>
    <p className="enterprise-mock-note">以下为演示连接，提供各平台的 mock 源数据，保存配置与范围；真实平台连接和数据同步尚未接入。</p>
    <section className="enterprise-plugin-grid" aria-label="外部平台连接">{rows.map(item => <article key={item.id} data-platform={item.pluginId} className="resource-card enterprise-plugin-card">
      <div className="resource-heading"><span className="resource-icon" aria-hidden>{platformIcons[item.pluginId as keyof typeof platformIcons]}</span><div><h3>{item.platform}</h3><p>{item.summary}</p></div></div>
      <div className="enterprise-plugin-data"><span className="ui-note">提供数据</span><Space size={4} wrap>{item.dataTypes.map(type => <Tag key={type}>{type}</Tag>)}</Space></div>
      <div className="enterprise-plugin-scope"><span className="ui-note">访问范围 · {state.workspace.team.name}</span>{item.description !== item.summary && <p>{item.description}</p>}</div>
      <footer><Tag color={item.enabled ? 'blue' : undefined}>{item.enabled ? '已配置' : '未启用'}</Tag><Space size={4} wrap>{role === 'owner' && <Button size="small" aria-label={'配置' + item.platform} onClick={() => edit({ ...item, name: item.platform })}>配置</Button>}<Button size="small" aria-label={'查看' + item.platform + '数据'} onClick={() => setSourcePlatform(externalPlatforms.find(platform => platform.id === item.pluginId)!)}>查看数据</Button><Button type="text" size="small" disabled={!item.enabled} onClick={() => navigate('projects?tab=content')}>在项目中使用</Button></Space></footer>
    </article>)}</section>
    {sourcePlatform && <EnterpriseSourceData platform={sourcePlatform} onClose={() => setSourcePlatform(null)} />}
    <Drawer title="其他能力配置" width={680} open={configurationOpen} onClose={() => setConfigurationOpen(false)}><p className="ui-note">保留既有演示流程所需的能力开关。</p><Tabs activeKey={configurationTab} onChange={setConfigurationTab} items={configurationTabs} /><div className="page-stack">{configs.map(item => <FrameworkCard key={item.id} title={item.name} action={<Switch aria-label={'启用' + item.name} checked={item.enabled} disabled={role !== 'owner' || busy} onChange={value => void update('connection.update', { id: item.id, enabled: value, description: item.description })} />}><p>{item.description}</p><Button size="small" disabled={role !== 'owner'} onClick={() => edit(item)}>编辑配置</Button></FrameworkCard>)}</div></Drawer>
    <Modal title={'配置 · ' + (editing?.name ?? '')} open={!!editing} onCancel={() => setEditing(null)} okText="保存演示配置" cancelText="取消" confirmLoading={busy} okButtonProps={{ disabled: !description.trim() }} onOk={async () => { if (!editing) return; await update('connection.update', { id: editing.id, enabled, description: description.trim() }); setEditing(null); }}><p>范围：{state.workspace.team.name}</p><div className="ops-config-label">纳入演示流程</div><Switch aria-label="配置启用状态" checked={enabled} onChange={setEnabled} /><div className="ops-config-label">数据范围说明</div><Input.TextArea aria-label="数据范围说明" value={description} onChange={event => setDescription(event.target.value)} rows={4} maxLength={1500} showCount /><p className="ui-note">只保存本地演示配置，不发起真实外部连接。</p></Modal>
  </div>;
}
