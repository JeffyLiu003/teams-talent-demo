# Teams × iCode × Talent Demo

一个可在本机运行的协作交付演示：Teams 管理项目、需求与任务交付，iCode 提供可选的原生执行入口，Talent 通过独立服务提供业务知识、轨迹分析与能力演进演示。

网页包含 Owner / 成员角色、项目资产关联、需求准备、开发与质量回放、验收、资源发布订阅，以及真实调用本机演示 API 的 Teams Skill / CLI。业务状态、企业连接、账户验收和 Talent 构建／评估为标记清楚的 mock；历史证据节选与当前演示操作分别标注。

## 快速启动

安装 **Node.js 24.14.1**（含 npm）与 Git，然后运行：

```sh
git clone https://github.com/zhuyuloveai/teams-talent-demo.git
cd teams-talent-demo/demo
npm ci
npm run dev
```

保持终端打开，浏览器访问：

- Teams：<http://127.0.0.1:45970/teams>
- Talent：<http://127.0.0.1:45980/talent>

按 `Ctrl+C` 停止前台服务。首次启动会生成独立的 Teams 与 Talent 状态，后续重启保留进度。网页右上角切换角色，按照「演示指引」体验完整流程。

Windows 可双击根目录 `start-demo.cmd`；macOS 可双击「启动演示.command」，再用「停止演示.command」停止后台服务。macOS 已实测；Windows 使用跨平台 Node/npm 入口，尚未进行 Windows 实机验证。端口、后台运行、停止及可选工具配置见 [快速启动说明](demo/docs/quick-start.md)。

## 目录

```text
demo/       React + antd 页面、独立 Teams/Talent 服务、演示 CLI/Skill、测试及 fixtures
workspace/  CardDemo Java 业务源码快照，以及 59 个项目业务 Skill
analysis/   自包含的交付与 Talent 旁路讨论图（HTML 和 JSON）
```

[打开工作流讨论图](analysis/teams-icode-talent-workflow.html)；该图表达讨论方案，包含尚未实现的旁路能力。

本仓库不包含原始会话、原始压缩包、iCode/OpenCode 二进制、模型凭据、设备状态、依赖安装目录、构建结果、日志或截图。Java 快照用于查看业务资料；启动网页演示无需运行 Java 微服务、PostgreSQL 或 Docker。

## Teams Skill / CLI

在 `demo` 目录中运行：

```sh
node scripts/teams-demo.mjs context get --project carddemo --task DEMO-MKT-001 --node prepare
node scripts/teams-demo.mjs --help
```

[Teams 协作 Skill](demo/skills/teams-demo-collaboration/SKILL.md) 包含上下文读取、明确采用依据、进度／阻塞／成果回传及幂等重试合同。CLI 只连接明确的本机 Teams 演示服务。进度绑定项目、任务、节点与 run/session，成员成果报告保留待确认状态，不会替代 Owner 验收或安全结论。文件随仓提供，未自动安装到用户目录，也不表示 Agent 已读取或已采用。

## 可选原生工具与历史素材

网页和演示 CLI 无需 iCode 或模型账号。使用原生工具时自行安装合适版本，并配置自己的模型与凭据；通过 `DEMO_ICODE_BINARY` 指定可执行文件。自动打开终端与进入已运行会话的桥仅支持 macOS；Windows 需手工启动原生工具。

公开仓库未附带原始历史会话。`restore-history.mjs` 为可选迁移工具，只有另外获得匹配、获准使用的历史素材后才能使用。脚本保留原路径前缀作为精确迁移输入，拒绝覆盖已有会话或锁，并保持大整数及原始轨迹文件字节。没有素材时无法导入或恢复原生历史，网页中的历史节选仍可查看。

## 来源与边界

- `demo/teams-baseline.json` 和 Teams fixture 保留原源码提交与文件摘要；公开副本仅将设备路径元数据整理为相对路径或明确未附带的参考目录。`sourceRoot` 占位路径不会指向本仓库。
- 必要历史需求、检查与变更节选保留证据语义，不包含完整原始会话。历史文档中的路径与版本指向其原始来源，不能据此推断本机已安装、原始 COBOL 工程已附带或历史测试已重新执行。
- CardDemo 微服务中的固定 demo 口令、`change-me` secret 和 Skill 模板中的示例凭据用于本地样例，不是生产凭据。保留原始来源正文与摘要，不作为生产部署配置。
- 两个角色与本机服务令牌用于演示，不构成企业认证。服务仅监听 `127.0.0.1`。功能验收不会把安全状态从「未验证」改为已通过。

完整功能、架构与七个案例见 [demo/README.md](demo/README.md)。

## 验证

```sh
cd demo
npm run typecheck
npm test
npm run build
```

浏览器测试需另有 Google Chrome；使用隔离临时状态并禁用真实终端启动：

```sh
npm run test:e2e
npm run test:collaboration:e2e
npm run test:project-work:e2e
```

生成的 `node_modules`、`dist`、`.runtime`、`.talent-runtime` 与 `test-results` 均被忽略。
