import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialState, type DemoState } from '../src/domain.js';
import { updateWorkspace } from '../src/workspace.js';
import { createSourcePluginCatalog } from '../src/source-plugins.js';
import { filterIssues, filterRequirements, projectOverview } from '../src/project-overview.js';
import type { CollaborationEvent } from '../src/collaboration.js';
const data = { ...JSON.parse(await readFile('fixtures/presentation.json', 'utf8')), teamsProject: JSON.parse(await readFile('fixtures/teams-project.json', 'utf8')) };
const catalog = createSourcePluginCatalog(data);
const overview = (state: DemoState, project = 'carddemo') => projectOverview(state, data, project, '2026-10-26');

test('CardDemo has one canonical requirement throughout delivery; quality and blockers remain independent', () => {
  const state = initialState();
  for (const [stage, checks, phase, open, blocked] of [['draft', 'none', '待开展', 0, 0], ['developing', 'none', '开发', 0, 0], ['failed', 'failed', '验证', 1, 1], ['fixed', 'passed', '验证', 0, 0], ['returned', 'passed', '开发', 0, 0], ['submitted', 'passed', '待验收', 0, 0], ['accepted', 'passed', '已交付', 0, 0]] as const) {
    const result = overview({ ...state, stage, checks, assigned: stage !== 'draft' });
    assert.equal(result.requirements.length, 1); assert.equal(result.requirements[0].taskId, 'DEMO-MKT-001'); assert.equal(result.requirements[0].phase, phase);
    assert.equal(result.counts.open, open); assert.equal(result.counts.blocking, blocked); assert.equal(result.issues.length, 2);
    assert.equal(result.requirements[0].quality.find(item => item.label === '安全')?.passed, false);
    assert.equal(result.requirements[0].quality.find(item => item.label === 'Review')?.passed, false);
    assert.equal(result.requirements[0].quality.find(item => item.label === '功能')?.passed, stage === 'accepted');
    if (stage === 'returned') { assert.equal(result.requirements[0].quality.find(item => item.label === '测试')?.passed, false); assert.match(result.requirements[0].quality.find(item => item.label === '测试')!.result, /待复验/); }
  }
});
test('Teams task projections count once; research, problem input and unknown close state have explicit scope', () => {
  const result = overview(initialState(), 'teams');
  assert.deepEqual(result.requirements.map(item => item.taskId), ['T104', 'T105', 'T106', 'T107']); assert.equal(result.research[0].taskId, 'T108');
  assert.equal(result.research[0].quality.find(item => item.label === '测试')?.result, '不适用（调研）');
  assert.deepEqual(result.counts, { all: 4, active: 1, acceptance: 1, delivered: 2, open: 0, blocking: 0 });
  assert.equal(result.requirements[0].phase, '准备'); assert.ok(result.requirements[0].route?.includes('node=review'));
  assert.ok(result.requirements.find(item => item.taskId === 'T106')?.route?.includes('node=accept'));
  assert.equal(result.issues.length, 1); assert.equal(result.issues[0].closed, null); assert.equal(result.issues[0].blocksDelivery, false);
  assert.equal(result.requirements.filter(item => item.overdue).length, 2); assert.ok(result.requirements.every(item => !item.quality.find(q => q.label === '安全')?.passed));
});
test('empty and cross-project source associations do not inherit original delivery or duplicate totals', () => {
  const id = 'a6a6e619-033b-4bd8-b3cc-b9f42fce6863';
  let state = updateWorkspace(initialState(), 'project.create', 'owner', { id, name: '隔离概览', description: '', remoteUrl: 'mock://overview', repositoryIdentity: 'overview' });
  assert.deepEqual(overview(state, id).counts, { all: 0, active: 0, acceptance: 0, delivered: 0, open: 0, blocking: 0 });
  state = updateWorkspace(state, 'asset.link', 'owner', { projectId: id, sourceAssetId: 'requirements:teams:REQ-T105' }, catalog.list());
  const result = overview(state, id); assert.equal(result.counts.all, 1); assert.equal(result.counts.delivered, 0); assert.equal(result.requirements[0].phase, '待开展'); assert.equal(result.requirements[0].route, undefined); assert.equal(result.requirements[0].owner, '未分配'); assert.equal(result.requirements[0].due, undefined);
  const duplicate = structuredClone(state); duplicate.workspace.projects![0].assets!.push({ ...duplicate.workspace.projects![0].assets![0], id: 'another-local-reference' });
  assert.equal(overview(duplicate, id).counts.all, 1); assert.equal(overview(state).counts.all, 1); assert.equal(overview(state, 'teams').counts.all, 4);
});
test('every metric uses the same exact requirement or issue set as its drill-down filter', () => {
  for (const result of [overview(initialState()), overview({ ...initialState(), stage: 'failed', checks: 'failed' }), overview(initialState(), 'teams')]) {
    for (const filter of ['all', 'active', 'acceptance', 'delivered'] as const) assert.equal(result.counts[filter], filterRequirements(result, filter).length);
    for (const filter of ['open', 'blocking'] as const) assert.equal(result.counts[filter], filterIssues(result, filter).length);
    assert.equal(new Set(result.requirements.map(item => item.id)).size, result.requirements.length);
  }
});

test('task reports use exact project/task scope and never turn a developer result into accepted delivery', () => {
  const state = initialState();
  const report = (revision: number, phase: CollaborationEvent['phase'], projectId = 'carddemo', taskId: string | undefined = 'DEMO-MKT-001'): CollaborationEvent => ({ id: 'event-' + revision, operationId: 'op-' + revision, projectId, taskId, nodeId: 'develop', role: 'member', runId: 'run-a', sessionId: null, adoptionId: 'adopt-a', phase, summary: '真实回传记录', blocker: phase === 'blocked' ? '等待接口约定' : null, evidence: [], at: '2026-10-26T00:00:00Z', revision });
  state.workspace.collaboration = { adoptions: [], operations: [], events: [report(1, 'blocked'), report(2, 'result', 'teams'), report(3, 'result', 'carddemo', 'another-task')] };
  assert.equal(overview(state).requirements[0].activity?.phase, 'blocked');
  assert.equal(overview(state).counts.blocking, 0, 'a work report is not a second defect source');
  state.workspace.collaboration.events.push(report(4, 'progress'));
  assert.equal(overview(state).requirements[0].activity?.phase, 'progress');
  state.workspace.collaboration.events.push(report(5, 'result'));
  assert.equal(overview(state).requirements[0].activity?.phase, 'result');
  assert.equal(overview(state).requirements[0].phase, '待开展'); assert.equal(overview(state).counts.delivered, 0);
});
