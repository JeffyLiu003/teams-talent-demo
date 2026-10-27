# Teams × iCode × Talent

项目协作与交付工作区。Teams 管理项目、需求、交付和验收；Talent 提供项目知识、记录分析及能力版本；iCode 是可选的原生作业入口。

## 启动

安装 Node.js 24 与 Git：

```sh
git clone https://github.com/zhuyuloveai/teams-talent-demo.git
cd teams-talent-demo/demo
npm ci
npm run dev
```

- Teams：http://127.0.0.1:45970/teams
- Talent：http://127.0.0.1:45980/talent

服务仅监听本机。Ctrl+C 停止前台服务。详细启动、配置与验证见 [快速启动](demo/docs/quick-start.md)。

## 当前范围

- 工作台、团队、项目资产、需求材料与四节点交付。
- 资源发布/订阅、Agent 管理、企业连接和项目设置。
- 白金卡客户 3 个月消费额外返现 0.5% 的贯通流程。
- 交付记录关联、Talent 知识、分析、候选评估与版本采用。

页面按产品工作流组织，不设置演示导航。角色切换用于本地流程验证，企业身份认证尚未接入。

## 开发边界

此仓库以隔离状态和预置数据验证交互，不连接银行支付系统，不自动调用外部模型。界面结果不能替代生产运行、模型实验或安全扫描证据。活动日期、金额舍入等测试假设见 [设计说明](demo/docs/demo-design.md)。

当前流程不再使用旧餐饮返现、报名缺陷或历史回放记录。Git 提交历史保留；仓内 Java/业务 Skill 快照为来源资料，不代表白金卡规则已经部署到 Java 服务。

## 验证

```sh
cd demo
npm run typecheck
npm test
npm run build
npm run test:http
```

完整入口与场景说明见 [项目说明](demo/README.md) 和 [页面地图](demo/docs/page-map.md)。
