import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Render the real React + antd components, with CSS ignored only by the Node bundler.
test('Talent renders missing graph selection, empty graph, and product-facing summaries', async () => {
  const directory = await mkdtemp(resolve('.talent-render-'));
  try {
    const outfile = join(directory, 'render.mjs');
    await build({ stdin: { contents: `export { Knowledge, KnowledgeGraph, TalentSessions, Evolution, knowledgeRules, openKnowledgeRule } from './src/pages/talent'; export { Context } from './src/context'; export { initialState } from './src/domain';`, resolveDir: process.cwd(), loader: 'tsx' }, outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', loader: { '.css': 'empty' }, jsx: 'automatic', logLevel: 'silent' });
    const { Knowledge, KnowledgeGraph, TalentSessions, Evolution, knowledgeRules, openKnowledgeRule, Context, initialState } = await import(pathToFileURL(outfile).href);
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { getElementById: () => ({ textContent: JSON.stringify({ app:'talent', teamsOrigin:'http://127.0.0.1:45970', talentOrigin:'http://127.0.0.1:45980' }) }) } });
    Object.defineProperty(globalThis, 'location', { configurable:true, value: { search:'',hash:'#/knowledge' } });
    Object.defineProperty(globalThis, 'localStorage', { configurable:true, value: { getItem:()=>null } });
    const state = initialState();
    const data = JSON.parse(await readFile('fixtures/presentation.json', 'utf8'));
    data.teamsProject = JSON.parse(await readFile('fixtures/teams-project.json', 'utf8'));
    data.skills = JSON.parse(await readFile('fixtures/skill-inventory.json', 'utf8'));
    data.talent = { revision:0, context:{id:'carddemo',name:'信用卡项目',assets:[],generation:'test'}, project:{ knowledge:{status:'ready',assets:[],inputAssetIds:[]},analysis:{status:'idle',scope:'single',findings:[]},evolution:{status:'none',candidates:[],evaluations:[]},projection:{status:'confirmed'} } };
    for (const rule of knowledgeRules) {
      let destination = '';
      openKnowledgeRule(rule, data, (id: string) => { assert.ok(data.evidence.some((item:any) => item.id === id)); destination = id; }, (title:string, content:string) => { assert.ok(data.sources.some((item:any) => item.file === title && item.content === content)); destination = title; });
      assert.ok(destination, 'every rule opens a real source');
    }
    const context = { state, data, role:'owner',busy:false,perform:async()=>{},update:async()=>undefined,run:async()=>undefined,showText:()=>{},showEvidence:()=>{},navigate:()=>{} };
    const render = (Component: any) => renderToStaticMarkup(createElement(Context.Provider,{value:context},createElement(Component)));
    data.graph = [{id:'marketing',name:'营销规则',file:'src/platinum.ts',description:'资格与返现',excerpt:'rule'}];
    assert.match(render(Knowledge), /知识空间/);
    const renderGraph = (selectedId?: string) => renderToStaticMarkup(createElement(KnowledgeGraph,{graph:data.graph,selectedId,onSelect:()=>{},showText:()=>{}}));
    const fallback = renderGraph('reward');
    assert.match(fallback, /营销规则/);
    assert.match(fallback, /aria-pressed="true"/);
    assert.match(fallback, /资格与返现/);
    data.graph.push({id:'account',name:'账户入账',file:'account/ledger.ts',description:'记账校验',excerpt:'ledger'});
    const selected = renderGraph('account');
    assert.match(selected, /记账校验/);
    assert.match(selected, /account\/ledger.ts/);
    data.graph=[];
    assert.match(renderGraph('account'), /暂无代码关系，请先关联项目资料/);
    assert.match(render(Knowledge), /知识空间/);
    const analysis = render(TalentSessions);
    assert.doesNotMatch(analysis, /演示|餐饮|真实历史/);
    context.role='member';
    assert.match(render(Evolution), /由项目 Owner 管理/);
    data.talent.context.id='new-project';
    assert.match(render(Knowledge), /知识空间/);
  } finally {
    delete (globalThis as any).document; delete (globalThis as any).location; delete (globalThis as any).localStorage;
    await rm(directory,{recursive:true,force:true});
  }
});
