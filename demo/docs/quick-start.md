# 快速启动

需要 Node.js 24、npm 和 Git。进入 demo 目录：

```sh
npm ci
npm run dev
```

Teams：http://127.0.0.1:45970/teams；Talent：http://127.0.0.1:45980/talent。Ctrl+C 停止。状态分别保存在忽略目录 .runtime 和 .talent-runtime，重启保留。

Windows 可运行仓库 start-demo.cmd；macOS 可运行仓库启动/停止 command 文件。原生工具可选，不是网页运行的前提。配置自己的可执行文件时使用 DEMO_ICODE_BINARY 或 DEMO_OPENCODE_BINARY，不在仓库提交密钥。

## 操作顺序

Owner 在项目概览关联资产，在任务管理中分配需求。成员进入任务交付页后，Teams 自动从 Talent 获取该任务的知识和 Skill；成员确认上下文并启动 iCode，开发、检查结果和进度通过 Teams CLI 回传。Owner 验收通过后，Teams 自动归集前面节点关联的一个或多个会话，并上报 Talent；页面分别展示验收状态和上报回执。Talent 的后续分析与能力演进异步进行，不作为本次任务完成条件；本次真实链路验证覆盖到会话持久接收。

UI 沿产品页面操作，不会发生真实支付。用户确认独立需求的 iCode 作业后，将调用本机 iCode 和当前配置的模型执行任务；普通页面访问不会启动模型。检查记录区分实际执行与预置结果，生产安全状态未验证。

## 验证命令

```sh
npm run typecheck
npm test
npm run build
npm run test:http
```

浏览器脚本需要额外 Chrome 运行环境；只有实际执行的检查才可声明通过。工作区旧状态与当前活动冲突时，由 Owner 使用重置工作区重新开始；不会重写源码或原生会话。

## CLI

```sh
node scripts/teams-demo.mjs --help
node scripts/teams-demo.mjs context get --project carddemo --task DEMO-MKT-001 --node prepare
```

CLI 仅连接明确的本机服务，并要求项目、任务和节点上下文。

## 本机持久配置

在同一 Git 仓库的 `demo` 中开发与运行：`npm run dev` 用于前台运行，`npm run launch` / `npm run stop` 用于后台启停，并核对当前目录的服务归属。新作业和 Skill 源文件默认来自该仓库的 `workspace`，不依赖另一份应用副本。

本机配置放在被 Git 忽略的 `demo/.local/config.json`，启动、停止、服务和 Teams CLI 共用；显式 shell 环境变量优先。默认文件缺失使用原默认值；显式指定的文件缺失、损坏 JSON、未知键和错误类型直接报错。路径键 `DEMO_MATERIAL_ROOT`、`DEMO_STATE_DIR`、`DEMO_TALENT_STATE_DIR`、`DEMO_ICODE_BINARY`、`DEMO_ICODE_PYTHON`、`DEMO_OPENCODE_BINARY` 均须为绝对路径；端口键 `DEMO_PORT`、`DEMO_TALENT_PORT` 须为 1024–65535 的 JSON 整数。绝对路径环境变量 `DEMO_LOCAL_CONFIG` 可选择独立配置文件，用于隔离运行与测试。

可将两份状态分别放在 `.local/state/teams` 和 `.local/state/talent`，配置对应状态目录；Teams CLI 默认回执随 Teams 状态目录保存。iCode 与其 Python 可指向仓库外的安装位置。不要把整个材料根目录指向旧运行副本。当前产品仅提供新作业入口；原生历史会话保持原位置，迁移备份仅保存在本机；不会自动迁移或重写。
