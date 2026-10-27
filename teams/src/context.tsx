import { createContext, useContext } from 'react';
import type { Action, DemoState, Role } from './domain.js';
import type { Presentation } from './api.js';
import type { WorkspaceAction } from './workspace.js';
export interface DemoContext {
  state: DemoState; data: Presentation; role: Role; busy: boolean;
  perform(action: Action, reason?: string, assigneeId?: string): Promise<boolean>;
  update(kind: WorkspaceAction, payload: Record<string, unknown>): Promise<DemoState | undefined>;
  run<T>(work: () => Promise<T>, success?: string): Promise<T | undefined>;
  showEvidence(id: string): void; showText(title: string, content: string): void;
  navigate(route: string): void;
  receiveState(state: DemoState): void;
}
export const Context = createContext<DemoContext | null>(null);
export function useDemo() { const value = useContext(Context); if (!value) throw new Error('Workspace context missing'); return value; }
