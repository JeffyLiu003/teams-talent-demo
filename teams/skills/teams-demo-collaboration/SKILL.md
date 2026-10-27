---
name: teams-demo-collaboration
description: 在本机 Teams中开始或继续项目任务，读取所选任务节点上下文，明确采用依据，并向同一任务回传进度、阻塞和成果引用。用于 Teams启动材料提供了项目与任务范围的会话。
---

# Teams 协作

使用启动材料给出的 Teams endpoint、projectId、taskId、nodeId 和 runId。CLI 位于当前工程的 `scripts/teams-demo.mjs`；使用启动材料提供的当前绝对路径；运行 `node <CLI> --help` 查看合同。此 Skill 与 `teams` 命令分别管理。所有写入仅在本机 Teams 服务发生。

开始工作先运行：

```sh
node /ABSOLUTE/PATH/TO/teams/scripts/teams-demo.mjs --endpoint http://127.0.0.1:45970 context get --project PROJECT --task TASK --node NODE --output /tmp/teams-task-context.json
```

Windows PowerShell 中，优先复制启动材料给出的 `& 'Node绝对路径' 'CLI绝对路径' ... --input-file 'scope文件绝对路径'` 命令；scope 文件已由作业入口导出。手工读取也可使用上面的 `--project / --task / --node` 分字段形式，并将输出改为本机路径，例如 `--output "$env:TEMP/teams-task-context.json"`。写入 JSON 使用 `--input-file`，不要在 PowerShell 5.1 中通过 `--input` 内联 JSON，避免原生参数绑定剥掉双引号。文件内容使用 UTF-8；命令只获取材料，不自动采用。

从启动材料复制标识和 endpoint，勿照抄占位符或改用固定任务。项目级材料没有任务时只读取项目上下文；先在 Teams 选择有效任务与节点，再回传任务进度。原生 sessionId 尚未观测时传 null，以 runId 保留启动关联；已知后续 sessionId 需要明确重新采用并保留原记录。

读取输出中的范围、约定与验收标准、节点工作要求、版本、关联正文和缺失项。`mode=preparation` 表示当前准备信息，`mode=frozen` 表示冻结版本。获取文件不等于已阅读或采用。Talent 不可用、冻结知识版本缺失、Skill 只有示例正文等限制会显式返回；先报告影响，不用其他版本替代。

阅读实际需要的材料后，用 `inputs adopt --operation-id OP --input-file REQUEST.json` 明确采用。JSON 字段为 `projectId, taskId, nodeId, runId, sessionId, expectedRevision, basisDigest, readReferences`；若 context 返回的 `scope.tab` 存在，也须原样保留 `tab`，读与写的 scope 必须完全一致；版本和 digest 使用刚读取的值，readReferences 只列实际阅读的引用 ID，允许如实为空。保留返回的 adoptionId 与 revision。

开始实际工作时，以及有意义的里程碑、阻塞和收尾时，运行 `progress add` 或 `result submit`。不要按时间高频刷状态。输入保留同一 scope、runId、sessionId、adoptionId 和当前 expectedRevision：

- `progress add`：`phase` 为 started / progress / blocked，`summary` 写实际进展，阻塞时填 `blocker`，`evidence` 为证据引用数组。解除阻塞时明确说明原因并发 progress，最新回报决定当前协作阻塞提示。
- `result submit`：提供 summary 及至少一个 `evidence`，每项为 `{kind:"reference"|"local-file",value,description,artifact,version,codeVersion?,source:"actual"|"preset"}`。artifact 和 completedCriteria 使用 `context.nodeContract` 当前节点定义；source=preset 仅用于检查报告，不能把 PRD 或代码提交预置为真实完成。version 是产物版本；代码及其设计、单测、检查报告使用相同 codeVersion。本地路径只是一条本机引用，未上传团队存储；引用声明尚未由远端 provider 验真。交付人成果报告保持待确认，完成标准由交付人回传声明，不代表 Teams 自动验证了文件正文或远端 PR；Owner 最终验收独立进行。
- 开发/验证进度携带 `sessionId` 时，Teams 自动关联本项目、本任务、当前节点。Owner 验收通过后自动汇总去重；不要在提交后另行执行会话上报。数据归集不代表 Talent 已接收或完成分析。

