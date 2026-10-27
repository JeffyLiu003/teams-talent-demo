# 快速启动

需要 Node.js 24、npm 和 Git。进入 demo 目录：

```sh
npm ci
npm run dev
```

Teams：http://127.0.0.1:45970/teams；Talent：http://127.0.0.1:45980/talent。Ctrl+C 停止。状态分别保存在忽略目录 .runtime 和 .talent-runtime，重启保留。

Windows 可运行仓库 start-demo.cmd；macOS 可运行仓库启动/停止 command 文件。原生工具可选，不是网页运行的前提。配置自己的可执行文件时使用 DEMO_ICODE_BINARY 或 DEMO_OPENCODE_BINARY，不在仓库提交密钥。

## 操作顺序

Owner 在项目内容关联资产、整合知识并分配需求。成员在交付页完成准备、开发、检查和提交。Owner 验证消费与规则、确认验收。成员上报记录后，Owner 在 Talent 分析、评估和发布候选，再由项目采用。

UI 沿产品页面操作，不添加演示导航。底层数据为隔离的本地测试状态；不会发生真实支付或自动调用模型。生产安全状态未验证。

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
