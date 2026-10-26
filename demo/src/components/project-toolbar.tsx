import type { ReactNode } from 'react';
import { Tabs } from 'antd';
import '../project.css';

export const projectPages = [
  { key: 'content', label: '项目内容' },
  { key: 'management', label: '任务管理' },
  { key: 'delivery', label: '任务交付' },
  { key: 'release', label: '发布跟踪' },
];

export function ProjectToolbar({ activeKey, onChange, actions }: { activeKey: string; onChange(value: string): void; actions: ReactNode }) {
  return <div className="project-toolbar" role="region" aria-label="项目工具栏">
    <Tabs aria-label="项目阶段" activeKey={activeKey} onChange={onChange} items={projectPages} />
    <div className="project-toolbar-actions">{actions}</div>
  </div>;
}
