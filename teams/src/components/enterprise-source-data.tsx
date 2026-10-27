import { displayTalentArtifact } from '../talent-artifacts.js';
import { displayRequirementId, displayText } from '../display-text.js';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Descriptions, Drawer, Empty, Select, Space, Spin, Table, Tag } from 'antd';
import { useDemo } from '../context.js';
import { getBusinessKnowledge } from '../api.js';
import { externalPlatforms } from '../external-platforms.js';
import { createSourcePluginCatalog, sourceAssetKindLabels, type SourcePluginAsset } from '../source-plugins.js';
import { talentLink } from './common.js';

type Platform = (typeof externalPlatforms)[number];
type KnowledgeData = Awaited<ReturnType<typeof getBusinessKnowledge>>;
export function EnterpriseSourceData({ platform, onClose }: { platform: Platform; onClose: () => void }) {
  const { data } = useDemo();
  const catalog = useMemo(() => createSourcePluginCatalog(data), [data]);
  const businessKnowledge = platform.id === 'business-knowledge';
  const [selected, setSelected] = useState<SourcePluginAsset | null>(null), [referenceIndex, setReferenceIndex] = useState<number | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeData | null>(null), [loading, setLoading] = useState(businessKnowledge), [failure, setFailure] = useState(''), [attempt, setAttempt] = useState(0), [projectId, setProjectId] = useState('');
  useEffect(() => {
    if (!businessKnowledge) return;
    let live = true;setLoading(true);setFailure('');setKnowledge(null);setSelected(null);
    getBusinessKnowledge().then(result => { if (live) setKnowledge(result); }).catch(error => { if (live) setFailure(error instanceof Error ? error.message : '业务知识读取失败'); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [businessKnowledge, attempt]);
  const assets = businessKnowledge ? (knowledge?.assets ?? []).filter(item => !projectId || item.sourceProjectId === projectId) : catalog.list({ pluginId: platform.id });
  const sourceProject = knowledge?.projects.find(item => item.id === projectId);
  const emptyMessage = businessKnowledge ? sourceProject?.status === 'not-built' ? '此项目尚未构建业务知识。' : '暂无已构建的业务知识资产。' : '该插件尚无源数据';
  const reference = selected && referenceIndex !== null ? selected.references[referenceIndex] : undefined;
  const referenceContent = reference ? catalog.readReference(reference) : undefined;
  return <Drawer title={platform.name + ' · 源数据'} width={760} open onClose={onClose} className="enterprise-source-drawer">
    <div className="enterprise-source-body"><p className="ui-note">{businessKnowledge ? '以下业务知识来自独立 Talent 服务，仅展示已构建的知识资产，供项目查看与采用。' : '项目可选择关联插件提供的资产；外部连接与同步尚未接入。'}</p>
      {businessKnowledge && <Space wrap><Select aria-label="业务知识来源项目" value={projectId} style={{minWidth:220}} onChange={value => {setProjectId(value);setSelected(null);setReferenceIndex(null);}} options={[{value:'',label:'全部项目'},...(knowledge?.projects ?? []).map(item => ({value:item.id,label:item.name+' · '+(item.status === 'ready' ? '已构建' : '未构建')}))]} /><Button href={talentLink('knowledge',projectId ? {projectId} : undefined)}>在 Talent 查看 / 构建</Button></Space>}
      {loading ? <Spin tip="读取 Talent 业务知识"><div style={{height:100}} /></Spin> : failure ? <Alert showIcon type="error" title="业务知识读取失败" description={failure} action={<Button aria-label="重新读取业务知识" onClick={() => setAttempt(value => value + 1)}>重试</Button>} /> : selected ? <><Space wrap><Button size="small" onClick={() => { setSelected(null); setReferenceIndex(null); }}>返回数据</Button><Tag>{sourceAssetKindLabels[selected.kind]}</Tag></Space><h3>{displayText(selected.title)}</h3><p>{displayText(selected.summary)}</p>
        <Descriptions size="small" column={1} items={[{ key:'project',label:'来源项目',children:selected.sourceProjectName },{ key:'record',label:'源记录',children:displayRequirementId(selected.sourceRecordId) },{ key:'version',label:'版本',children:displayText(selected.version ?? '未标注') }]} />
        <div className="enterprise-source-detail">{selected.kind === 'knowledge' ? displayTalentArtifact(selected.detail) : displayText(selected.detail)}</div>
        {!!selected.references.length && <section><h4>本地参考资料</h4><Space wrap>{selected.references.map((item, index) => <Button key={item.collection + item.path} size="small" aria-pressed={referenceIndex === index} onClick={() => setReferenceIndex(index)}>{item.label}{item.extent === 'excerpt' ? ' · 节选' : ''}</Button>)}</Space></section>}
        {reference && <section className="enterprise-source-reference"><p className="ui-note">{reference.path} · 已导入本地资料{reference.extent === 'excerpt' ? '节选' : ''}</p>{referenceContent === undefined ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前导入资料不含此引用正文" /> : <pre>{referenceContent}</pre>}</section>}
      </> : <Table<SourcePluginAsset> size="small" rowKey="id" dataSource={assets} pagination={assets.length > 8 ? { pageSize: 8, showSizeChanger: false, size: 'small' } : false} columns={[
        { title:'源数据',key:'source',render:(_,item)=><div className="enterprise-source-entry"><Button type="link" onClick={() => setSelected(item)}>{displayText(item.title)}</Button><p>{displayText(item.summary)}</p><span>{sourceAssetKindLabels[item.kind]}{item.version ? ' · '+displayText(item.version) : ''}</span></div> },
        { title:'来源项目',dataIndex:'sourceProjectName',width:126 },
      ]} locale={{emptyText:emptyMessage}} />}
    </div>
  </Drawer>;
}
