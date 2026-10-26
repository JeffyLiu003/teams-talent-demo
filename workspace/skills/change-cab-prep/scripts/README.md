# scripts/ — CAB评审材料准备技能脚本

本目录包含 `change-cab-prep` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `cab_material_check.py` | CAB材料完整性检查：扫描材料目录文件名，比对六类必备材料关键词（RFC/风险评估/回滚/测试/影响分析/发布计划） | 0/2/3 |

---

## cab_material_check.py

### 用途
校验CAB评审材料目录的完整性。扫描指定目录下全部文件名（合并为一个字符串），逐项比对六类必备材料关键词是否出现：`RFC`、`风险评估`、`回滚`、`测试`、`影响分析`、`发布计划`。任一关键词未命中即视为材料缺失。

### 接口
```
python cab_material_check.py <cab_dir> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `cab_dir` | CAB材料目录路径，脚本会列出该目录下全部文件名并合并为一个字符串进行关键词匹配 |
| `--json` | 显式声明 JSON 输出（默认即为 JSON，效果相同） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 全部通过（六类材料关键词全部命中） |
| 2 | 失败（存在缺失材料，`missing` 列表非空） |
| 3 | 参数错误（目录不存在 / 无法读取） |

> 退出码优先级：缺失材料（2）> 通过（0）。脚本未定义退出码 1（警告）。

### 检查项
1. **目录读取**：调用 `os.listdir(cab_dir)` 获取目录下全部文件名。目录不存在或不可读时返回 exit=3。
2. **关键词匹配**：将文件名列表以空格拼接为一个字符串，逐项检查 `MATERIALS = ["RFC", "风险评估", "回滚", "测试", "影响分析", "发布计划"]` 中每个关键词是否作为子串出现。
3. **缺失清单**：未命中的关键词汇总为 `missing` 列表。
4. **完整性判定**：`missing` 为空 → `complete=true`、exit=0；否则 `complete=false`、exit=2。

### 材料关键词匹配规则
- 匹配方式：子串包含（`keyword in joined_filenames`）
- 文件名示例：`RFC-001.md` 命中 `RFC`；`风险评估-v2.md` 命中 `风险评估`；`回滚方案.md` 命中 `回滚`；`测试报告.md` 命中 `测试`
- 注意：脚本仅检查文件名，不解析文件内容；材料内容质量需由人工或其他脚本校验

### JSON 输出示例
```json
{
  "missing": ["回滚", "影响分析"],
  "complete": false
}
```

通过时输出：
```json
{
  "missing": [],
  "complete": true
}
```

目录不存在时输出：
```json
{
  "error": "[Errno 2] No such file or directory: '...'"
}
```

### 调用示例
```bash
# 基本校验
python skills/change-cab-prep/scripts/cab_material_check.py ./cab-materials

# JSON 输出（供 Agent 消费）
python skills/change-cab-prep/scripts/cab_material_check.py ./cab-materials --json

# CI 门禁（退出码驱动）
python skills/change-cab-prep/scripts/cab_material_check.py ./cab-materials && echo "CAB材料齐全" || echo "CAB材料缺失"

# 材料目录示例结构
# ./cab-materials/
#   ├── RFC-001.md
#   ├── 风险评估-v2.md
#   ├── 回滚方案.md
#   ├── 测试报告.md
#   ├── 影响分析.md
#   └── 发布计划.md
```

### 能力边界
- 仅校验文件名是否包含关键词，不校验文件内容、字段完整性、签字状态
- 不区分文件类型（.md/.docx/.pdf 均可），不解析文档结构
- 不识别同义词（如"回退"不等同于"回滚"，"测试"与"UAT"不等同）
- 不校验材料版本号、最近更新时间、签字人等L3深度字段
- L3 深度门禁须配合人工或额外脚本完成

### 单测对应
`tests/test_scripts.py` 中 `change-cab-prep/cab_material_check.py` 条目（3 用例）：
- `complete_materials`：六类材料齐全 → exit=0，输出含 `complete`
- `incomplete_materials`：仅 RFC 一项 → exit=2，输出含 `missing`
- `missing_dir`：目录不存在 → exit=3，输出含 `error`
