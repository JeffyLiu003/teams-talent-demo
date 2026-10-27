import { readFile } from 'node:fs/promises';
import { join, normalize, isAbsolute } from 'node:path';
import { atomicJson } from './store.js';
import { sharedDir, sharedSeedDir } from './config.js';
import { DomainError, type DemoState } from '../src/domain.js';
import type { Presentation } from '../src/api.js';
import type { SourcePluginCatalog } from '../src/source-plugins.js';
import { sharedPaths, type PublishedArtifact, type SharedProject, type SharedSession, type TalentsKnowledge, type TeamsSnapshot } from '../../shared/contracts.js';
import teamSessions from '../fixtures/team-sessions.json' with { type: 'json' };

/** Reads a shared file written by the other project, falling back to the committed seed copy. */
async function readShared(path: string): Promise<Buffer | null> {
  for (const dir of [sharedDir, sharedSeedDir]) {
    try { return await readFile(join(dir, path)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return null;
}

const repositoryPath = (path: string) => 'workspace/' + path;
function cardProject(state: DemoState, catalog: SourcePluginCatalog): SharedProject {
  const project = state.workspace.project;
  const documents = project.assets.filter(asset => asset.kind === 'document').map(asset => {
    const source = asset.sourceAssetId ? catalog.get(asset.sourceAssetId) : undefined;
    return { id: asset.sourceAssetId ?? asset.id, title: asset.title, path: source?.references[0]?.path ?? asset.location, summary: source?.summary ?? '' };
  });
  return { id: 'carddemo', name: project.name, description: project.description, readonly: false,
    repositories: [{ id: 'repository:carddemo:' + project.repository, name: project.repository, path: repositoryPath(project.repository), branch: 'main', description: 'Java 21 微服务：7 个服务和 Web UI' }],
    documents };
}
function sessions(state: DemoState): SharedSession[] {
  const members = new Map(state.workspace.team.members.map(member => [member.id, member.name]));
  const card = (value: Omit<SharedSession, 'projectId' | 'memberName' | 'cwd'>): SharedSession =>
    ({ ...value, projectId: 'carddemo', memberName: members.get(value.memberId) ?? value.memberId, cwd: repositoryPath(state.workspace.project.repository) });
  const shared = teamSessions.sessions.map(card);
  const delivery = teamSessions.delivery;
  if (state.workspace.sessionReported) shared.unshift(card({ ...delivery, updatedAt: (state.workspace.reportAt ?? new Date().toISOString()).slice(0, 16).replace('T', ' ') }));
  return shared;
}
export function teamsSnapshot(state: DemoState, fixtures: Presentation, catalog: SourcePluginCatalog): TeamsSnapshot {
  const imported = fixtures.teamsProject.project;
  return {
    schemaVersion: 1, exportedAt: new Date().toISOString(),
    team: { name: state.workspace.team.name, members: state.workspace.team.members },
    projects: [
      cardProject(state, catalog),
      { id: 'teams', name: imported.name, description: imported.description, readonly: true,
        repositories: imported.repos.map(repo => ({ id: 'repository:teams:' + repo.name, name: repo.name, remote: repo.name, branch: repo.branch, description: repo.note })),
        documents: imported.docs.map(doc => ({ id: 'design-library:teams:' + doc.path, title: doc.name, path: doc.path, summary: doc.description })) },
      ...(state.workspace.projects ?? []).map(project => ({ id: project.id, name: project.name, description: project.description, readonly: false,
        repositories: [{ id: 'repository:' + project.id, name: project.repositoryIdentity, remote: project.remoteUrl }], documents: [] })),
    ],
    sessions: sessions(state),
  };
}
export async function exportTeamsSnapshot(state: DemoState, fixtures: Presentation, catalog: SourcePluginCatalog) {
  await atomicJson(join(sharedDir, sharedPaths.teamsSnapshot), teamsSnapshot(state, fixtures, catalog));
}

export async function readTalentsKnowledge(): Promise<TalentsKnowledge> {
  const content = await readShared(sharedPaths.talentsKnowledge);
  if (!content) return { schemaVersion: 1, exportedAt: '', artifacts: [] };
  const value = JSON.parse(content.toString('utf8')) as TalentsKnowledge;
  if (value.schemaVersion !== 1 || !Array.isArray(value.artifacts)) throw new DomainError('Talents 知识数据格式无效', 502);
  return value;
}
export async function projectKnowledge(projectId: string): Promise<PublishedArtifact[]> {
  return (await readTalentsKnowledge()).artifacts.filter(artifact => artifact.projectId === projectId);
}
/** The version Teams records as "project knowledge built": the business knowledge if published, else any artifact. */
export function knowledgeVersion(artifacts: PublishedArtifact[]) {
  const main = artifacts.find(artifact => artifact.capability === 'doc-extract') ?? artifacts[0];
  return main ? `${main.name} v${main.version}` : undefined;
}
export async function readTalentsFile(artifactId: string, version: number, path: string) {
  const artifact = (await readTalentsKnowledge()).artifacts.find(item => item.id === artifactId && item.version === version);
  const file = artifact?.files.find(item => item.path === path);
  if (!artifact || !file || isAbsolute(path) || normalize(path).startsWith('..')) throw new DomainError('Talents 产物文件不存在', 404);
  const content = await readShared(sharedPaths.talentsFile(artifactId, version, path));
  if (!content) throw new DomainError('Talents 产物文件尚未同步', 404);
  return { ...file, content: content.toString('utf8') };
}
