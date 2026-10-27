import { Button, Empty, Space, Tag } from 'antd';
import { useDemo } from '../context.js';
import { taskNodeDefinitions, type TaskNodeItem, type TaskNodeReference, type TaskNodeView } from '../task-node-contract.js';
import type { RequirementNode } from '../delivery-requirements.js';
import './task-node-artifacts.css';

const statusLabels = { ready: '已就绪', missing: '待提交', unregistered: '未登记' };
const kindLabels = { reference: '资料引用', 'local-file': '本地文件引用', record: '已登记记录' };
const artifactLabel = (reference: TaskNodeReference) => Object.values(taskNodeDefinitions).flatMap(node => node.deliverableRequirements).find(item => item.artifact === reference.artifact)?.label ?? kindLabels[reference.kind];
export function TaskNodeArtifacts({ items, onSource }: { items: TaskNodeItem[]; onSource(node: RequirementNode): void }) {
  const { showText } = useDemo();
  const open = (reference: TaskNodeReference) => showText(reference.title, [reference.title, '', '类型：' + artifactLabel(reference), '来源：' + reference.sourceLabel, '版本：' + (reference.version ?? '未登记'), ...(reference.codeVersion ? ['代码版本：' + reference.codeVersion] : []), ...(reference.value ? ['引用：' + reference.value] : []), '', reference.description].join('\n'));
  return <div className="task-artifact-grid">{items.map(item => <section className="task-artifact-group" key={item.id} data-artifact-slot={item.id} data-artifact-status={item.status}>
    <div className="task-artifact-heading"><strong>{item.label}</strong><Tag>{statusLabels[item.status]}</Tag></div>
    {item.references.length ? item.references.slice(0, 2).map(reference => <div className="task-artifact-reference" key={reference.id} data-artifact-reference={reference.id}>
      <span className="task-artifact-name" title={reference.title}>{reference.title}</span>
      <p className="task-artifact-meta" title={reference.sourceLabel + ' · ' + (reference.version ?? '未登记版本')}>{reference.sourceLabel}{reference.version ? ' · ' + reference.version : ' · 版本未登记'}</p>
      {reference.codeVersion && <p className="task-artifact-meta" title={reference.codeVersion}>代码版本 · {reference.codeVersion}</p>}
      <Space size={8} wrap><Button type="link" size="small" onClick={() => open(reference)}>查看引用</Button>{reference.sourceNode && <Button type="link" size="small" onClick={() => onSource(reference.sourceNode!)}>来源：{taskNodeDefinitions[reference.sourceNode].label}</Button>}</Space>
    </div>) : <p className="task-artifact-missing">{item.status === 'unregistered' ? '现有记录未登记此项产物或输入。' : '等待提交可追踪的资料与版本。'}</p>}
    {item.references.length > 2 && <Button type="link" size="small" className="task-artifact-more" onClick={() => showText(item.label + ' · 全部引用', item.references.map(reference => [reference.title, '来源：' + reference.sourceLabel, '版本：' + (reference.version ?? '未登记'), ...(reference.value ? ['引用：' + reference.value] : []), reference.description].join('\n')).join('\n\n'))}>查看全部 {item.references.length} 项</Button>}
  </section>)}</div>;
}
export function TaskCompletionCriteria({ view }: { view: TaskNodeView }) {
  const { showText } = useDemo();
  return <section className="task-completion-criteria"><h3>完成标准</h3>{view.criteria.length ? view.criteria.map(item => <div key={item.id} data-completion-criterion={item.id} data-criterion-status={item.status}>
    <div><Tag>{item.status === 'reported' ? view.definition.id === 'accept' ? 'Owner 已确认' : '成员回传' : item.status === 'unregistered' ? '依据未登记' : '待完成'}</Tag><span>{item.label}</span></div>
    {item.evidenceIds.length > 0 && <Button type="link" size="small" onClick={() => showText(item.label + ' · 对应依据', JSON.stringify({ criterion: item, references: [...view.artifacts, ...view.deliverables.flatMap(slot => slot.references)].filter(reference => item.evidenceIds.includes(reference.id)) }, null, 2))}>查看对应依据</Button>}
  </div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未登记完成标准" />}<p className="muted">标准状态以本任务的明确回传或 Owner 确认为准；资料引用的正文与实际执行结论仍需核对。</p></section>;
}
export function nodeArtifactSummary(view: TaskNodeView) {
  return '交付物 ' + view.deliverables.filter(item => view.definition.deliverableRequirements.some(required => required.id === item.id) && item.status === 'ready').length + '/' + view.definition.deliverableRequirements.length;
}
