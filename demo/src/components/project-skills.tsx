import { useState, type ReactNode } from 'react';
import { Button, Empty, Pagination, Tabs, Tag } from 'antd';
import { useDemo } from '../context.js';
import { userSkillExamples } from '../project-skill-examples.js';
import { FrameworkCard } from '../vendor/teams/components/page-layout.js';

export interface ProjectSkillEntry {
  name: string;
  description: string;
  version: string;
  source: string;
  path: string;
  displayPath?: string;
  content?: string;
}

/** Reuses the Teams project-content name/description/path rows and its user/project scope vocabulary. */
export function ProjectSkills({ projectName, skills, projectFooter }: { projectName: string; skills: ProjectSkillEntry[]; projectFooter?: ReactNode }) {
  const { role, showText, data } = useDemo();
  const [scope, setScope] = useState('project'), [page, setPage] = useState(1);
  const userName = role === 'owner' ? '林悦' : '陈晨';
  const userSkills: ProjectSkillEntry[] = userSkillExamples.map(skill => ({ ...skill, version: skill.id === 'teams-collaboration' ? 'demo-cli-v1' : '示例定义 v1', source: skill.id === 'teams-collaboration' ? '演示接入可用 · 本地 Skill 与 CLI' : '预置用户 Skill 示例', path: skill.id === 'teams-collaboration' ? data.localPaths.collaborationSkill : '', content: skill.id === 'teams-collaboration' ? skill.content.replace('demo/skills/teams-demo-collaboration/SKILL.md', data.localPaths.collaborationSkill).replace('demo/scripts/teams-demo.mjs', data.localPaths.cli) : skill.content }));
  const entries = scope === 'project' ? skills : userSkills;
  const range = scope === 'project' ? `项目级 · 仅 ${projectName}` : `用户级 · 当前用户 ${userName}，跨项目可用`;
  const open = (skill: ProjectSkillEntry) => showText(skill.name + ' · Skill 说明', [
    `名称：${skill.name}`, `用途：${skill.description}`, `版本：${skill.version}`, `来源：${skill.source}`, `作用范围：${range}`,
    ...(skill.path ? [`资料路径：${skill.path}`] : []),
    '', scope === 'user' ? skill.source.startsWith('演示接入可用') ? '本地 Skill 和 CLI 已提供；iCode 启动材料明确引用文件和读取命令，当前会话实际加载需会话确认。' : '本条为用户级 Skill 演示示例，未读取用户本机技能目录；安装、工具发现和实际加载均未核验。' : '内容来自已导入资料；当前工具的发现与会话加载状态未核验。',
    '', skill.content ?? '当前导入清单未附带 Skill 正文。',
  ].join('\n'));
  return <div className="project-skills" role="region" aria-label="项目可用 Skill">
    <FrameworkCard title="项目可用 Skill">
      <Tabs size="small" activeKey={scope} onChange={value => { setScope(value); setPage(1); }} items={[{ key: 'project', label: `项目 Skill · ${skills.length}` }, { key: 'user', label: `用户 Skill · ${userSkills.length}` }]} />
      <div className="project-skill-scope"><span>{range}</span>{scope === 'user' && <Tag>演示接入 / 使用示例</Tag>}</div>
      <div className="project-skill-list">{entries.slice((page - 1) * 5, page * 5).map(skill => <div className="project-skill-row" key={skill.name}>
        <div><strong>{skill.name}</strong><p>{skill.description}</p><div className="project-skill-meta"><span>{skill.version} · {skill.source}</span>{skill.path && <code title={skill.path}>{skill.displayPath ?? skill.path}</code>}</div></div>
        <Button size="small" aria-label={'查看 Skill：' + skill.name} onClick={() => open(skill)}>查看说明</Button>
      </div>)}</div>
      {!entries.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未关联项目 Skill" />}
      <Pagination size="small" responsive hideOnSinglePage current={page} pageSize={5} total={entries.length} showSizeChanger={false} onChange={setPage} />
      {scope === 'project' && projectFooter}
      <p className="muted project-skill-note">此处展示可用范围；本次采用以需求准备中的选择与冻结记录为准，实际加载由工具会话确认。</p>
    </FrameworkCard>
  </div>;
}
