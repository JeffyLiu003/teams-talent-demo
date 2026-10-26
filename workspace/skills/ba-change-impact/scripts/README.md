# scripts/ — 变更影响评估技能脚本

本目录包含 `ba-change-impact` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `diff_compare.py` | 新旧需求文档差异对比：基于 difflib.unified_diff 输出差异行数与样例 | 0/3 |

---

## diff_compare.py

### 用途
对比新旧两份需求文档的差异。读取两份文档按行切分，使用 `difflib.unified_diff` 生成差异，统计变更行数（新增行 + 删除行，不含文件头 `+++`/`---`），并输出前 20 行变更样例。Agent 可基于差异结果进一步分析影响范围。

### 接口
```
python diff_compare.py <old_doc> <new_doc> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `old_doc` | 原需求文档路径（.md/.txt），作为差异比对基准 |
| `new_doc` | 新需求文档路径（.md/.txt），作为差异比对目标 |
| `--json` | 显式声明 JSON 输出（默认即为 JSON，效果相同） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 对比成功（无论是否存在差异均返回 0） |
| 3 | 参数错误（文件不存在 / 无法读取） |

> 注意：脚本始终返回 0（除参数错误外），不依据差异数量返回不同退出码。CI 门禁须读取 `diff_lines` 字段判定是否阻断。

### 检查项
1. **文件读取**：分别读取 `old_doc` 与 `new_doc` 全文并按行切分（`splitlines()`）。任一文件不存在或不可读时返回 exit=3。
2. **差异生成**：调用 `difflib.unified_diff(old_lines, new_lines, lineterm="", n=1)` 生成统一差异格式，上下文行数 `n=1`。
3. **变更行过滤**：筛选以 `+` 或 `-` 开头但不以 `+++` 或 `---` 开头的行（即排除文件头标记），作为变更行。
4. **统计与样例**：`diff_lines` = 变更行总数；`sample` = 前 20 行变更行（供 Agent 快速预览）。

### 差异格式说明
- 使用 Python 标准库 `difflib.unified_diff`
- 上下文行数 `n=1`（仅显示 1 行上下文，非默认 3 行）
- 变更行定义：以 `+`（新增）或 `-`（删除）开头，且不是 `+++`/`---`（文件头）
- `diff_lines` = 新增行数 + 删除行数

### JSON 输出示例
存在差异时输出：
```json
{
  "diff_lines": 2,
  "sample": ["-限额5000", "+限额20000"]
}
```

无差异时输出：
```json
{
  "diff_lines": 0,
  "sample": []
}
```

参数错误时输出：
```json
{
  "error": "[Errno 2] No such file or directory: '...'"
}
```

### 调用示例
```bash
# 基本对比
python skills/ba-change-impact/scripts/diff_compare.py ./old-requirement.md ./new-requirement.md

# JSON 输出（供 Agent 消费）
python skills/ba-change-impact/scripts/diff_compare.py ./old-requirement.md ./new-requirement.md --json

# CI 门禁（依据 diff_lines 字段判定）
diff=$(python skills/ba-change-impact/scripts/diff_compare.py ./old.md ./new.md --json | python -c "import sys,json;print(json.load(sys.stdin)['diff_lines'])")
[ "$diff" -gt 0 ] && echo "检测到 $diff 行变更，需影响评估" || echo "无变更"

# 文档示例
# old-requirement.md:
# 日累计限额上限5000元
#
# new-requirement.md:
# 日累计限额上限20000元
# → diff_lines = 2, sample = ["-日累计限额上限5000元", "+日累计限额上限20000元"]
```

### 能力边界
- 仅做文本行级差异比对，不解析需求文档结构（标题/段落/字段）
- 不识别语义差异（如"5000"→"5000元"视为不同行，但不区分是数值变更还是单位变更）
- 不区分差异类型（功能/数据/接口/进度/成本/干系人），须人工或上游 Agent 分类
- 不输出影响范围量化（模块数/故事数/客户数等 L3 深度字段）
- 不引用历史同类变更数据（L3 深度要求须人工补充）
- 上下文行数固定为 `n=1`，不可配置

### 单测对应
`tests/test_scripts.py` 中 `ba-change-impact/diff_compare.py` 条目（3 用例）：
- `changed_docs`：`old="限额5000\n"`, `new="限额20000\n"` → exit=0，输出含 `diff_lines`（diff_lines=2）
- `identical_docs`：两文档内容相同 → exit=0，输出含 `diff_lines`（diff_lines=0）
- `missing_file`：`old` 存在，`new` 不存在 → exit=3，输出含 `error`
