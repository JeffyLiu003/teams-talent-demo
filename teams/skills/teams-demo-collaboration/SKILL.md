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

阅读实际需要的材料后，用 `inputs adopt --operation-id OP --input-file REQUEST.json` 明确采用。JSON 字段为 `projectId, taskId, nodeId, runId, sessionId, expectedRevision, basisDigest, readReferences`；版本和 digest 使用刚读取的值，readReferences 只列实际阅读的引用 ID，允许如实为空。保留返回的 adoptionId 与 revision。

开始实际工作时，以及有意义的里程碑、阻塞和收尾时，运行 `progress add` 或 `result submit`。不要按时间高频刷状态。输入保留同一 scope、runId、sessionId、adoptionId 和当前 expectedRevision：

- `progress add`：`phase` 为 started / progress / blocked，`summary` 写实际进展，阻塞时填 `blocker`，`evidence` 为证据引用数组。解除阻塞时明确说明原因并发 progress，最新回报决定当前协作阻塞提示。
- `result submit`：提供 summary 及至少一个 `evidence`，每项为 `{kind:"reference"|"local-file",value,description}`。本地路径只是一条本机引用，未上传团队存储；引用声明尚未由远端 provider 验真。成员成果报告保持待确认，质量检查和 Owner 验收仍走原流程。
- `session report`：仅支持已提交交付的 CardDemo 历史会话追溯关联，需已知 sessionId；开发中的普通进度已经携带 session/run，不能把追溯关联当作 Talent 会话上传成功。

每次写入使用一个稳定 operationId。CLI 发送前保存完整请求，成功后保存服务回执；默认目录为 demo `.runtime/cli-receipts`，可用 `--receipt-dir` 指定。非零退出码或失败回执必须向会话明确报告。超时/响应丢失时先 `operation get --operation-id OP`；需要重试时保持原 ID 和完整原载荷。revision 冲突时重新读取并判断如何协调，不能换 ID 绕过冲突。相同 ID 不同载荷会被拒绝。

当前角色只用于本机流程校验，不代表企业认证。不要通过 CLI 改验收、测试或安全字段。启动提示提供这份文件和读取命令；模型是否实际读取由会话执行确认，不能声称自动加载或自动完成同步。
