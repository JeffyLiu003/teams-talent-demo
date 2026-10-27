import { displayRequirementId, displayText } from '../display-text.js';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Button, Empty, Form, Input, Modal, Select, Space, Table, Tabs, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useDemo } from '../context.js';
import { createSourcePluginCatalog, sourceAssetKindLabels, type SourcePluginAsset } from '../source-plugins.js';
import { legacyAssetSourceIds } from '../project-asset-links.js';
import type { Asset } from '../workspace.js';
import { externalPlatforms } from '../external-platforms.js';
import { FrameworkCard } from '../vendor/teams/components/page-layout.js';
import { Mono } from './common.js';

interface AssetRow { id: string; title: string; kind: string; location: string; source?: SourcePluginAsset; local?: Asset }
const kinds: Record<string, string> = { ...sourceAssetKindLabels, other: '其他资料' };

export function ProjectAssets({ projectId, extra }: { projectId: string; extra?: ReactNode }) {
  const { state, data, role, busy, update, showText, showEvidence } = useDemo();
  const catalog = useMemo(() => createSourcePluginCatalog(data), [data]);
  const [open, setOpen] = useState(false), [mode, setMode] = useState('plugin'), [plugin, setPlugin] = useState('all'), [selected, setSelected] = useState<string>(), [failed, setFailed] = useState(false);
  const [form] = Form.useForm();
  const readOnly = projectId === 'teams', canWrite = role === 'owner' && !readOnly;
  const local = projectId === 'carddemo' ? state.workspace.project.assets : state.workspace.projects?.find(project => project.id === projectId)?.assets ?? [];
  const rowFromSource = (source: SourcePluginAsset): AssetRow => ({ id: source.id, title: displayText(source.title), kind: source.kind, location: source.references.map(reference => reference.path).join(' · ') || displayRequirementId(source.sourceRecordId), source });
  const rows: AssetRow[] = readOnly
    ? ['repository:teams:icode-teams', ...data.teamsProject.project.docs.map(doc => 'design-library:teams:' + doc.path)].map(id => { const source = catalog.get(id); if (!source) throw new Error('导入项目资料来源缺失：' + id); return rowFromSource(source); })
    : local.flatMap(asset => {
      const ids = projectId === 'carddemo' ? legacyAssetSourceIds(asset) : asset.sourceAssetId ? [asset.sourceAssetId] : [];
      return ids.length ? ids.map(id => { const source = catalog.get(id); return source ? rowFromSource(source) : { ...asset, id, local: asset }; }) : [{ ...asset, local: asset }];
    });
  const linked = new Set(rows.map(row => row.source?.id).filter(Boolean));
  const candidates = catalog.list(projectId === 'carddemo' ? { sourceProjectId: 'carddemo' } : undefined).filter(asset => !linked.has(asset.id) && (plugin === 'all' || asset.pluginId === plugin));
  const selectedAsset = selected ? catalog.get(selected) : undefined;
  const pluginName = (id: string) => externalPlatforms.find(item => item.id === id)?.name ?? id;
  const inspect = (row: AssetRow) => {
    if (row.source) {
      const asset = row.source;
      showText(asset.title + ' · 来源详情', [`来源：${pluginName(asset.pluginId)} · 来源插件`, `来源项目：${asset.sourceProjectName}`, `记录：${displayRequirementId(asset.sourceRecordId)}`, `版本：${displayText(asset.version ?? '来源记录')}`, '', displayText(asset.detail), ...asset.references.flatMap(reference => ['', `${reference.label} · ${reference.extent === 'excerpt' ? '源码节选' : '原文件'}`, reference.path, catalog.readReference(reference) ?? '当前导入资料未包含此文件正文。'])].join('\n'));
    } else if (projectId === 'carddemo' && row.local?.id === 'history') showEvidence('E1');
    else showText(row.title, `${row.location}\n\n${row.local?.sourceAssetId ? '此已保存的插件来源当前不可用，保留原关联信息。' : '用户手工登记的项目引用。'}\n\n${data.sources.find(source => source.file === row.location)?.content ?? '当前导入资料未包含此引用的正文。'}`);
  };
  const close = () => { setOpen(false); setFailed(false); setSelected(undefined); form.resetFields(); };
  return <>
    <FrameworkCard title="项目资料与资产" action={canWrite ? <Button icon={<PlusOutlined />} aria-label="关联项目资产" onClick={() => { setMode('plugin'); setPlugin('all'); setFailed(false); setOpen(true); }}>关联项目资产</Button> : <Tag>{readOnly ? '导入快照 · 只读' : '项目成员 · 只读'}</Tag>}>
      {rows.length ? <Table<AssetRow> rowKey="id" size="small" pagination={false} scroll={{ x: 680 }} dataSource={rows} columns={[
        { title: '资产', dataIndex: 'title' }, { title: '类型', width: 130, dataIndex: 'kind', render: kind => <Tag>{kinds[kind] ?? kind}</Tag> },
        { title: '来源与引用', render: (_, row) => <><p className="muted">{row.source ? pluginName(row.source.pluginId) + ' · 来源插件' : row.local?.sourceAssetId ? '来源记录暂不可用' : row.local?.id === 'history' ? '历史证据' : '手工引用'}</p><Mono>{row.location}</Mono></> },
        { title: '操作', width: 100, render: (_, row) => <Button size="small" aria-label={'查看来源：' + row.title} onClick={() => inspect(row)}>查看来源</Button> },
      ]} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未关联项目资料" />}
      {extra}
      <p className="muted">这里只汇总本项目已关联的资产。插件数据和手工引用保留各自来源，需求条目需另行讨论与分配。</p>
    </FrameworkCard>
    <Modal open={open} title="关联项目资产" width={680} footer={null} onCancel={close} closable={!busy} maskClosable={!busy} destroyOnHidden>
      {failed && <Alert type="error" title="关联未保存，请核对错误提示后重试。" />}
      <Tabs activeKey={mode} onChange={setMode} items={[
        { key: 'plugin', label: '来源插件', children: <div className="page-stack">
          <p className="muted">从已接入插件的数据中选择；关联后保留原来源记录。</p>
          <Select aria-label="筛选资产来源" value={plugin} onChange={value => { setPlugin(value); setSelected(undefined); }} options={[{ value: 'all', label: '全部来源插件' }, ...externalPlatforms.filter(item => item.id !== 'business-knowledge').map(item => ({ value: item.id, label: item.name }))]} />
          <Select aria-label="选择来源资产" placeholder="选择要关联的资产" showSearch={{ optionFilterProp: 'label' }} value={selected} onChange={setSelected} options={candidates.map(asset => ({ value: asset.id, label: `${displayText(asset.title)} · ${pluginName(asset.pluginId)} · ${asset.sourceProjectName}`, disabled: state.workspace.connections.some(connection => connection.id === asset.pluginId && !connection.enabled) }))} notFoundContent="没有可关联的来源资产" />
          {selectedAsset && <div><Tag>来源插件</Tag><p>{displayText(selectedAsset.summary)}</p><Space wrap><Button size="small" onClick={() => inspect(rowFromSource(selectedAsset))}>查看所选来源</Button><span className="muted">{displayText(selectedAsset.version ?? '未记录版本')}</span></Space></div>}
          <Button type="primary" loading={busy} disabled={!selected} onClick={async () => { setFailed(false); const saved = await update('asset.link', { projectId, sourceAssetId: selected }); if (saved) close(); else setFailed(true); }}>关联所选资产</Button>
        </div> },
        { key: 'manual', label: '手工引用', children: <Form form={form} layout="vertical" initialValues={{ kind: 'document' }} disabled={busy} onFinish={async values => { setFailed(false); const saved = await update('asset.add', { ...values, projectId }); if (saved) close(); else setFailed(true); }}>
          <Form.Item name="title" label="资产名称" rules={[{ required: true, whitespace: true }]}><Input aria-label="资产名称" maxLength={120} /></Form.Item>
          <Form.Item name="kind" label="资产类型" rules={[{ required: true }]}><Select options={Object.entries(kinds).map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item name="location" label="来源地址或路径" rules={[{ required: true, whitespace: true }]}><Input aria-label="来源地址或路径" maxLength={500} /></Form.Item>
          <Button type="primary" htmlType="submit" loading={busy}>保存资产引用</Button><p className="muted">保存手工引用，不读取凭据或抓取外部内容。</p>
        </Form> },
      ]} />
    </Modal>
  </>;
}
