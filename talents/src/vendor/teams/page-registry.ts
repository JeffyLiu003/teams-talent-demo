// Demo routing contract. Presentation components and navigation vocabulary are copied unchanged.
import type { NavigationGroupId } from './contracts/navigation.js';
export type PageGroup = NavigationGroupId | 'settings';
export interface ClientContext { teamId?: string; projectId?: string; objectId?: string }
export interface PageDefinition { id: string; title: string; groupId?: PageGroup; route: string; icon?: string; contribution?: { slot: string } }
export function pageRouteHash(page: PageDefinition, _context: ClientContext) { return '#/' + page.route; }
