# sdlc-ux-enhancer 脚本说明

本目录包含 SDLC 用户体验增强工具的 4 个独立可运行脚本。所有脚本均以 `#!/usr/bin/env python3` 开头，UTF-8 无 BOM 编码，仅依赖 Python 3 标准库，可独立运行并支持 `--help`。

## 脚本清单与能力边界

### 1. generate_board.py — 进度看板生成器

**能力：** 从 `context-bus.json` 读取各阶段状态，生成 Markdown 格式进度看板（含 ASCII 可视化看板 + 明细表）。

**不做：** 不修改 context-bus.json，不执行门禁校验，不发送通知。

```bash
# 基本用法
python generate_board.py --context .sdlc-demo/context-bus.json --output .sdlc-demo/progress-board.md

# 持续监控（每 30 秒刷新）
python generate_board.py --context .sdlc-demo/context-bus.json --output .sdlc-demo/progress-board.md --watch

# 自定义刷新间隔（60 秒）
python generate_board.py --context .sdlc-demo/context-bus.json --watch --interval 60
```

| 参数 | 说明 |
|------|------|
| `--context` | context-bus.json 路径（必填） |
| `--output` | 输出文件路径（可选，默认仅 stdout） |
| `--watch` | 持续监控模式（可选） |
| `--interval` | 刷新间隔秒数，默认 30（仅 --watch 生效） |

**退出码：** 0=成功，1=失败（文件不存在/解析错误）

**context-bus.json 期望结构（字段宽容）：**
```json
{
  "project": "EPS-demo-project",
  "requirement": "REQ-2026-0003 日累计限额参数化",
  "stages": {
    "G1": {"name":"需求","status":"passed","gate":"PASS","duration":"30min","artifacts":5}
  }
}
```

---

### 2. bypass_manager.py — 门禁旁路管理器

**能力：** 创建/查询/校验门禁旁路记录，检查旁路次数是否超限（≤2 次/流程），形成完整审计链。

**不做：** 不实际放行门禁（门禁放行由各 Gx-gate-execution 决定），不发送通知。G1/G2/G8 不允许旁路。

```bash
# 创建旁路记录
python bypass_manager.py create --phase G4 --gate "用例执行率" \
  --reason "非致命缺陷#003，业务确认可带病上线" \
  --approver "张总" --risk "低" --mitigation "下个迭代修复"

# 列出所有旁路记录
python bypass_manager.py list

# 校验旁路记录完整性（理由/审批人/风险/缓解措施必填）
python bypass_manager.py validate --bypass-file .sdlc-demo/08-pm/bypass-record.json

# 检查旁路次数是否超限
python bypass_manager.py check-limit
```

| 子命令 | 参数 | 说明 |
|--------|------|------|
| `create` | `--phase --gate --reason --approver --risk --mitigation` | 创建旁路（均必填）；`--record-file` 可选 |
| `list` | `--record-file` 可选 | 列出全部旁路记录 |
| `validate` | `--bypass-file`（必填） | 校验记录完整性 |
| `check-limit` | `--record-file`、`--limit` 可选 | 检查是否超限（默认 2 次） |

**退出码：** 0=成功，1=校验失败/参数错误，2=超限

**默认记录文件：** `.sdlc-demo/08-pm/bypass-record.json`

---

### 3. agent_recommender.py — Agent 推荐引擎

**能力：** 输入需求描述，基于关键词匹配推荐应调用的 Agent、Skill、执行顺序和预计产出。

**不做：** 不实际调度 Agent，不执行任何阶段产出。无关键词命中时兜底推荐完整 G1-G8 流程。

```bash
python agent_recommender.py --requirement "日累计限额参数化与超额预警" \
  --output .sdlc-demo/agent-recommendation.json
```

| 参数 | 说明 |
|------|------|
| `--requirement` | 需求描述文本（必填） |
| `--output` | 输出文件路径（可选，默认 `.sdlc-demo/agent-recommendation.json`） |

**退出码：** 0=成功，1=失败

**关键词匹配规则：**

| 关键词 | 推荐 Agent | 推荐 Skill |
|--------|-----------|-----------|
| 需求/业务诉求/验收 | requirement-analyst | ba-requirement-analysis, ba-acceptance-criteria |
| 设计/架构/方案 | solution-architect | arch-solution-design, arch-adr-writing |
| 开发/编码/实现 | developer | dev-backend-service, dev-data-sql |
| 测试/用例/回归 | test-engineer | qa-test-strategy, qa-system-test-design |
| 安全/漏洞/威胁 | security-engineer | sec-threat-model, sec-scan-review |
| 发布/部署/回滚 | release-engineer | release-plan, rollback-runbook |
| 变更/RFC/窗口 | change-manager | change-rfc, change-risk-assessment |
| 门禁/审计/报告 | project-manager | pm-gate-checklist, sdlc-metrics |

---

### 4. notify_sender.py — 通知发送器

**能力：** 读取门禁结果，发送通知到企业微信/钉钉/Slack Webhook。支持 `--dry-run` 预览载荷。

**不做：** 不读取 context-bus.json，不生成门禁结果（门禁结果由各 Gx-gate-execution 产出）。Webhook URL 不会写入日志。

```bash
# 发送到企业微信
python notify_sender.py --message "G3门禁通过" \
  --webhook https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx --channel wechat

# 带门禁结果详情
python notify_sender.py --message "G4门禁失败" \
  --webhook https://oapi.dingtalk.com/robot/send?access_token=xxx --channel dingtalk \
  --gate-result .sdlc-demo/04-test/G4_gate_result.json

# 预览载荷不实际发送
python notify_sender.py --message "G6门禁通过" --webhook https://hooks.slack.com/xxx \
  --channel slack --dry-run
```

| 参数 | 说明 |
|------|------|
| `--message` | 通知正文（必填） |
| `--webhook` | Webhook URL（必填） |
| `--channel` | 渠道：wechat / dingtalk / slack（必填） |
| `--gate-result` | 门禁结果 JSON 路径（可选，补充阶段/状态/指标/下一步） |
| `--title` | 通知标题（默认 "SDLC 门禁通知"） |
| `--dry-run` | 仅打印载荷，不发送 |

**退出码：** 0=成功，1=发送失败（网络/HTTP 错误）

## 通用约定

- 所有脚本在 Windows 下会自动将 stdout/stderr 切换为 UTF-8，以支持中文与 emoji 输出。
- 所有脚本仅使用 Python 3 标准库，无需安装第三方依赖。
- 所有脚本支持 `--help` 查看完整参数说明。
