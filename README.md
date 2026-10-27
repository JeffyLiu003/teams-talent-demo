# Teams × iCode × Talents

两个独立启动的演示项目，通过共享数据目录交换数据：

| 项目 | 目录 | 地址 | 负责 |
|---|---|---|---|
| iCode Teams | `teams/` | http://127.0.0.1:45970/teams | 团队协作：项目、需求、交付、验收、会话共享 |
| iCode Talents | `talents/` | http://127.0.0.1:45980/talents | 知识挖掘：来源、知识任务、产物审阅与发布、开发者应用 |

演示需求：信用卡消费返现，针对白金卡客户未来 3 个月的消费，额外增加 0.5% 的消费返现（DEMO-MKT-001，项目「信用卡营销交付」）。

## 启动

安装 Node.js 24 与 Git：

```sh
git clone https://github.com/zhuyuloveai/teams-talent-demo.git
cd teams-talent-demo
npm run setup      # 两个项目各自 npm ci
npm run dev        # 构建并同时启动两边，Ctrl+C 一起停止
```

- 后台启停：`npm start` / `npm stop`（macOS 也可双击 `启动演示.command` / `停止演示.command`，Windows 用 `start-demo.cmd`）。
- 单独启动：`cd teams && npm run dev`，或 `cd talents && npm run dev`。另一边没启动时，读取 `shared/seed/` 中提交的初始数据。

服务仅监听本机。Teams 的配置见 [快速启动](teams/docs/quick-start.md)，Talents 见 [talents/README.md](talents/README.md)。

## 数据怎么流动

```
Teams ── shared/data/teams/snapshot.json ──▶ Talents
         成员与角色、项目、代码仓、设计文档、成员共享的会话

Talents ── shared/data/talents/knowledge.json + files/ ──▶ Teams
           已发布的知识产物（业务知识、开发范式、轨迹诊断、索引）
```

- 每个子目录只有一个写入方。格式定义在 [shared/contracts.ts](shared/contracts.ts)；目录可用 `DEMO_SHARED_DIR` 指定，默认 `shared/data`（不入库）。
- 成员、项目、代码仓和设计文档以 Teams 为准，在 Talents 中只读；Talents 只登记本地文档来源。
- Talents 管理员端对应 Teams Owner（挖掘、审阅、发布），开发者端对应 Teams 成员（应用知识）。
- Talents 为项目发布过知识后，Teams 交付流程中的「项目知识」即视为已就绪；Teams「项目知识」页展示已发布产物并可预览原文。
- 轨迹诊断与 Skill 改进（能力演进）在 Talents 中完成，Teams 只负责共享交付会话。

## 演示主线

1. Teams：Owner 查看项目知识（Talents 已发布 v1）。
2. Talents 管理员端：文档集新增白金卡规则 → 审阅业务知识 v2 草稿 → 让 iCode 修正 BR-CASH-02 的期间边界 → 发布。
3. Teams：项目知识显示 v2；成员准备上下文、开发、检查失败 → 修复 → 提交，Owner 验收，成员上报交付会话。
4. Talents：用交付会话做轨迹诊断 → 审阅并发布 Skill 改进。
5. Talents 开发者端：应用诊断和更新后的业务知识。

## 开发边界

此仓库以隔离状态和预置数据验证交互，不连接银行支付系统，不自动调用外部模型。界面结果不能替代生产运行、模型实验或安全扫描证据。活动日期、金额舍入等测试假设见 [设计说明](teams/docs/demo-design.md)。仓内 Java/业务 Skill 快照（`workspace/`）为来源资料，不代表白金卡规则已经部署到 Java 服务。

从旧的 `demo/` 目录迁移到当前结构，见 [MIGRATION.md](MIGRATION.md)。

## 验证

```sh
npm test                                   # Teams 单元测试 + HTTP 集成 + Talents 测试
cd teams && npm run typecheck && npm run build && npm run test:e2e
cd talents && npm run typecheck
```
