import { validateTaskInputRegistrations, validateTaskIntakes } from './talent-intake.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicJson } from './store.js';
import { talentRuntimeDir } from './config.js';
import type { TalentProjectContext, TalentProjectState, TalentTaskInputRegistration, TalentTaskIntake } from '../src/talent-contract.js';

export function emptyTalentProject(context: TalentProjectContext): TalentProjectState {
  return { id: context.id, name: context.name, generation: context.generation,
    knowledge: { status: 'not-built', inputAssetIds: [], assets: [], graphInput: 'not-provided' },
    analysis: { status: 'idle', scope: 'single', findings: [] },
    evolution: { status: 'none', candidates: [], evaluations: [] }, projection: { status: 'not-required' } };
}

/** Talent owns this file. Teams is accessed only through the integration HTTP API. */
export class TalentStore {
  state: { schemaVersion: 1; revision: number; projects: Record<string, TalentProjectState>; taskIntakes?: TalentTaskIntake[]; taskInputRegistrations?: TalentTaskInputRegistration[] } = { schemaVersion: 1, revision: 0, projects: {} };
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private path = join(talentRuntimeDir, 'talent-state.json')) {}
  async init() {
    try { this.state = JSON.parse(await readFile(this.path, 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; await atomicJson(this.path, this.state); }
    if (this.state.schemaVersion !== 1 || !Number.isSafeInteger(this.state.revision) || !this.state.projects || typeof this.state.projects !== 'object' || Array.isArray(this.state.projects)) throw new Error('Talent 状态文件损坏；未自动覆盖');
    if (Object.hasOwn(this.state, 'taskInputRegistrations')) validateTaskInputRegistrations(this.state.taskInputRegistrations);
    if (Object.hasOwn(this.state, 'taskIntakes')) validateTaskIntakes(this.state.taskIntakes);
    for (const [id, p] of Object.entries(this.state.projects)) {
      if (p.id !== id || typeof p.generation !== 'string' || !['ready', 'not-built'].includes(p.knowledge?.status) || !Array.isArray(p.knowledge.assets) || p.knowledge.assets.some(asset => asset.pluginId !== 'business-knowledge' || asset.sourceProjectId !== id) || !['idle', 'analyzed'].includes(p.analysis?.status) || !['none', 'candidate', 'evaluated', 'published'].includes(p.evolution?.status) || !Array.isArray(p.evolution.candidates) || !Array.isArray(p.evolution.evaluations) || !['not-required', 'pending', 'confirmed'].includes(p.projection?.status)) throw new Error('Talent 项目记录损坏；未自动覆盖');
    }
  }
  project(context: TalentProjectContext) {
    const project = this.state.projects[context.id];
    return structuredClone(project?.generation === context.generation ? { ...project, name: context.name } : emptyTalentProject(context));
  }
  async save(project: TalentProjectState) {
    const next = { ...this.state, revision: this.state.revision + 1, projects: { ...this.state.projects, [project.id]: structuredClone(project) } };
    await atomicJson(this.path, next); this.state = next;
  }
  async saveInputRegistration(record: TalentTaskInputRegistration) {
    const taskInputRegistrations = [...(this.state.taskInputRegistrations ?? []), structuredClone(record)]; validateTaskInputRegistrations(taskInputRegistrations);
    const next = { ...this.state, revision: this.state.revision + 1, taskInputRegistrations };
    await atomicJson(this.path, next); this.state = next;
  }
  async saveIntake(record: TalentTaskIntake) {
    const taskIntakes = [...(this.state.taskIntakes ?? []), structuredClone(record)]; validateTaskIntakes(taskIntakes);
    const next = { ...this.state, revision: this.state.revision + 1, taskIntakes };
    await atomicJson(this.path, next); this.state = next;
  }
  exclusive<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work); this.queue = next.catch(() => undefined); return next;
  }
}
