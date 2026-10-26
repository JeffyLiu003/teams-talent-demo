# scripts/ — 回滚手册技能脚本

本目录包含 `rollback-runbook` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `rollback_check.py` | 回滚手册完整性校验：检查回退点/步骤/验证/责任人/时限等必填章节是否齐全 | 0/2/3 |

---

## rollback_check.py

### 用途
校验回滚手册 Markdown 文档是否包含全部必填章节关键词。检测缺失章节（回滚/步骤/验证/责任人/时限），确保回滚手册可执行、可验证、可追溯。是发布计划编制时的确定性门禁，回滚手册不完整则发布计划不予通过。

### 接口
```
python rollback_check.py <rollback_md> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `rollback_md` | 回滚手册 Markdown 文件路径 |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 必填章节关键词
| 关键词 | 对应章节 |
|--------|---------|
| 回滚 | 回滚手册主体与回退点说明 |
| 步骤 | 命令级回滚步骤 |
| 验证 | 回滚后验证方法 |
| 责任人 | 每步责任人 |
| 时限 | 回退时限要求 |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 手册完整（全部必填关键词均存在，complete=true） |
| 2 | 手册不完整（存在缺失关键词，complete=false） |
| 3 | 参数错误（文件不存在 / 读取失败） |

> 退出码判定：`missing` 列表为空时返回 0；非空时返回 2。任一必填关键词缺失即视为不完整。

### 检查项
1. **文件读取**：读取 Markdown 文件，失败返回退出码 3。
2. **关键词扫描**：对全部必填关键词（回滚/步骤/验证/责任人/时限）逐一检查是否出现在文档中。
3. **缺失汇总**：未出现的关键词进入 `missing` 列表。
4. **结论输出**：`missing` 为空 → `complete=true`（退出码 0）；非空 → `complete=false`（退出码 2）。

### 输入
无需独立输入 JSON；校验目标为命令行参数指定的 Markdown 文件。

### JSON 输出示例
```json
{
  "missing": ["时限"],
  "complete": false
}
```

### 调用示例
```bash
# 基本校验（人类可读 JSON）
python skills/rollback-runbook/scripts/rollback_check.py rollback-runbook.md

# JSON 输出（供 Agent 消费）
python skills/rollback-runbook/scripts/rollback_check.py rollback-runbook.md --json

# CI 门禁（手册不完整则阻断发布计划）
python skills/rollback-runbook/scripts/rollback_check.py rollback-runbook.md && echo "回滚手册校验通过" || echo "回滚手册不完整"
```

### 能力边界
- 仅做关键词存在性检查，不校验章节内容质量（如步骤是否真正可执行、时限是否合理）。
- 关键词匹配为子串匹配（`in` 操作），不区分章节标题级别或位置。
- 不校验回退点类型覆盖（代码/数据/配置）、量化触发条件、DBA签字等深度字段（由 L3 人工评审补充）。
- 不解析 Markdown AST，仅做纯文本扫描。
- 不支持多文件批量校验，每次仅校验单个文件。
- 不执行回滚演练，仅校验文档完整性。

### 单测对应
`tests/test_scripts.py` 中 `rollback-runbook/rollback_check.py` 条目（3 用例）：
- `complete_runbook`：含全部必填关键词（回滚/步骤/验证/责任人/时限）→ exit=0，输出含 `complete`
- `incomplete_runbook`：仅含标题 → exit=2，输出含 `missing`
- `missing_file`：文件不存在 → exit=3，输出含 `error`
