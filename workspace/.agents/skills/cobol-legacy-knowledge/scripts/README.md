# scripts/ — COBOL存量知识技能脚本

本目录包含 `cobol-legacy-knowledge` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `legacy_adapter.py` | 五层模型→岗位消费格式适配器：按 profile（ba_requirement/arch_design）筛选对应层级，纯格式转换不做推断 | 0/3 |

---

## legacy_adapter.py

### 用途
将五层业务模型（L1–L5）按岗位 profile 转换为消费格式。`ba_requirement` profile 筛选 L1/L2/L3 三层（业务/领域/流程），`arch_design` profile 筛选 L2/L3/L4/L5 四层（领域/流程/系统/实现）。脚本为纯格式转换，不做知识推断，输出与原始模型逐字段一致。

### 接口
```
python legacy_adapter.py <model_json> [--profile ba_requirement|arch_design] [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `model_json` | 五层模型JSON文件路径，须含字段：`levels`（字典，键为 L1_business/L2_domain/L3_process/L4_system/L5_implementation）、`evidence`（字典，证据信息） |
| `--profile` | 岗位消费 profile，取值 `ba_requirement`（默认）或 `arch_design` |
| `--json` | 显式声明 JSON 输出（默认即为 JSON，效果相同） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 适配成功（无论模型内容是否完整均返回 0） |
| 3 | 参数错误（文件不存在 / JSON 解析失败 / profile 取值非法） |

> 注意：脚本始终返回 0（除参数错误外），不依据模型完整性返回不同退出码。CI 门禁须读取 `content` 字段判定是否阻断。

### 检查项
1. **JSON 加载**：读取 `model_json` 文件并解析为字典。文件不存在或 JSON 非法时返回 exit=3。
2. **Profile 校验**：`--profile` 取值须为 `ba_requirement` 或 `arch_design`（argparse choices 强制校验），非法取值时 argparse 自动报错。
3. **层级筛选**：按 profile 从 `model.levels` 中筛选对应层级。缺失的层级默认返回空列表 `[]`。
4. **证据透传**：`model.evidence` 字段原样透传到输出，不做筛选或推断。

### Profile 与层级映射
| Profile | 筛选层级 | 适用岗位 |
|---------|---------|---------|
| `ba_requirement` | L1_business（业务）、L2_domain（领域）、L3_process（流程） | BA / 需求条线 |
| `arch_design` | L2_domain（领域）、L3_process（流程）、L4_system（系统）、L5_implementation（实现） | Arch / 架构条线 |

### 五层模型字段说明
| 层级键 | 含义 |
|--------|------|
| `L1_business` | 业务层（业务目标/价值/干系人） |
| `L2_domain` | 领域层（领域概念/术语/规则） |
| `L3_process` | 流程层（业务流程/场景/步骤） |
| `L4_system` | 系统层（系统组件/接口/数据） |
| `L5_implementation` | 实现层（程序/段/行/技术细节） |

### JSON 输出示例
ba_requirement profile 输出：
```json
{
  "profile": "ba_requirement",
  "content": {
    "L1_business": [{"fact": "日终批处理清算", "evidence": {"program": "BATC001", "line": 120}}],
    "L2_domain": [{"fact": "清算账户", "evidence": {"program": "BATC001", "line": 135}}],
    "L3_process": [{"fact": "清算流程步骤1：读取账户余额", "evidence": {"program": "BATC001", "line": 140}}]
  },
  "evidence": {"BATC001": {"lines_scanned": 200, "last_updated": "2026-08-01"}}
}
```

arch_design profile 输出：
```json
{
  "profile": "arch_design",
  "content": {
    "L2_domain": [{"fact": "清算账户", "evidence": {"program": "BATC001", "line": 135}}],
    "L3_process": [{"fact": "清算流程步骤1", "evidence": {"program": "BATC001", "line": 140}}],
    "L4_system": [{"fact": "清算服务接口", "evidence": {"program": "BATC002", "line": 50}}],
    "L5_implementation": [{"fact": "COBOL程序BATC002", "evidence": {"program": "BATC002", "line": 1}}]
  },
  "evidence": {"BATC001": {"lines_scanned": 200, "last_updated": "2026-08-01"}}
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
# BA 岗位消费（默认 profile）
python skills/cobol-legacy-knowledge/scripts/legacy_adapter.py ./five-level-model.json

# 显式指定 BA profile
python skills/cobol-legacy-knowledge/scripts/legacy_adapter.py ./five-level-model.json --profile ba_requirement

# Arch 岗位消费
python skills/cobol-legacy-knowledge/scripts/legacy_adapter.py ./five-level-model.json --profile arch_design --json

# CI 门禁（检查 profile 字段与内容非空）
profile=$(python skills/cobol-legacy-knowledge/scripts/legacy_adapter.py ./model.json --profile arch_design --json | python -c "import sys,json;d=json.load(sys.stdin);print(d['profile'])")
[ "$profile" = "arch_design" ] && echo "适配成功" || echo "适配失败"

# five-level-model.json 示例
# {
#   "levels": {
#     "L1_business": [{"fact": "日终清算", "evidence": {"program": "BATC001", "line": 120}}],
#     "L2_domain": [{"fact": "清算账户", "evidence": {"program": "BATC001", "line": 135}}],
#     "L4_system": [{"fact": "清算服务", "evidence": {"program": "BATC002", "line": 50}}],
#     "L5_implementation": [{"fact": "COBOL程序BATC002", "evidence": {"program": "BATC002", "line": 1}}]
#   },
#   "evidence": {"BATC001": {"lines_scanned": 200}}
# }
# → ba_requirement: content = {L1_business:[...], L2_domain:[...], L3_process:[]}
# → arch_design: content = {L2_domain:[...], L3_process:[], L4_system:[...], L5_implementation:[...]}
```

### 能力边界
- 仅做层级筛选与格式转换，不做知识推断/补全/纠错
- 缺失层级默认返回空列表 `[]`，不报错（模型完整性须人工或额外脚本校验）
- 不校验证据字段真实性（程序名/段名/行号是否对应实际代码）
- 不输出存量风险量化、迁移影响、业务连续性等 L3 深度字段
- 不识别五层模型间的语义一致性（L1 与 L3 是否对齐等 L3 深度要求须人工或额外脚本完成）
- 复用 `extract-cobol-knowledge/scripts/scan_as400_codebase.py` 生成原始五层模型，本脚本仅消费其输出

### 单测对应
`tests/test_scripts.py` 中 `cobol-legacy-knowledge/legacy_adapter.py` 条目（3 用例）：
- `ba_profile`：模型含 L1_business/L2_domain/L4_system，profile=ba_requirement → exit=0，输出含 `profile`（content 含 L1_business/L2_domain，L3_process 为空）
- `arch_profile`：模型含 L2_domain/L5_implementation，profile=arch_design → exit=0，输出含 `profile`（content 含 L2_domain/L5_implementation，L3_process/L4_system 为空）
- `missing_file`：文件不存在 → exit=3，输出含 `error`
