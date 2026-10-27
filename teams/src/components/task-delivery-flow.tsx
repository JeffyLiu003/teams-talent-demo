import type {TalentNodeInputs} from '../talent-node-inputs.js';
import {taskExecutableBy} from '../task-visibility.js';
import { deliveryRequirement } from '../delivery-requirements.js';
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { Alert, Button, Descriptions, Drawer, Empty, List, Space, Tag } from 'antd';
import { useDemo } from '../context.js';
import { triggerTaskAutomation } from '../api.js';
import { taskAutomation, collectTaskSessions, type TaskScope } from '../task-automation.js';
import { currentMemberOwnsTask } from '../task-assignment.js';
import '../task-delivery-flow.css';
export interface FlowNode { id: string; label: string; role: string; description: string; status: string; complete?: boolean; summary?: string }
const knowledgeLabels = { running: '正在导入', ready: '输入已就绪', waiting: '等待输入就绪', failed: '导入未完成' };
const collectionLabels = { queued: '等待自动归集', running: '正在归集', collected: '已归集 · 待上报', empty: '暂无关联会话', failed: '归集未完成' };
export function TaskDeliveryFlow({ scope, nodes, selected, onSelect, readonly = false, showAutomation = true, ariaPrefix = '节点：', nodeInputs }: { nodeInputs?:TalentNodeInputs;  scope: TaskScope; nodes: FlowNode[]; selected: string; onSelect(id: string): void; readonly?: boolean; showAutomation?: boolean; ariaPrefix?: string }) {
  const { state, role, receiveState } = useDemo();
  const [detail, setDetail] = useState<'knowledge' | 'collection' | null>(null), [pending, setPending] = useState(''), [error, setError] = useState('');
  const record = taskAutomation(state, scope), inFlight = useRef(false);
  const task=deliveryRequirement(state,scope.projectId,scope.taskId);
  const canWork=task ? taskExecutableBy(role,task.assigneeId) : role==='member'&&currentMemberOwnsTask(state);
  const canImport = !readonly && canWork && selected === 'prepare';
  const trigger = async (step: 'knowledge' | 'collection', retry = false) => {
    if (inFlight.current) return; inFlight.current = true; setPending(step); setError('');
    try { receiveState(await triggerTaskAutomation(role, scope, step, retry)); }
    catch (cause) { setError((cause as Error).message); }
    finally { inFlight.current = false; setPending(''); }
  };
  // Node inputs are automatically fetched through a read-only Talent request.
  // Merely viewing a task never records adoption or starts a mutable import job.
  useEffect(() => { if (!readonly && role === 'owner' && record?.collection?.status === 'queued') void trigger('collection'); }, [readonly, role, record?.collection?.status, scope.projectId, scope.taskId]);
  const flow = useRef<HTMLDivElement>(null), refs = useRef(new Map<string, HTMLButtonElement>()), marker = useId().replace(/\W/g, '');
  const [lines, setLines] = useState<{ id: string; d: string; color: string }[]>([]);
  useEffect(() => {
    const root = flow.current; if (!root) return;
    const measure = () => {
      const base = root.getBoundingClientRect(), rect = (id: string) => refs.current.get(id)?.getBoundingClientRect();
      const line = (id: string, x1: number, y1: number, x2: number, y2: number, color: string) => ({ id, color, d: `M ${x1-base.left} ${y1-base.top} L ${x2-base.left} ${y2-base.top}` });
      const output: typeof lines = [];
      nodes.slice(1).forEach((node,index) => { const a = rect(nodes[index].id), b = rect(node.id); if (!a || !b) return; const down = b.top >= a.bottom; output.push(down ? line(nodes[index].id+'-'+node.id,a.x+a.width/2,a.bottom+2,b.x+b.width/2,b.top-4,'muted') : line(nodes[index].id+'-'+node.id,a.right+2,a.y+a.height/2,b.left-4,b.y+b.height/2,'muted')); });
      const first = rect(nodes[0]?.id), last = rect(nodes.at(-1)?.id ?? ''), knowledge = rect('auto-knowledge'), collection = rect('auto-collection');
      if (showAutomation && first && last && knowledge && collection) {
        const narrow = knowledge.right < first.left;
        output.push(narrow ? line('knowledge-'+nodes[0].id,knowledge.right+2,knowledge.y+knowledge.height/2,first.left-4,first.y+first.height/2,'success') : line('knowledge-'+nodes[0].id,knowledge.x+knowledge.width/2,knowledge.top-2,first.x+first.width/2,first.bottom+4,'success'));
        output.push(narrow ? line(nodes.at(-1)!.id+'-collection',last.left-2,last.y+last.height/2,collection.right+4,collection.y+collection.height/2,'success') : line(nodes.at(-1)!.id+'-collection',last.x+last.width/2,last.bottom+2,collection.x+collection.width/2,collection.top-4,'success'));
      }
      setLines(output);
    };
    const observer = new ResizeObserver(measure); observer.observe(root); for (const element of refs.current.values()) observer.observe(element); measure();
    return () => observer.disconnect();
  }, [nodes.map(node=>node.id).join(','), showAutomation]);
  const bind = (id: string) => (element: HTMLButtonElement | null) => { if (element) refs.current.set(id,element); else refs.current.delete(id); };
  const inputs = record?.knowledge?.inputs;
  const collection = record?.collection;
  const receiptId = collection?.reporting?.receipt?.id ?? '';
  const receiptStatus = receiptId.startsWith('SHARED-') ? '已写入共享目录' : receiptId.startsWith('TALENT-INBOX-') ? '历史 Talent 已接收' : '已取得归集回执';
  const collectionStatus=collection?.reporting?.status==='reported'?receiptStatus:collection?.reporting?.status==='uploading'?'正在共享至 Talents':collection?.reporting?.status==='failed'?'上报未完成':collection?collectionLabels[collection.status]:'待验收通过';
  const sessions = collection?.sessions ?? collectTaskSessions(state, scope);
  return <div className="task-delivery-flow" data-flow-task={scope.taskId}>
    <div ref={flow} className={'task-flow-grid' + (!showAutomation ? ' no-automation' : '')} style={{ '--flow-count': nodes.length } as CSSProperties}>
      {/* Card header / status / participant structure adapted from Teams project-real-graph.tsx RealGraphCanvas. */}
      <div className="task-main-rail" aria-label="任务交付节点">{nodes.map(node => <Button key={node.id} htmlType="button" ref={bind(node.id)} data-flow-node={node.id} aria-label={ariaPrefix+node.label} aria-current={selected === node.id ? 'step' : undefined} aria-pressed={selected === node.id} className={'task-flow-card'+(selected===node.id?' selected':'')} onClick={() => onSelect(node.id)}><strong>{node.label}</strong><span className="task-flow-status"><Tag color={node.complete?'green':selected===node.id?'purple':undefined}>{node.status}</Tag></span><small>{node.role} · {node.summary ?? (readonly ? '原项目记录' : node.complete?'已有产出':'暂无产出')}</small></Button>)}</div>
      {showAutomation && <section className="task-talent-rail" aria-label="Talent 自动协作"><div className="task-talent-title"><span>Talent · 自动协作</span><small>后续分析异步进行，不影响任务完成</small></div>
        <Button htmlType="button" ref={bind('auto-knowledge')} data-flow-node="auto-knowledge" className="task-flow-card task-auto-card" aria-label="知识导入详情" onClick={() => setDetail('knowledge')}><strong>知识导入</strong><span className="task-flow-status"><Tag color={record?.knowledge?.status==='ready'?'green':undefined}>{nodeInputs ? nodeInputs.selection.status==='not-configured'?'当前节点未配置':nodeInputs.selection.basis==='recommendation'?'节点建议已读取':'节点采用依据可读' : readonly ? '原项目只读' : record?.knowledge ? knowledgeLabels[record.knowledge.status] : (task?!!task.assigneeId:state.assigned) ? '待进入准备' : '等待分配'}</Tag></span><small>开始前 · 加载知识与 Skill</small></Button>
        <Button htmlType="button" ref={bind('auto-collection')} data-flow-node="auto-collection" className="task-flow-card task-auto-card" aria-label="数据收集详情" onClick={() => setDetail('collection')}><strong>数据收集</strong><span className="task-flow-status"><Tag color={collection?.reporting?.status==='reported'?'green':collection?.reporting?.status==='failed'?'orange':undefined}>{readonly ? '原项目只读' : collectionStatus}</Tag></span><small>通过后 · 归集并共享</small></Button>
      </section>}
      <svg className="task-flow-connectors" aria-hidden="true"><defs>{['muted','success'].map(color => <marker key={color} id={marker+color} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill={'var(--ui-color-'+color+')'} /></marker>)}</defs>{lines.map(line => <path key={line.id} data-connection={line.id} d={line.d} fill="none" stroke={'var(--ui-color-'+line.color+')'} strokeWidth="1" markerEnd={'url(#'+marker+line.color+')'} />)}</svg>
    </div>
    {error && <Alert type="error" title="自动步骤未完成" description={error} action={<Button size="small" onClick={() => setDetail(canImport ? 'knowledge' : 'collection')}>查看详情</Button>} />}
    <Drawer title={detail === 'knowledge' ? '知识导入' : '数据收集'} width={650} open={!!detail} onClose={() => setDetail(null)} destroyOnHidden>
      {detail==='knowledge'&&nodeInputs?<div className="page-stack"><p>{nodeInputs.selection.note}</p><List size="small" header="当前节点知识" dataSource={nodeInputs.knowledge.assets} locale={{emptyText:'无当前节点相关知识'}} renderItem={item=><List.Item>{item.title} · {item.version}</List.Item>}/><List size="small" header="当前节点 Skill" dataSource={nodeInputs.skills} locale={{emptyText:'无当前节点相关 Skill'}} renderItem={item=><List.Item>{item.name} · {item.version}</List.Item>}/><p className="muted">当前读取不代表已采用或实际执行；历史采用内容保持原版本。</p></div>:readonly ? <Alert type="info" title="原项目任务只读" description="此快照未包含自动导入或归集执行回执，未发起新的执行。原任务身份和节点记录保持不变。" /> : detail === 'knowledge' ? <div className="page-stack">
        <p>当前节点输入正在读取或暂不可用；页面按项目、任务和节点读取 Talents 已发布知识及相关 Skill，读取不代表采用。下方保留旧任务导入记录，不能将其视为当前节点建议。</p>
        <Descriptions column={1} size="small" items={[{key:'status',label:'状态',children:record?.knowledge ? knowledgeLabels[record.knowledge.status] : '待触发'},{key:'time',label:'最近执行',children:record?.knowledge?.finishedAt ?? record?.knowledge?.startedAt ?? '—'},{key:'knowledge',label:'项目知识',children:inputs ? `${inputs.knowledge.length} 项 · ${inputs.knowledgeStatus === 'available' ? '已有版本可读' : '尚无可用项目知识'}` : '尚未读取'},{key:'skills',label:'可读 Skill',children:inputs?.skills.filter(skill=>skill.available).length ?? 0},{key:'materials',label:'需求与资料',children:inputs ? `${inputs.requirement} · ${inputs.references.length} 项资料 · ${inputs.materials.length} 项补充材料` : '尚未读取'}]} />
        {record?.knowledge?.error && <Alert type="error" title="导入未完成" description={record.knowledge.error} />}
        {record?.knowledge?.status === 'waiting' && <Alert type="info" title="等待输入就绪" description="现有项目知识或可读 Skill 尚未就绪。请核对项目知识与资源后重新检查；此步骤不会发起知识构建。" />}
        {inputs && <><List size="small" header="已读取的知识版本" dataSource={inputs.knowledge} locale={{emptyText:'无可用知识版本'}} renderItem={item=><List.Item>{item.title} · {item.version}</List.Item>} /><List size="small" header="Skill 版本" dataSource={inputs.skills} renderItem={item=><List.Item>{item.id} · {item.version}<Tag>{item.available?'可读':'不可用'}</Tag></List.Item>} /></>}
        <p className="muted">{task?'知识来自 Talents 已发布产物，Skill 来自已登记的 Teams 固定版本源包。':'知识来源：Talent 项目知识；Skill 来源：项目与固定订阅版本。'}</p><p className="muted">导入记录供交付人核对，不代替当前节点的采用确认，也不声明 iCode 已读取。</p>
        {canWork && record?.knowledge && record.knowledge.status !== 'ready' && <Button loading={pending==='knowledge'} disabled={!!pending} onClick={()=>void trigger('knowledge',true)}>重新检查输入</Button>}
      </div> : <div className="page-stack">
        <p>仅在 Owner 验收通过后自动归集本项目、本任务开发和验证节点的会话；按工具与会话标识去重，并保留全部来源节点。</p>
        <Descriptions column={1} size="small" items={[{key:'status',label:'状态',children:collectionStatus},{key:'count',label:'会话数量',children:collection?.sessions.length ?? 0},{key:'time',label:'归集时间',children:collection?.finishedAt ?? '—'},{key:'upload',label:'共享至 Talents',children:collection?.reporting?.status==='reported'?receiptStatus+' · '+collection.reporting.receipt?.id:collection?.reporting?.reason??'尚未上报'}]} />
        {collection?.error && <Alert type="error" title="归集未完成，验收结论保持有效" description={collection.error} />}
        <List size="small" dataSource={sessions} locale={{emptyText:<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无本任务关联会话"/>}} renderItem={item=><List.Item><div><strong>{item.tool} · {item.sessionId}</strong><p className="muted">来源节点：{item.nodeIds.join('、')} · {item.sources.join('、')}</p><small>{item.firstAt} — {item.lastAt}</small></div></List.Item>} />
        {collection?.reporting?.status==='failed'&&<Alert type="error" title="会话上报未完成，验收结论保持有效" description={collection.reporting.reason}/>}<p className="muted">SHARED 回执仅确认文件已写入共享目录，不代表 Talents 已读取或分析；归集失败不改变验收结论。</p>{collection?.reporting?.receipt&&<pre className="task-collection-receipt">{JSON.stringify(collection.reporting.receipt,null,2)}</pre>}
        {role==='owner' && collection && (['failed','running'].includes(collection.status)||collection.reporting?.status==='failed'||collection.reporting?.status==='pending') && <Button loading={pending==='collection'} disabled={!!pending} onClick={()=>void trigger('collection',true)}>重试数据归集</Button>}
      </div>}
    </Drawer>
  </div>;
}
