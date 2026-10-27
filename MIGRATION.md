# 从 demo/ 迁移到 teams/ + talents/

原来的 `demo/` 同时包含 Teams 和 Talent 两个服务。现在拆成两个独立启动的项目：`teams/`（原 `demo/` 改名后去掉 Talent 部分）和 `talents/`，两者通过 `shared/data` 交换数据。Teams 的页面、交付流程、状态结构基本保持不变。

## 合并在途分支

1. 分两步合并，让 git 先识别目录改名：
   ```sh
   git merge 9038aaa          # 只做 demo/ → teams/ 改名和路径字符串替换
   git merge split-teams-talents
   ```
   第一步之后，你在 `demo/` 下修改的文件会落到 `teams/` 下对应位置；新增的文件如果还留在 `demo/`，手动 `git mv` 到 `teams/`。
2. 第二步可能冲突的文件，以分支上的版本为准再移植你的改动：
   - `teams/src/components/project-knowledge.tsx`（重写，改为展示 Talents 发布的产物）
   - `teams/src/components/enterprise-source-data.tsx`（去掉「业务知识（Talent）」分支）
   - `teams/src/main.tsx`（去掉 Talent 页面和侧栏分支）
   - `teams/server/index.ts`（去掉 Talent 集成接口，新增共享数据读写）
   - `teams/package-lock.json`（新增 `marked`；冲突时重新 `npm install`）
3. 代码里写死的 `demo/...` 路径改成 `teams/...`；本机的 `demo/.local/config.json`、`demo/.runtime/` 移到 `teams/` 下。

## 已移除或改变的接口

| 原来 | 现在 |
|---|---|
| `server/talent.ts`、`talent-store.ts`、`talent-integration.ts`、`talent-knowledge.ts`、`/api/integrations/talent/*` | 删除。Teams 读写共享目录：`server/shared-data.ts`。要给 Talents 的新数据，加到 `shared/contracts.ts` 的 `TeamsSnapshot`，并在 `teamsSnapshot()` 中导出 |
| `perform('knowledge')`、「发起项目知识整合」按钮 | `POST /api/action {action:'knowledge'}` 返回 400。Talents 发布后，`GET /api/state` 自动同步，读 `state.knowledge` 和新增的 `state.knowledgeVersion` |
| `candidate` / `evaluate` / `release` / `adopt`、`'analysis.run'` | 类型和 `state.evolution`、`workspace.analysis` 字段保留，但服务端拒绝这些操作（已迁移到 Talents）；`adoptedSkill` / `adoptedAgent` 不变 |
| `getBusinessKnowledge()`（`src/api.ts`） | `getTalentsKnowledge(projectId)` 返回 `PublishedArtifact[]`；`getTalentsFile(artifact, path)` 读取原文 |
| `talentLink(page)` | 签名不变；跳到独立的 Talents（`/talents?role=…#/…`），`knowledge` 按角色到审阅页或开发者知识页，`sessions` / `evolution` 到知识任务 |
| `systemRuntime().app === 'talent'`、`data.talent`、`src/pages/talent.tsx`、`talent-contract.ts` | 删除，Teams 只有一种运行模式 |
| `business-knowledge` 来源插件、`talent` 企业连接、`SourceAssetKind` 的 `'knowledge'` | 删除；Talents 产物只在「项目知识」中展示 |
| `npm run start:teams` 等脚本 | 仍可用，与 `npm start` 等相同；`start:talent` 等删除，改用仓库根目录的 `npm run dev` |
| 本机配置 `DEMO_TALENT_STATE_DIR` | 仍被接受但不再使用；新增 `DEMO_SHARED_DIR`、`DEMO_SHARED_SEED_DIR` |

## 文档记录

「信用卡营销交付」项目的 ADR-009、ADR-007 两条设计文档记录，改为指向 `workspace/carddemo-java-1025/docs/design/adr/` 下的真实 ADR，不再指向 `teams/docs/cashback-integration.md`、`security-scope.md`（这两个文件保留，未再被引用）。

## 验证

```sh
cd teams && npm run typecheck && npm test && npm run test:http
```
