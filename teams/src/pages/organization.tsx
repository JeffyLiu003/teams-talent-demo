import { displayText } from '../display-text.js';
import { useState } from 'react';
import { Button, Collapse, Drawer, Empty, Input, Modal, Space, Switch, Tabs, Tag } from 'antd';
import { BookOutlined, BranchesOutlined, BugOutlined, ExperimentOutlined, FileTextOutlined } from '@ant-design/icons';
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
const platformIcons = { repository: <BranchesOutlined />, requirements: <FileTextOutlined />, defects: <BugOutlined />, 'design-library': <BookOutlined />, 'test-assets': <ExperimentOutlined /> };
const configurationTabs = [{ key: 'quality', label: '质量与安全' }, { key: 'services', label: '模型与工具服务' }];
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
  const [query, setQuery] = useState('');
  const rows: PlatformRow[] = externalPlatforms.map(source => ({ ...externalPlatformDefault(source.id)!, ...state.workspace.connections.find(item => item.id === ('connectionId' in source ? source.connectionId : source.id)), pluginId: source.id, platform: source.name, summary: source.description, dataTypes: source.dataTypes }));
  const filteredRows = rows.filter(item => [item.platform, item.summary, item.description, ...item.dataTypes].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  const configs = state.workspace.connections.filter(item => configurationTab === 'quality' ? item.kind === 'quality' : configurationTab === 'services' ? ['model','tool'].includes(item.kind) : item.kind === 'talent');
  const edit = (item: Connection) => { setEditing(item); setDescription(displayText(item.description)); setEnabled(item.enabled); };
  return <div className="page-stack enterprise-connections">
    <TeamsPageIntro actions={<Space wrap><Button size="small" onClick={() => setConfigurationOpen(true)}>高级能力设置</Button></Space>}>汇总外部资产与数据，在项目交付中关联使用。</TeamsPageIntro>
    <div className="connection-search"><Input.Search aria-label="搜索企业连接" placeholder="搜索平台或数据类型" allowClear value={query} onChange={event => setQuery(event.target.value)} /><span className="ui-note">{filteredRows.length} 个连接</span></div>
    <section className="enterprise-plugin-grid" aria-label="外部平台连接">{filteredRows.map(item => <article key={item.id} data-platform={item.pluginId} className="resource-card enterprise-plugin-card">
      <div className="resource-heading"><span className="resource-icon" aria-hidden>{platformIcons[item.pluginId as keyof typeof platformIcons]}</span><div><h3>{item.platform}</h3><p>{item.summary}</p></div></div>
      <div className="enterprise-plugin-data"><span className="ui-note">提供数据</span><Space size={4} wrap>{item.dataTypes.map(type => <Tag key={type}>{type}</Tag>)}</Space></div>
      <div className="enterprise-plugin-scope"><span className="ui-note">访问范围 · {state.workspace.team.name}</span>{item.description !== item.summary && <p>{displayText(item.description)}</p>}</div>
      <footer><Tag color={item.enabled ? 'blue' : undefined}>{item.enabled ? '已配置' : '未启用'}</Tag><Space size={4} wrap>{role === 'owner' && <Button size="small" aria-label={'配置' + item.platform} onClick={() => edit({ ...item, name: item.platform })}>配置</Button>}<Button size="small" aria-label={'查看' + item.platform + '数据'} onClick={() => setSourcePlatform(externalPlatforms.find(platform => platform.id === item.pluginId)!)}>查看数据</Button><Button type="text" size="small" disabled={!item.enabled} onClick={() => navigate('projects?tab=content')}>在项目中使用</Button></Space></footer>
    </article>)}</section>{!filteredRows.length && <Empty description="没有匹配的连接"><Button onClick={() => setQuery('')}>清空搜索</Button></Empty>}
    {sourcePlatform && <EnterpriseSourceData platform={sourcePlatform} onClose={() => setSourcePlatform(null)} />}
    <Drawer title="高级能力设置" width={680} open={configurationOpen} onClose={() => setConfigurationOpen(false)}><p className="ui-note">管理协作流程所需的能力开关。</p><Tabs activeKey={configurationTab} onChange={setConfigurationTab} items={configurationTabs} /><div className="page-stack">{configs.map(item => <FrameworkCard key={item.id} title={item.name} action={<Switch aria-label={'启用' + item.name} checked={item.enabled} disabled={role !== 'owner' || busy} onChange={value => void update('connection.update', { id: item.id, enabled: value, description: item.description })} />}><p>{displayText(item.description)}</p><Button size="small" disabled={role !== 'owner'} onClick={() => edit(item)}>编辑配置</Button></FrameworkCard>)}</div></Drawer>
    <Modal title={'配置 · ' + (editing?.name ?? '')} open={!!editing} onCancel={() => setEditing(null)} okText="保存配置" cancelText="取消" confirmLoading={busy} okButtonProps={{ disabled: !description.trim() }} onOk={async () => { if (!editing) return; const saved = await update('connection.update', { id: editing.id, enabled, description: description.trim() }); if (saved) setEditing(null); }}><p>范围：{state.workspace.team.name}</p><div className="ops-config-label">启用能力</div><Switch aria-label="配置启用状态" checked={enabled} onChange={setEnabled} /><Collapse className="connection-advanced" ghost items={[{ key: 'scope', label: '高级：数据范围说明', children: <Input.TextArea aria-label="数据范围说明" value={description} onChange={event => setDescription(event.target.value)} rows={4} maxLength={1500} showCount /> }]} /><p className="ui-note">保存配置不会建立外部连接或同步数据。</p></Modal>
  </div>;
}
