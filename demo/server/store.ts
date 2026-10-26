import { mkdir, open, readFile, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { shareableResourceIds } from '../src/resource-sharing.js';
import { initialState, transition, DomainError, type DemoState, type Role, type Action } from '../src/domain.js';
import { runtimeDir } from './config.js';
import { initialWorkspace, updateWorkspace, type WorkspaceAction } from '../src/workspace.js';
import type { SourcePluginAsset } from '../src/source-plugins.js';
import { validateCreatedProjects } from '../src/created-projects.js';
import { validateCollaborationState } from '../src/collaboration.js';
export async function atomicText(path: string, value: string) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = path + '.' + randomUUID() + '.tmp';
  const file = await open(tmp, 'wx', 0o600);
  try { await file.writeFile(value); await file.sync(); } finally { await file.close(); }
  await rename(tmp, path);
}
export async function atomicJson(path: string, value: unknown) { await atomicText(path, JSON.stringify(value, null, 2) + '\n'); }
export class Store {
  state!: DemoState;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private path = join(runtimeDir, 'state.json')) {}
  async init() {
    try { this.state = JSON.parse(await readFile(this.path, 'utf8')); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; this.state = initialState(); await atomicJson(this.path, this.state); }
    if (!Number.isInteger(this.state.revision) || !Array.isArray(this.state.audit) || this.state.security !== 'unverified') throw new Error('演示状态文件损坏；请保留文件后显式重置');
    // Explicit one-time v1 -> v2 migration, preserving the original demo state.
    if (!Object.hasOwn(this.state,'schemaVersion') && !Object.hasOwn(this.state,'workspace')) {
      await atomicJson(this.path+'.pre-v2.json',this.state);
      this.state.workspace=initialWorkspace();this.state.schemaVersion=2;
      if(this.state.context){this.state.context.selectedSkills=[...this.state.workspace.selectedSkills];this.state.context.materials=[];this.state.context.assets=structuredClone(this.state.workspace.project.assets);}
      await atomicJson(this.path,this.state);
    }
    if(this.state.schemaVersion!==2 || !this.state.workspace || !Array.isArray(this.state.workspace.project?.assets) || !Array.isArray(this.state.workspace.selectedSkills) || !Array.isArray(this.state.workspace.acquiredResources) || !Array.isArray(this.state.workspace.materials) || !Array.isArray(this.state.workspace.team?.members) || !Array.isArray(this.state.workspace.connections) || !Array.isArray(this.state.workspace.progress) || !this.state.workspace.foundation || !['idle','analyzed'].includes(this.state.workspace.analysis?.status)) throw new Error('演示工作区状态无效；未自动覆盖');
    if (Object.hasOwn(this.state.workspace, 'projects')) validateCreatedProjects(this.state.workspace.projects);
    if (Object.hasOwn(this.state.workspace, 'collaboration')) validateCollaborationState(this.state.workspace.collaboration);
    const publications=this.state.workspace.resourcePublications;
    if(Object.hasOwn(this.state.workspace,'resourcePublications') && (!Array.isArray(publications) || publications.some(item=>!item || !shareableResourceIds.includes(item.id) || typeof item.version!=='string' || !item.version || item.scope!=='team' || item.publisher!=='owner' || typeof item.publishedAt!=='string') || new Set(publications.map(item=>item.id)).size!==publications.length)) throw new Error('资源发布记录无效；未自动覆盖');
  }
  mutate(revision: number, operation: (state: DemoState) => DemoState) {
    const next = this.queue.then(async () => {
      if (revision !== this.state.revision) throw new DomainError('另一页面已更新数据，请刷新后重试');
      const state = operation(this.state);
      await atomicJson(this.path, state); this.state = state; return state;
    });
    this.queue = next.catch(() => undefined); return next;
  }
  apply(revision: number, action: Action, role: Role, payload: { reason?: string }) { return this.mutate(revision, state => transition(state, action, role, payload)); }
  update(revision:number,kind:WorkspaceAction,role:Role,payload:Record<string,unknown>,sourceAssets:readonly SourcePluginAsset[]=[]){return this.mutate(revision,state=>updateWorkspace(state,kind,role,payload,sourceAssets));}
  reset(revision: number) { return this.mutate(revision, () => ({ ...initialState(), revision: revision + 1, talentGeneration: randomUUID() })); }
  /** Runs idempotency and revision checks together under the same persistence queue. */
  transact(operation: (state: DemoState) => DemoState) {
    const next = this.queue.then(async () => {
      const state = operation(this.state);
      if (state !== this.state) { await atomicJson(this.path, state); this.state = state; }
      return state;
    });
    this.queue = next.catch(() => undefined); return next;
  }
}
