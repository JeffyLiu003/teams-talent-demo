// 开发者端 · 本地索引：为本机的代码仓和文档建立索引，供本机 iCode 查询。
import { useState } from 'react';
import { Button, Form, Input, Modal, Progress, Select, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { PageHeader } from '../vendor/teams/components/page-layout.tsx';
import { useTalents } from '../store.tsx';
import type { LocalDir } from '../types.ts';
import { now, uid, when } from '../demo/format.ts';
import { CardGrid, Fields, ItemCard, SourceIcon } from '../components/ui.tsx';

/** Index builds in progress, by local directory id; they survive leaving the page. */
const building: Record<string, number> = {};

export function DevLocal() {
  const { state: st, update, toast } = useTalents();
  const [, redraw] = useState(0), [adding, setAdding] = useState(false);
  const build = (l: LocalDir) => {
    building[l.id] = 5; redraw(n => n + 1);
    const timer = setInterval(() => {
      building[l.id] = Math.min(100, building[l.id] + 18); redraw(n => n + 1);
      if (building[l.id] < 100) return;
      clearInterval(timer); delete building[l.id];
      update(d => { d.dev.local.find(x => x.id === l.id)!.index = { at: now(), files: '1,302' }; });
      toast('索引已建立：' + l.name);
    }, 500);
  };
  const apply = (l: LocalDir) => { update(d => { d.dev.local.find(x => x.id === l.id)!.applied = true; }); toast('Code Agent 现在可以查询「' + l.name + '」'); };
  return <div className="page-stack">
    <PageHeader title="本地索引" description="为本机的代码仓和文档建立索引，iCode 可以查询到还没提交的最新代码。" actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => setAdding(true)}>添加目录</Button>} />
    <CardGrid>{st.dev.local.map(l => {
      const pct = building[l.id];
      return <ItemCard key={l.id} icon={<SourceIcon type={l.type} />} title={l.name} subtitle={<span className="path">{l.path}</span>} extra={<Tag>{l.type === 'repo' ? '代码仓' : '文档目录'}</Tag>}
        caption={l.type === 'repo' ? 'CodeGraph' : '文档 RAG 检索'}
        actions={pct == null && (l.index
          ? <>{<Button size="small" onClick={() => build(l)}>更新索引</Button>}{!l.applied && <Button size="small" type="primary" onClick={() => apply(l)}>应用到 iCode</Button>}</>
          : <Button size="small" type="primary" onClick={() => build(l)}>建立索引</Button>)}>
        {pct != null ? <><Progress percent={pct} showInfo={false} size="small" /><p className="caption">正在建立索引…</p></>
          : <Fields rows={l.index ? [['索引', '已建立，更新于 ' + when(l.index.at)], l.applied && ['使用', 'Code Agent 可以查询']] : [['索引', '尚未建立']]} />}
      </ItemCard>;
    })}</CardGrid>
    {adding && <AddDir onClose={() => setAdding(false)} />}
  </div>;
}

function AddDir({ onClose }: { onClose(): void }) {
  const { update, toast } = useTalents();
  const [form] = Form.useForm<{ type: 'repo' | 'docs'; path: string; name: string }>();
  const submit = (v: { type: 'repo' | 'docs'; path: string; name: string }) => {
    const path = v.path.trim(), name = v.name.trim() || path.split('/').pop()!;
    update(d => {
      const repo = d.sources.find(s => s.type === 'repo' && s.name === name);
      d.dev.local.push({ id: uid('l'), type: v.type, name, path, repo: repo ? repo.id : null, index: null, applied: false });
    });
    onClose(); toast('已添加「' + name + '」');
  };
  return <Modal open title="添加目录" okText="添加" cancelText="取消" onOk={() => form.submit()} onCancel={onClose}>
    <Form form={form} layout="vertical" onFinish={submit} initialValues={{ type: 'repo', path: '~/code/carddemo-web', name: 'carddemo-web' }}
      onValuesChange={changed => { if ('path' in changed) form.setFieldValue('name', String(changed.path).split('/').pop()); }}>
      <Form.Item name="type" label="类型"><Select options={[{ value: 'repo', label: '代码仓' }, { value: 'docs', label: '文档目录' }]} /></Form.Item>
      <Form.Item name="path" label="目录" rules={[{ required: true, whitespace: true, message: '请填写目录' }]}><Input /></Form.Item>
      <Form.Item name="name" label="名称"><Input /></Form.Item>
    </Form>
  </Modal>;
}
