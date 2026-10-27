import { useState } from 'react';
import { Alert, Button, Empty, Input, Modal, Pagination, Select, Space } from 'antd';
import { AppstoreOutlined, BarsOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useDemo } from '../context.js';
import { ActionButton, talentLink } from '../components/common.js';
import { SkillApplication } from '../components/skill-application.js';
import { getResourceContent } from '../api.js';
import { projectSkillIds, resourcePublications, resourceSubscriptions, resourceVersion } from '../resource-sharing.js';
import { ResourceCatalogEntry, ResourceLibraryEntry, type ResourceEntry } from '../vendor/teams/resources/catalog.js';
import '../vendor/teams/resources/resources.css';

type ResourcePage = 'resources' | 'subscriptions' | 'publications';
export function Resources({ page = 'resources' }: { page?: ResourcePage }) {
  const { state, data, role, showText, navigate, update, busy } = useDemo();
  const [search, setSearch] = useState(''), [category, setCategory] = useState(''), [scope, setScope] = useState(''), [tool, setTool] = useState(''), [sort, setSort] = useState('project'), [view, setView] = useState<'grid' | 'list'>('grid'), [current, setCurrent] = useState(1);
  const [detailId, setDetail] = useState<string | null>(null), [publishing, setPublishing] = useState(false), [publishId, setPublishId] = useState('code-agent');
  const [publishingAll, setPublishingAll] = useState(false), [publishAllFailed, setPublishAllFailed] = useState(false);
  const [reading, setReading] = useState(false), [contentError, setContentError] = useState('');
  const chosen = new Set(projectSkillIds);
  const publications = new Map(resourcePublications(state).map(item => [item.id, item]));
  const subscriptions = new Map(resourceSubscriptions(state, role).map(item => [item.id, item]));
  const userName = role === 'owner' ? '林悦' : '陈晨';
  const entries: ResourceEntry[] = [{ id: 'code-agent', name: 'Code Agent', description: '项目开发 Agent 配置；按已采用的业务 Skill 实施需求，保留检查与交付依据。配置展示不代表原生 Agent 已安装。', category: 'agent' as const, version: state.adoptedAgent, owner: '林悦 · 项目 Owner', scope: '项目内可用', tool: 'icode', selected: true }, ...data.skills.map(skill => ({ id: skill.name, name: skill.name, description: skill.description, category: 'skill' as const, version: skill.version, owner: '', scope: '团队共享', tool: 'icode', selected: chosen.has(skill.name) }))].map(item => {
    const publication = publications.get(item.id), subscription = subscriptions.get(item.id);
    return { ...item, owner: publication ? publication.publisher === 'owner' ? '林悦 · 项目 Owner' : '研发效能团队 · 资源库' : item.category === 'agent' ? item.owner : (item.selected ? '林悦 · 项目 Owner' : '研发效能团队 · 资源库') + '（待发布）', scope: publication ? '团队共享' : item.category === 'agent' ? item.scope : '待发布', version: page === 'subscriptions' && subscription ? subscription.version : publication?.version ?? item.version, availability: subscription?.source === 'subscription' ? '当前用户已订阅 · 应用与任务采用分别管理' : item.category === 'agent' ? '项目 Agent 配置 · 原生安装未核验' : publication ? '已发布 · 可订阅并查看完整正文' : '尚未发布' };
  });
  const acquired = (item: ResourceEntry) => subscriptions.has(item.id);
  const base = page === 'resources' ? entries : page === 'publications' ? role === 'owner' ? entries.filter(item => publications.get(item.id)?.publisher === 'owner') : [] : entries.filter(acquired);
  const filtered = base.filter(item => (!category || item.category === category) && (page !== 'resources' || !scope || (scope === 'project' ? item.selected : publications.get(item.id)?.publisher === scope)) && (page !== 'resources' || !tool || item.tool === tool) && `${item.name} ${item.description} ${item.owner}`.toLowerCase().includes(search.toLowerCase())).sort((a,b) => sort === 'name' ? a.name.localeCompare(b.name) : Number(b.selected) - Number(a.selected));
  const change = (work: () => void) => { work(); setCurrent(1); };
  const action = (item: ResourceEntry) => {
    const subscription = subscriptions.get(item.id), publication = publications.get(item.id);
    const subscribed = subscription?.source === 'subscription';
    return <Space wrap>{(item.selected || subscribed) && <Button onClick={() => navigate('projects?tab=delivery&node=prepare')}>{state.context ? '查看需求采用' : '在需求中选用'}</Button>}{publication && <Button data-workspace="resource.acquire" data-resource={item.id} disabled={subscribed} loading={busy} onClick={() => void update('resource.acquire', { name: item.id, version: publication.version })}>{subscribed ? '已订阅' : subscription ? '核实并订阅' : '获取 / 订阅'}</Button>}{item.category === 'skill' && subscription?.sha256 && <SkillApplication resourceId={item.id} version={subscription.version} sha256={subscription.sha256} />}</Space>;
  };
  const categories = <div className="catalog-categories" role="group" aria-label="资源分类">{[['','全部'],['agent','Agent'],['skill','Skill']].map(([key,label]) => <button key={key} aria-pressed={category === key} onClick={() => change(() => setCategory(key))}>{label}</button>)}</div>;
  const publishable = entries.filter(item => item.selected);
  const isCurrentPublished = (id: string) => { const publication = publications.get(id); return publication?.version === resourceVersion(state, id) && (id === 'code-agent' || !!publication?.sha256 && publication.sha256 === data.skillCatalog.find(item => item.id === id)?.sha256); };
  const allSkillsPublished = data.skills.every(skill => isCurrentPublished(skill.name));
  const publishAllButton = role === 'owner' && <Button aria-label="发布全部 Skill" disabled={allSkillsPublished} onClick={() => { setPublishAllFailed(false); setPublishingAll(true); }}>{allSkillsPublished ? `${data.skills.length} 项 Skill 均已发布` : '发布全部 Skill'}</Button>;
  const publishButton = role === 'owner' && <Button aria-label="发布资源" type="primary" icon={<PlusOutlined />} onClick={() => { setPublishId(publishable.find(item => !isCurrentPublished(item.id))?.id ?? 'code-agent'); setPublishing(true); }}>发布资源</Button>;
  const publishingEntry = entries.find(item => item.id === publishId), detail = entries.find(item => item.id === detailId);
  const pageNumber = Math.min(current, Math.max(1, Math.ceil(filtered.length / 9)));
  const readContent = async (item: ResourceEntry) => {
    setReading(true); setContentError('');
    try {
      const binding = page === 'subscriptions' ? subscriptions.get(item.id) : publications.get(item.id);
      if (binding) {
        if (!binding.sha256) throw new Error('历史记录未保存内容包哈希，请先核实并发布对应版本。');
        const result = await getResourceContent(role, { resourceId: item.id, version: binding.version, sha256: binding.sha256 });
        showText(item.name + ' · ' + result.version + ' · 完整 Skill 正文', result.content);
      } else {
        const content = data.skillContents[item.id];
        if (!content) throw new Error('当前资源正文不可用，请重新读取资源数据。');
        showText(item.name + ' · 本地来源正文', content);
      }
    } catch (cause) { setContentError((cause as Error).message); }
    finally { setReading(false); }
  };
  return <div className={'page-stack teams-resources ' + (page === 'resources' ? 'teams-resource-market' : 'teams-resource-library')}>
    <div className="market-head"><p className="ui-note">{page === 'resources' ? '发现个人与团队发布的 Skill，订阅固定版本并应用到 iCode。' : page === 'subscriptions' ? `当前用户 ${userName} 的订阅；每项保留订阅版本，应用到本机需单独确认。` : `当前用户 ${userName} 发布的资源；其他团队资源在市场查看。`}</p><Space wrap>{page !== 'subscriptions' && <>{publishAllButton}{publishButton}</>}</Space></div>
    <p className="ui-note">原有 {chosen.size} 项项目 Skill 可直接选用；其余 Skill 由当前用户订阅后进入需求选择。订阅、任务采用和 iCode 应用分别记录。</p>
    <div className={page === 'resources' ? 'resource-toolbar' : 'resource-filters'} role="region" aria-label="资源工具栏"><Input aria-label="搜索资源" placeholder="搜索 Agent、Skill、发布者…" prefix={<SearchOutlined />} value={search} onChange={event => change(() => setSearch(event.target.value))} />{page === 'resources' ? <><div className="resource-tools"><Select aria-label="工具筛选" value={tool} onChange={value => change(() => setTool(value))} options={[{value:'',label:'全部工具'},{value:'icode',label:'iCode'},{value:'opencode',label:'OpenCode'}]} /><Select aria-label="排序方式" value={sort} onChange={value => change(() => setSort(value))} options={[{value:'project',label:'项目已有优先'},{value:'name',label:'名称'}]} /></div><Space.Compact><Button aria-label="网格视图" aria-pressed={view === 'grid'} type={view === 'grid' ? 'primary' : 'default'} icon={<AppstoreOutlined />} onClick={() => setView('grid')} /><Button aria-label="列表视图" aria-pressed={view === 'list'} type={view === 'list' ? 'primary' : 'default'} icon={<BarsOutlined />} onClick={() => setView('list')} /></Space.Compact></> : categories}</div>
    {page === 'resources' && <>{categories}<div className="catalog-summary"><span>匹配 {filtered.length} 个资源 · 市场共 {data.skills.length} 项 Skill · 1 个项目 Agent 配置</span><div className="resource-scopes" role="group" aria-label="资源归属">{[['','全部'],['owner','Owner 发布'],['library','团队资源库'],['project','项目已有']].map(([key,label]) => <button key={key} aria-pressed={scope === key} onClick={() => change(() => setScope(key))}>{label}</button>)}</div></div></>}
    {page === 'resources' ? <><div className={view === 'grid' ? 'resource-grid' : 'resource-rows'}>{filtered.slice((pageNumber-1)*9,pageNumber*9).map(item => <ResourceCatalogEntry key={item.id} item={item} view={view} details={() => setDetail(item.id)} action={action(item)} />)}</div>{!filtered.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的资源" />}<Pagination responsive showLessItems current={pageNumber} pageSize={9} total={filtered.length} onChange={setCurrent} showSizeChanger={false} hideOnSinglePage /></> : <div className="resource-library-list">{filtered.map(item => <ResourceLibraryEntry key={item.id} item={item} meta={page === 'publications' ? `${item.category === 'skill' ? 'Skill' : 'Agent 配置'} · iCode · 发布者 ${item.owner} · ${item.version} · 已发布` : `${item.category === 'skill' ? 'Skill' : 'Agent 配置'} · ${userName} 已订阅 · 固定版本 ${item.version} · 发布者 ${item.owner}`} actions={<><Button onClick={() => setDetail(item.id)}>查看详情</Button>{page === 'subscriptions' ? action(item) : <Button onClick={() => showText('共享范围 · ' + item.name, `发布者：${item.owner}\n共享范围：${state.workspace.team.name}\n资源：${item.name}\n发布版本：${item.version}\n\n此发布记录只对应当前资源。订阅归属各用户；本机应用与任务采用分别确认。`)}>共享范围</Button>}</>} />)}{!filtered.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={page === 'publications' ? role === 'owner' ? '暂无个人发布项。' : '当前成员暂无个人发布，可在资源市场查看团队资源。' : '当前用户尚未订阅资源，可在市场获取所需 Skill。'} />}</div>}
    {state.evolution !== 'none' && <section className="resource-library-entry"><h3>来自 Talent 的能力更新</h3><p className="ui-note">本次作业：Skill {state.context?.skillVersion ?? '1.0.0'} · Agent {state.context?.agentVersion ?? 'r1'}；下一次可采用：Skill 1.1.0 · Agent r2。</p><Space wrap><ActionButton action="adopt" role="owner" disabled={state.evolution !== 'published'}>{state.evolution === 'adopted' ? '项目已采用新版' : '项目采用新版本'}</ActionButton>{role === 'owner' && <Button href={talentLink('evolution')}>查看 Talent 评估</Button>}</Space></section>}
    <Modal title={detail?.name} open={!!detail} onCancel={() => { setDetail(null); setContentError(''); }} footer={<Button onClick={() => { setDetail(null); setContentError(''); }}>知道了</Button>}><p>{detail?.description}</p>{detail && <><div className="resource-detail-lines">类型：{detail.category === 'skill' ? 'Skill' : 'Agent 配置'}<br />适用工具：iCode<br />{publications.has(detail.id) ? '发布者' : '维护方'}：{detail.owner}<br />可用范围：{detail.scope}<br />发布版本：{publications.get(detail.id)?.version ?? detail.version}{subscriptions.has(detail.id) && <><br />当前用户订阅版本：{subscriptions.get(detail.id)!.version}</>}<br />资源 ID：{detail.id}{detail.category === 'agent' && <><br />原生 Agent 安装：未核验</>}</div>{contentError && <Alert type="error" title="正文读取失败" description={contentError} />}<div className="resource-actions">{detail.category === 'skill' && <Button data-skill-content={detail.id} loading={reading} onClick={() => void readContent(detail)}>{page === 'subscriptions' ? '查看订阅版本正文' : '查看 Skill 内容'}</Button>}{action(detail)}</div></>}</Modal>
    <Modal title="发布全部 Skill" open={publishingAll && role === 'owner'} onCancel={() => setPublishingAll(false)} closable={!busy} maskClosable={!busy} footer={<Space><Button disabled={busy} onClick={() => setPublishingAll(false)}>取消</Button><Button type="primary" data-workspace="resource.publish-all" loading={busy} disabled={allSkillsPublished} onClick={async () => { setPublishAllFailed(false); const saved = await update('resource.publish-all', {}); if (saved) setPublishingAll(false); else setPublishAllFailed(true); }}>确认发布全部 Skill</Button></Space>}><p>将 {data.skills.length} 项 Skill 的完整内容及固定版本发布到资源市场。</p><p>{chosen.size} 项原有项目 Skill 由林悦 · 项目 Owner 发布；其余 {data.skills.length - chosen.size} 项由研发效能团队 · 资源库发布。</p><p className="ui-note">发布不会自动订阅、安装到本机或改变当前任务采用版本。Code Agent 配置仍单独发布。</p>{publishAllFailed && <Alert type="error" title="发布未完成" description="服务未确认本次发布，请查看错误信息后重试。" />}</Modal>
    <Modal title="发布单个资源" open={publishing && role === 'owner'} onCancel={() => setPublishing(false)} footer={<Space><Button onClick={() => setPublishing(false)}>关闭</Button><Button type="primary" data-workspace="resource.publish" loading={busy} disabled={isCurrentPublished(publishId)} onClick={() => void update('resource.publish', { id: publishId })}>{isCurrentPublished(publishId) ? '此版本已发布' : '发布此资源'}</Button></Space>}><p>选择由项目 Owner 维护的 Skill 或 Agent 配置，供团队成员获取或订阅。</p><Select aria-label="选择发布资源" style={{ width: '100%' }} value={publishId} onChange={setPublishId} options={publishable.map(item => ({ value: item.id, label: `${item.name} · ${resourceVersion(state, item.id)}${isCurrentPublished(item.id) ? ' · 已发布' : ''}` }))} /><p>{publishingEntry?.description}</p><p className="ui-note">共享范围：{state.workspace.team.name} · 发布者：林悦</p>{isCurrentPublished(publishId) && <Alert type="success" showIcon title="资源已发布" action={<Button onClick={() => { setPublishing(false); navigate('publications'); }}>查看我的发布</Button>} />}</Modal>
  </div>;
}
