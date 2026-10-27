import { useState } from 'react';
import { Alert, Button, Input, Modal, Space, Table, Tag } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { useDemo } from '../context.js';
import { FrameworkCard } from '../vendor/teams/components/page-layout.js';
import { ActionButton, MiniStat, StatusLine } from '../components/common.js';
import { runCashbackChecks } from '../cashback.js';
export function ProjectAcceptance() {
  const { state, role, perform, busy, showEvidence, navigate } = useDemo();
  const [returning, setReturning] = useState(false), [reason, setReason] = useState('');
  const submitted = state.stage === 'submitted', accepted = state.stage === 'accepted';
  const cases = runCashbackChecks();
  const reward = state.transactions.reduce((sum, item) => sum + item.reward, 0);
  return <div className="page-stack">
    {accepted ? <Alert type="success" showIcon title="功能验收已通过" description="白金卡消费返现已确认。生产安全事项仍待验证。" action={<Button onClick={() => navigate('trace')}>查看交付记录</Button>} /> : !submitted && <Alert type="info" showIcon title="等待成员提交交付包" />}
    <div className="acceptance-layout"><FrameworkCard title="白金卡消费返现"><div className="bank-card"><div><span>CardDemo</span><Tag>白金卡</Tag></div><div className="bank-chip" /><strong>••••  ••••  ••••  9900</strong><small>持卡人账户</small></div><div className="campaign"><Tag color="purple">白金卡专享</Tag><h2>消费回馈，多一点</h2><div className="cashback-number">0.5<span>% 额外返现</span></div><p>活动周期 3 个月 · 按消费金额计算</p><Button size="small" onClick={() => showEvidence('E1')}>查看规则依据</Button></div></FrameworkCard>
    <div className="page-stack"><FrameworkCard title="交易核验"><div className="business-stats"><MiniStat label="当前欠款" value={'¥' + state.balance.toFixed(2)} /><MiniStat label="本次返现" value={'¥' + reward.toFixed(2)} /></div><div className="acceptance-actions"><ActionButton action="purchase" role="owner" disabled={!submitted || state.transactions.length > 0}>消费 120 元</ActionButton><ActionButton action="deduplicate" role="owner" disabled={!submitted || !state.transactions.length || state.duplicateChecked} primary={false}>验证重复处理</ActionButton></div>{state.transactions.length > 0 && <div className="reward-record"><CheckCircleOutlined /><div><strong>消费返现 +{reward.toFixed(2)} 元</strong><small>同一交易 · 欠款已冲减</small></div><Tag color="green">1 条</Tag></div>}{state.duplicateChecked && <Alert type="success" title="未重复入账" description="同一交易再次处理，返现记录和欠款保持不变。" />}<p className="muted">使用隔离验收账户，不连接支付系统。</p></FrameworkCard>
    <FrameworkCard title="验收进度"><StatusLine complete={!!state.transactions.length}>消费 120 元，额外返现 0.60 元</StatusLine><StatusLine complete={state.duplicateChecked}>重复处理不重复入账</StatusLine><StatusLine complete={state.uat}>资格、周期与金额精度均符合规则</StatusLine></FrameworkCard></div></div>
    <FrameworkCard title="规则验证"><Table size="small" pagination={false} rowKey="id" dataSource={cases} columns={[{ title: '验证场景', dataIndex: 'label' }, { title: '预期结果', dataIndex: 'expected' }, { title: '结果', render: (_, row) => state.uat ? <Tag color={row.passed ? 'green' : 'red'}>{row.passed ? '符合预期' : '待处理'}</Tag> : <Tag>待验证</Tag> }]} /><div className="card-actions"><ActionButton action="uat" role="owner" disabled={!submitted || !state.duplicateChecked || state.uat}>验证全部规则</ActionButton><Button onClick={() => showEvidence('E2')}>查看规则说明</Button></div></FrameworkCard>
    <FrameworkCard title="验收结论"><p>确认功能范围与交付依据，安全验证单独跟进。</p><Space wrap><ActionButton action="accept" role="owner" disabled={!submitted || !state.uat || state.checks !== 'passed'}>{accepted ? '已通过功能验收' : '通过功能验收'}</ActionButton><Button disabled={!submitted || role !== 'owner'} onClick={() => setReturning(true)}>退回补充</Button></Space></FrameworkCard>
    <Modal open={returning} title="退回成员补充" okText="确认退回" confirmLoading={busy} okButtonProps={{ disabled: !reason.trim() }} onCancel={() => setReturning(false)} onOk={async () => { if (await perform('return', reason)) { setReturning(false); setReason(''); } }}><p>保留交付依据，补充后重新提交。</p><Input.TextArea aria-label="退回原因" value={reason} onChange={e => setReason(e.target.value)} maxLength={500} rows={4} placeholder="说明需要补充的内容" /></Modal>
  </div>;
}
