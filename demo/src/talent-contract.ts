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

export interface TalentTaskInputs {
  projectId: string; taskId: string; generation: string; origin: string;
  requirement: { id: string; title: string; description: string };
  knowledge: { status: 'ready' | 'not-built'; version?: string; assets: SourcePluginAsset[]; taskRegistration?: Omit<TalentTaskInputRegistration, 'asset'> };
  skills: Array<{ id: string; name: string; version: string; sha256: string; contentSha256: string; content: string; source: 'teams-registered-package' }>;
}
export interface TalentTaskSession {
  tool: 'icode' | 'opencode'; sessionId: string; nodeIds: string[]; runIds: string[]; sources: string[]; firstAt: string; lastAt: string;
}
export interface TalentTaskSessionPayload {
  projectId: string; taskId: string; deliveryId: string; idempotencyKey: string;
  acceptedAt: string; inputDigest: string; sessions: TalentTaskSession[];
  sessionDocuments?: Array<{ sessionId: string; sha256: string; content: string }>;
}
export interface TalentTaskSessionReceipt { id: string; receivedAt: string; projectId: string; taskId: string; sessionIds: string[]; payloadSha256: string; documentHashes?: Array<{ sessionId: string; sha256: string }> }
export interface TalentTaskIntake { generation: string; payload: TalentTaskSessionPayload; receipt: TalentTaskSessionReceipt }

export interface TalentTaskInputRegistration {
  projectId: string; taskId: string; generation: string; version: string; registeredAt: string; sourceDigest: string;
  source: { kind: 'teams-requirement'; projectId: string; taskId: string; title: string; createdAt: string; descriptionSha256: string; skillIds: string[] };
  asset: SourcePluginAsset;
}
