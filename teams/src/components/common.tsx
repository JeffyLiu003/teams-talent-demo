import { currentMemberOwnsTask } from '../task-assignment.js';
import { Button, Tag, Space, Tooltip } from 'antd';
import { ArrowRightOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import { useDemo } from '../context.js';
import { actionLabels, type Action, type Role } from '../domain.js';
export function Origin({ kind }: { kind: 'historical' | 'simulated' | 'static' | 'native' }) {
  if (kind === 'simulated') return null;
  return <Tag className="origin-tag" color={{ historical: 'blue', simulated: 'default', static: 'purple', native: 'green' }[kind]}>{{ historical: '历史证据', static: '源码分析', native: '本机实接' }[kind]}</Tag>;
}
export function ActionButton({ action, children, disabled, role: required, primary = true }: { action: Action; children?: ReactNode; disabled?: boolean; role?: Role; primary?: boolean }) {
  const { perform, role, busy, state } = useDemo();
  const wrongRole = required && required !== role;
  return <Tooltip title={wrongRole ? '请切换为项目' + (required === 'owner' ? ' Owner' : '成员') : undefined}><Button data-action={action} aria-label={typeof children === 'string' ? children : actionLabels[action]} type={primary ? 'primary' : 'default'} disabled={disabled || !!wrongRole || required === 'member' && !currentMemberOwnsTask(state) || busy} loading={busy} onClick={() => void perform(action)}>{children ?? actionLabels[action]}</Button></Tooltip>;
}
export function LinkButton({ href, children, external = false }: { href: string; children: ReactNode; external?: boolean }) { return <Button href={href} target={external ? '_blank' : undefined} icon={<ArrowRightOutlined />} iconPlacement="end">{children}</Button>; }
export function Heading({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <div className="object-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <Space wrap>{actions}</Space>}</div>;
}
export function StatusLine({ complete, children }: { complete: boolean; children: ReactNode }) { return <div className={'status-line ' + (complete ? 'complete' : '')}>{complete ? <CheckCircleOutlined /> : <ClockCircleOutlined />}<span>{children}</span></div>; }
export function MiniStat({ label, value, note }: { label: string; value: ReactNode; note?: string }) { return <div className="mini-stat"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>; }
export function Mono({ children }: { children: ReactNode }) { return <code className="mono-inline">{children}</code>; }
export { talentLink, teamsLink } from '../system-links.js';
