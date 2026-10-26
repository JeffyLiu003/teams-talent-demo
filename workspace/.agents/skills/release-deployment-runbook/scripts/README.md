# scripts/ — 部署手册技能脚本

本目录包含 `release-deployment-runbook` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `runbook_validator.py` | 部署手册完整性校验：检查前置检查/部署步骤/后置验证/异常处理/操作/验证等必填章节是否齐全 | 0/2/3 |

---

## runbook_validator.py

### 用途
校验部署手册 Markdown 文档是否包含全部必填章节关键词。检测缺失章节（前置检查/部署步骤/后置验证/异常处理/操作/验证），确保部署手册可执行、可验证、可回滚。是发布执行前的确定性门禁。

### 接口
```
python runbook_validator.py <runbook_md> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `runbook_md` | 部署手册 Markdown 文件路径 |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 必填章节关键词
| 关键词 | 对应章节 |
|--------|---------|
| 前置检查 | 部署前环境与依赖检查 |
| 部署步骤 | 命令级部署操作 |
| 后置验证 | 部署后业务与技术验证 |
| 异常处理 | 异常处置与应急联系 |
| 操作 | 步骤级操作描述 |
| 验证 | 验证方法说明 |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 手册完整（全部必填关键词均存在，valid=true） |
| 2 | 手册不完整（存在缺失关键词，valid=false） |
| 3 | 参数错误（文件不存在 / 读取失败） |

> 退出码判定：`missing` 列表为空时返回 0；非空时返回 2。任一必填关键词缺失即视为不完整。

### 检查项
1. **文件读取**：读取 Markdown 文件，失败返回退出码 3。
2. **关键词扫描**：对全部必填关键词（前置检查/部署步骤/后置验证/异常处理/操作/验证）逐一检查是否出现在文档中。
3. **缺失汇总**：未出现的关键词进入 `missing` 列表。
4. **结论输出**：`missing` 为空 → `valid=true`（退出码 0）；非空 → `valid=false`（退出码 2）。

### 输入
无需独立输入 JSON；校验目标为命令行参数指定的 Markdown 文件。

### JSON 输出示例
```json
{
  "missing": ["后置验证", "异常处理"],
  "valid": false
}
```

### 调用示例
```bash
# 基本校验（人类可读 JSON）
python skills/release-deployment-runbook/scripts/runbook_validator.py deploy-runbook.md

# JSON 输出（供 Agent 消费）
python skills/release-deployment-runbook/scripts/runbook_validator.py deploy-runbook.md --json

# CI 门禁（手册不完整则阻断发布）
python skills/release-deployment-runbook/scripts/runbook_validator.py deploy-runbook.md && echo "部署手册校验通过" || echo "部署手册不完整"
```

### 能力边界
- 仅做关键词存在性检查，不校验章节内容质量（如命令是否真正可执行）。
- 关键词匹配为子串匹配（`in` 操作），不区分章节标题级别或位置。
- 不校验步骤顺序、责任人、回退命令等深度字段（由 L3 人工评审补充）。
- 不解析 Markdown AST，仅做纯文本扫描。
- 不支持多文件批量校验，每次仅校验单个文件。

### 单测对应
`tests/test_scripts.py` 中 `release-deployment-runbook/runbook_validator.py` 条目（3 用例）：
- `complete_runbook`：含全部必填关键词 → exit=0，输出含 `valid`
- `incomplete_runbook`：仅含标题 → exit=2，输出含 `missing`
- `missing_file`：文件不存在 → exit=3，输出含 `error`
