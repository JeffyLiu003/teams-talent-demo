import type { DemoState } from './domain.js';
import type { SourcePluginAsset } from './source-plugins.js';
import type { Asset } from './workspace.js';

export interface TalentProjectContext { id: string; name: string; assets: Asset[]; requirementId?: string; generation: string }
export interface TalentProjectState {
  id: string;
  name: string;
  generation: string;
  knowledge: { status: 'not-built' | 'ready'; version?: string; builtAt?: string; inputAssetIds: string[]; assets: SourcePluginAsset[]; graphInput: 'existing-local-excerpts' | 'not-provided' };
  analysis: { status: 'idle' | 'analyzed'; scope: 'single' | 'project'; findings: string[]; at?: string };
  evolution: { status: 'none' | 'candidate' | 'evaluated' | 'published'; candidates: Array<{ kind: 'skill' | 'agent'; version: string; definition: string }>; evaluations: Array<{ kind: 'skill' | 'agent'; result: string }>; publishedAt?: string };
  projection: { status: 'not-required' | 'pending' | 'confirmed'; action?: string; error?: string };
}
export interface TalentSnapshot { revision: number; project: TalentProjectState; context: TalentProjectContext }
export interface TalentIntegrationContext { token: string; state: DemoState; project: TalentProjectContext; projects: TalentProjectContext[] }
export interface BusinessKnowledgeResponse { assets: readonly SourcePluginAsset[]; projects: Array<{ id: string; name: string; status: 'not-built' | 'ready' }>; origin: string }
