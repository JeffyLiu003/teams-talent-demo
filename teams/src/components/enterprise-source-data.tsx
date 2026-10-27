import { displayRequirementId, displayText } from '../display-text.js';
import { useMemo, useState } from 'react';
import { Button, Descriptions, Drawer, Empty, Space, Table, Tag } from 'antd';
import { useDemo } from '../context.js';
import { externalPlatforms } from '../external-platforms.js';
import { createSourcePluginCatalog, sourceAssetKindLabels, type SourcePluginAsset } from '../source-plugins.js';

type Platform = (typeof externalPlatforms)[number];
export function EnterpriseSourceData({ platform, onClose }: { platform: Platform; onClose: () => void }) {
  const { data } = useDemo();
  const catalog = useMemo(() => createSourcePluginCatalog(data), [data]);
  const [selected, setSelected] = useState<SourcePluginAsset | null>(null), [referenceIndex, setReferenceIndex] = useState<number | null>(null);
  const assets = catalog.list({ pluginId: platform.id });
  const reference = selected && referenceIndex !== null ? selected.references[referenceIndex] : undefined;
  const referenceContent = reference ? catalog.readReference(reference) : undefined;
  return <Drawer title={platform.name + ' · 源数据'} width={760} open onClose={onClose} className="enterprise-source-drawer">
    <div className="enterprise-source-body"><p className="ui-note">项目可选择关联插件提供的资产；外部连接与同步尚未接入。</p>
      {selected ? <><Space wrap><Button size="small" onClick={() => { setSelected(null); setReferenceIndex(null); }}>返回数据</Button><Tag>{sourceAssetKindLabels[selected.kind]}</Tag></Space><h3>{displayText(selected.title)}</h3><p>{displayText(selected.summary)}</p>
        <Descriptions size="small" column={1} items={[{ key:'project',label:'来源项目',children:selected.sourceProjectName },{ key:'record',label:'源记录',children:displayRequirementId(selected.sourceRecordId) },{ key:'version',label:'版本',children:displayText(selected.version ?? '未标注') }]} />
        <div className="enterprise-source-detail">{displayText(selected.detail)}</div>
        {!!selected.references.length && <section><h4>本地参考资料</h4><Space wrap>{selected.references.map((item, index) => <Button key={item.collection + item.path} size="small" aria-pressed={referenceIndex === index} onClick={() => setReferenceIndex(index)}>{item.label}{item.extent === 'excerpt' ? ' · 节选' : ''}</Button>)}</Space></section>}
        {reference && <section className="enterprise-source-reference"><p className="ui-note">{reference.path} · 已导入本地资料{reference.extent === 'excerpt' ? '节选' : ''}</p>{referenceContent === undefined ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前导入资料不含此引用正文" /> : <pre>{referenceContent}</pre>}</section>}
      </> : <Table<SourcePluginAsset> size="small" rowKey="id" dataSource={assets} pagination={assets.length > 8 ? { pageSize: 8, showSizeChanger: false, size: 'small' } : false} columns={[
        { title:'源数据',key:'source',render:(_,item)=><div className="enterprise-source-entry"><Button type="link" onClick={() => setSelected(item)}>{displayText(item.title)}</Button><p>{displayText(item.summary)}</p><span>{sourceAssetKindLabels[item.kind]}{item.version ? ' · '+displayText(item.version) : ''}</span></div> },
        { title:'来源项目',dataIndex:'sourceProjectName',width:126 },
      ]} locale={{emptyText:'该插件尚无源数据'}} />}
    </div>
  </Drawer>;
}