每次写入使用一个稳定 operationId。CLI 发送前保存完整请求，成功后保存服务回执；默认目录为 demo `.runtime/cli-receipts`，可用 `--receipt-dir` 指定。非零退出码或失败回执必须向会话明确报告。超时/响应丢失时先 `operation get --operation-id OP`；需要重试时保持原 ID 和完整原载荷。revision 冲突时重新读取并判断如何协调，不能换 ID 绕过冲突。相同 ID 不同载荷会被拒绝。

当前角色只用于本机流程校验，不代表企业认证。不要通过 CLI 改 Owner 验收或旧需求的测试、安全字段。独立需求的检查结果按下方明确的 checks 合同回传。启动提示提供这份文件和读取命令；模型是否实际读取由会话执行确认，不能声称自动加载或自动完成同步。

## 统一需求交付任务

MKT-001（内部 `DEMO-MKT-001`）与新增需求共用以下合同。必须沿启动材料中的任务身份回传，不能替换为其他需求 ID。每条写入携带原生会话提供的真实 `sessionId` 与本次 `runId`，不能编造或复用历史会话。启动材料提供 `native-session.json` 时，等待并读取该文件，它由原生进程观察器记录，不是业务完成回执。

1. 在 `prepare` 节点读取 `context get`，实际核对 Talent 返回的知识与 Skill 正文，然后 `inputs adopt`；只列出实际读过的 `readReferences`。该操作仅保存本任务输入版本，不代表需求澄清完成。读取 `context.nodeContract` 的输入、交付物和完成标准，编写包含目标、范围、规则、验收标准及待确认项的 PRD。影响开发的关键事项未确认时报告阻塞，不能凭空确认。用 `result submit` 提交 `artifact="prd"` 的引用及明确已满足的 `completedCriteria` ID 后才能进入开发。
2. 切换 `develop` 后重新读取上下文并采用当前节点依据；通过 `progress add` 回传 `started`、`progress` 或 `blocked`。真实实施代码变更、执行检查后，用 `result submit` 提交至少一条真实文件/成果引用。交付软件设计文档、GitHub PR／提交、单元测试及结果；分别使用 `software-design`、`code-change`、`unit-test-result` 分类，同一实现的 `codeVersion` 必须一致。已确认 PRD 使用原上游引用与版本，不另复制一份字符串。完成标准齐全后提交开发结果进入验证。
3. 在 `verify` 节点重新读取与采用，检查回传可以携带 `checks` 数组，每项为 `{ "artifact": "functional-test-report"或"code-review-report"或"security-report", "status": "passed"或"failed", "source": "actual"或"preset", "summary": "实际执行或预置检查的具体范围与结果" }`。功能测试、代码检视、安全报告分别作为同类型 evidence；问题与复测记录使用 `issues-retest`（无问题也如实说明）。这些报告必须引用上游代码的同一 `codeVersion`，报告 source 与对应 checks 来源相同。允许的预置检查必须写 `preset`；真实命令执行结果写 `actual`，不能混淆。失败后回传阻塞/修复说明，复检通过后 `result submit`。失败结果可以如实提交为未完成记录，不能声明 `verify.current` 已满足。重新通过时需三类检查结论、四类验证交付物及本节点全部标准，且整批无失败，才能进入待 Owner 验收。Owner 退回或重新开发后必须提交新检查，旧检查仅保留历史。
4. 停在待 Owner 验收，不得调用 Owner 验收接口或冒充 Owner。验收通过后的会话归集与 Talent 上报由 Teams 自动触发，接收回执与验收状态分开保存。

每次写前使用最新 `revision`；节点变更需重新 `context get`、`inputs adopt`，不能把上一节点的采用记录跨节点使用。遇到明确失败先读取错误及最新上下文，不通过页面或直接改状态文件补成成功。


按节点使用输入：`context.nodeInputs` 是 Talent 按项目、需求、节点返回的精确知识与 Skill，`selection` 保留预置场景来源、版本和关联理由。只使用本节点返回的正文与引用，不补读项目全量 Skill 或其他项目输入；未配置/不可读必须明确报告。`historical-subset` 只代表历史已采用内容的相关部分，不能当作新推荐已被采用。每节点 `inputs adopt` 保存本节点版本；读取页面或上下文不自动采用。

执行身份：保留启动材料中的 `--role owner` 或 `--role member`。Owner 也可作为交付人；仅当前角色稳定身份与 task.assigneeId 一致时可以采用、回传或关联会话。项目内他人的任务可读，但不得代其启动或写进度。即使 Owner 本人交付，CLI 仍不可替代人工验收确认。
