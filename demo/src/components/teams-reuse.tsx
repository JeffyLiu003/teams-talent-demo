import type { ReactNode } from 'react';
import { Tag, Tooltip } from 'antd';
import { AppstoreOutlined, CodeOutlined } from '@ant-design/icons';
/** FrameworkPreview WorkRow and quick-entry-grid presentation, adapted only
 * to demo rows. Source: framework/client/ui/src/views/framework-preview.tsx. */
export function TeamsWorkRow({ title, note, status, href, compact = false }: { title: string; note: string; status: string; href: string; compact?: boolean }) {
  return <a className={compact ? 'work-row compact-work-row' : 'work-row'} href={href}><span className="resource-icon"><CodeOutlined /></span><div><strong>{title}</strong><p>{note}</p></div><Tag color={status.includes('待') ? 'gold' : 'purple'}>{status}</Tag><span className="ui-note">查看 →</span></a>;
}
export function TeamsQuickEntries({ entries }: { entries: { title: string; note: string; href: string }[] }) {
  return <div className="quick-entry-grid">{entries.map(entry => <a key={entry.href} href={entry.href}><span className="resource-icon"><AppstoreOutlined /></span><div><strong>{entry.title}</strong><p>{entry.note}</p></div></a>)}</div>;
}
export function TeamsPageIntro({ children, extension, actions }: { children: ReactNode; extension?: string; actions?: ReactNode }) {
  return <div className="teams-page-intro"><span>{children}</span><div>{extension && <Tooltip title={extension}><Tag className="teams-extension-tag">演示扩展 · 待对齐</Tag></Tooltip>}{actions}</div></div>;
}
