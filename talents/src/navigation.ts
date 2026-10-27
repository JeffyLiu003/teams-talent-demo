// Pages of the two entries. 管理员端 is the Teams owner (mines and publishes knowledge); 开发者端 is a Teams
// member (applies it). The sidebar shows the current entry's pages, and opening a page switches to its entry.
import type { PageDefinition } from './vendor/teams/page-registry.ts';
import type { Role } from './types.ts';

export interface TalentsPage extends PageDefinition { role: Role }
export const pages: TalentsPage[] = [
  { id: 'sources', route: 'sources', title: '来源管理', role: 'admin', groupId: 'team', icon: 'projects' },
  { id: 'capabilities', route: 'capabilities', title: '知识能力', role: 'admin', groupId: 'team', icon: 'appstore' },
  { id: 'tasks', route: 'tasks', title: '知识任务', role: 'admin', groupId: 'team', icon: 'work' },
  { id: 'review', route: 'review', title: '产物审阅', role: 'admin', groupId: 'team', icon: 'publications' },
  { id: 'knowledge', route: 'knowledge', title: '项目知识', role: 'dev', groupId: 'personal', icon: 'subscriptions' },
  { id: 'local', route: 'local', title: '本地索引', role: 'dev', groupId: 'personal', icon: 'insights' },
];
export const home: Record<Role, string> = { admin: 'sources', dev: 'knowledge' };
export const roleLabel: Record<Role, string> = { admin: '管理员端', dev: '开发者端' };
/** Teams links to #/dev-knowledge for the developer's project knowledge. */
const aliases: Record<string, string> = { 'dev-knowledge': 'knowledge' };

export interface Route { page: TalentsPage; params: Record<string, string> }
/** #/<page>?<params>; an unknown page is null and the caller falls back to the entry's home. */
export function parseHash(hash: string): { page: TalentsPage | null; params: Record<string, string> } {
  const [name, query] = hash.replace(/^#\/?/, '').split('?');
  const id = aliases[name] ?? name;
  return { page: pages.find(p => p.id === id) ?? null, params: Object.fromEntries(new URLSearchParams(query)) };
}
