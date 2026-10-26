import { useState } from 'react';
import { Button, Empty, Input, Modal, Popconfirm, Select, Space, Tag } from 'antd';
import { UserAddOutlined } from '@ant-design/icons';
import { useDemo } from '../context.js';
import { Origin } from '../components/common.js';
import { TeamsPageIntro } from '../components/teams-reuse.js';
import '../vendor/teams/team-groups.css';
/** Presentation port: business/foundation/team-groups/src/client/ui/index.ts,
 * mount/group-layout, renderPending, renderGroups, renderDetail. Demo commands
 * keep the existing fixed identities and local invitation acceptance flow. */
export function Team() {
  const { state, role, update, busy, navigate } = useDemo();
  const team = state.workspace.team, owner = role === 'owner';
  const [inviting, setInviting] = useState(false), [name, setName] = useState(''), [renaming, setRenaming] = useState(false), [teamName, setTeamName] = useState(team.name);
  const active = team.members.filter(member => member.status === 'active'), pending = team.members.filter(member => member.status === 'invited');
  return <div id="demo-team-groups" className="page-stack group-manager">
    <TeamsPageIntro extension="布局复用原 Teams 用户群组。团队名册、固定角色和邀请接受保留现有演示约定；团队权限管理在原客户端尚未接入。" actions={<Space><Origin kind="simulated" />{pending.length > 0 && <Tag color="gold">待办 {pending.length}</Tag>}</Space>}>查看已加入的团队、成员与待处理邀请。</TeamsPageIntro>
    {pending.length > 0 && <section className="group-detail group-pending"><div className="group-toolbar"><h3>邀请与申请</h3><span className="ui-note">接受后加入成员列表</span></div><div className="group-members">{pending.map(member => <div key={member.id}><span><strong>{member.name}</strong><small>邀请加入「{team.name}」</small></span>{owner ? <Space wrap><Button type="primary" loading={busy} onClick={() => void update('member.approve', { id: member.id })}>模拟接受邀请</Button><Popconfirm title="撤回此演示邀请？" okText="撤回" cancelText="取消" onConfirm={() => update('member.remove', { id: member.id })}><Button disabled={busy}>撤回</Button></Popconfirm></Space> : <Tag color="gold">待接受</Tag>}</div>)}</div></section>}
    <div className="group-layout"><aside className="group-list" aria-label="我的团队"><h3>我的团队</h3><button className="group-item active" aria-current="true"><strong>{team.name}</strong><span>Owner 林悦 · {active.length} 人</span><span>我的身份：{owner ? 'Owner' : '成员'}</span></button></aside><section className="group-detail"><div className="group-heading"><div><h3>{team.name}</h3><p>共同维护项目资产与能力，围绕需求交付开展协作。</p></div>{owner && <Button onClick={() => { setTeamName(team.name); setRenaming(true); }}>编辑团队名称</Button>}</div><div className="group-facts"><span>成员 <strong>{active.length}</strong></span><span>我的身份 <strong>{owner ? 'Owner' : '成员'}</strong></span><span>关联项目 <strong>{state.workspace.project.name}</strong></span></div>
      <div className="group-toolbar group-members-bar"><h3>团队成员</h3>{owner && <Button aria-label="邀请成员" type="primary" icon={<UserAddOutlined />} onClick={() => { setName(''); setInviting(true); }}>邀请成员</Button>}</div>
      {!owner && <p className="ui-note">当前身份为成员，可查看团队与成员。</p>}
      <div className="group-members">{active.map(member => <div key={member.id}><span><strong>{member.name}</strong><small className={'group-role ' + (member.role === 'owner' ? 'group-role-owner' : '')}>{member.role === 'owner' ? 'Owner' : '成员'}</small>{member.id === (owner ? 'owner' : 'member') && <small>当前角色</small>}</span>{owner && (['owner','member'].includes(member.id) ? <small className="ui-note">固定演示身份</small> : <div className="group-member-actions"><Select aria-label={'调整' + member.name + '角色'} size="small" value={member.role} disabled={busy} options={[{ value: 'member', label: '成员' }, { value: 'owner', label: 'Owner' }]} onChange={value => void update('member.role', { id: member.id, role: value })} /><Popconfirm title={'从演示团队移除 ' + member.name + '？'} okText="移除" cancelText="取消" onConfirm={() => update('member.remove', { id: member.id })}><Button size="small" danger disabled={busy}>移除</Button></Popconfirm></div>)}</div>)}</div>
      <p className="ui-note group-note">邀请与角色修改保存到本地演示团队。林悦和陈晨用于固定交付流程。</p><div className="group-toolbar group-members-bar"><h3>关联项目</h3><Button onClick={() => navigate('projects?tab=content')}>进入项目</Button></div><p className="ui-note">{state.workspace.project.name} · {state.workspace.project.description}</p><Space wrap className="group-links"><Button onClick={() => navigate('resources')}>资源市场</Button>{owner && <Button onClick={() => navigate('connections')}>企业连接</Button>}</Space>
    </section></div>
    {!pending.length && <p className="ui-note">暂无待处理邀请与申请。</p>}
    <Modal title="邀请团队成员" open={inviting} onCancel={() => setInviting(false)} okText="创建演示邀请" cancelText="取消" confirmLoading={busy} okButtonProps={{ disabled: !name.trim() }} onOk={async () => { await update('member.invite', { name: name.trim() }); setInviting(false); }}><p>填写演示成员姓名，邀请接受后将出现在成员列表。</p><Input aria-label="邀请成员姓名" placeholder="例如：周宁" value={name} onChange={event => setName(event.target.value)} maxLength={40} /></Modal>
    <Modal title="编辑团队名称" open={renaming} onCancel={() => setRenaming(false)} okText="保存" cancelText="取消" confirmLoading={busy} okButtonProps={{ disabled: !teamName.trim() }} onOk={async () => { await update('team.update', { name: teamName.trim() }); setRenaming(false); }}><Input aria-label="团队名称" value={teamName} onChange={event => setTeamName(event.target.value)} maxLength={80} /></Modal>
  </div>;
}
