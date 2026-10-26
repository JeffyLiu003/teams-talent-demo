# scripts/ — 变更风险评估技能脚本

本目录包含 `change-risk-assessment` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `risk_classifier.py` | 变更风险分级建议：按影响面/失败概率/回滚完整性/应急预案四维打分，输出风险等级（低/中/高） | 0/3 |

---

## risk_classifier.py

### 用途
对变更风险进行量化分级。读取评估 JSON（含 `impact_scope`、`failure_likelihood`、`has_rollback`、`has_emergency` 四个字段），按权重累加得分，输出风险等级建议。Agent 可参考该建议，人工可调整但须记录理由。

### 接口
```
python risk_classifier.py <assessment_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `assessment_json` | 评估JSON文件路径，须含字段：`impact_scope`（低/中/高）、`failure_likelihood`（低/中/高）、`has_rollback`（bool）、`has_emergency`（bool） |
| `--json` | 显式声明 JSON 输出（默认即为 JSON，效果相同） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 评估成功（无论等级高低均返回 0） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 注意：脚本始终返回 0（除参数错误外），不依据风险等级返回不同退出码。CI 门禁须读取 `level` 字段判定是否阻断。

### 检查项
1. **JSON 加载**：读取 `assessment_json` 文件并解析为字典。文件不存在或 JSON 非法时返回 exit=3。
2. **影响面打分**：`impact_scope` 取值 `低=0 / 中=1 / 高=2`，缺省或无法识别时默认 1。
3. **失败概率打分**：`failure_likelihood` 取值 `低=0 / 中=1 / 高=2`，缺省或无法识别时默认 1。
4. **回滚扣分**：`has_rollback` 为 `False` 或缺省时 +1。
5. **应急扣分**：`has_emergency` 为 `False` 或缺省时 +1。
6. **等级判定**：`score ≤ 1 → 低`；`2 ≤ score ≤ 3 → 中`；`score ≥ 4 → 高`。

### 评分矩阵
| 字段 | 取值 | 得分 |
|------|------|------|
| `impact_scope` | 低 / 中 / 高 | 0 / 1 / 2 |
| `failure_likelihood` | 低 / 中 / 高 | 0 / 1 / 2 |
| `has_rollback` | True / False | 0 / +1 |
| `has_emergency` | True / False | 0 / +1 |

### 等级阈值
| 总分 | 等级 |
|------|------|
| 0–1 | 低 |
| 2–3 | 中 |
| ≥ 4 | 高 |

### JSON 输出示例
```json
{
  "score": 4,
  "level": "高",
  "suggested": "高"
}
```

低风险示例（`impact_scope=低, failure_likelihood=低, has_rollback=true, has_emergency=true`）：
```json
{
  "score": 0,
  "level": "低",
  "suggested": "低"
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
# 基本分级
python skills/change-risk-assessment/scripts/risk_classifier.py ./assessment.json

# JSON 输出（供 Agent 消费）
python skills/change-risk-assessment/scripts/risk_classifier.py ./assessment.json --json

# CI 门禁（依据 level 字段判定）
level=$(python skills/change-risk-assessment/scripts/risk_classifier.py ./assessment.json --json | python -c "import sys,json;print(json.load(sys.stdin)['level'])")
[ "$level" = "高" ] && echo "高风险变更，须升级L3" || echo "风险等级：$level"

# assessment.json 示例
# {
#   "impact_scope": "高",
#   "failure_likelihood": "中",
#   "has_rollback": true,
#   "has_emergency": false
# }
# → score = 2 + 1 + 0 + 1 = 4 → level = 高
```

### 能力边界
- 仅依据四个输入字段打分，不解析 RFC/影响分析文档内容（字段值须人工或上游脚本填充）
- 不引用历史同类变更事故率（L3 深度要求须人工补充）
- 不校验回滚演练证据、应急通讯录真实性（L3 深度要求须人工或额外脚本完成）
- 默认值策略：字段缺失时按"中"档（1 分）或扣分（+1）处理，可能低估风险
- 不输出调整理由字段，人工调整须在风险评估表中独立记录

### 单测对应
`tests/test_scripts.py` 中 `change-risk-assessment/risk_classifier.py` 条目（3 用例）：
- `high_risk`：`{impact_scope:高, failure_likelihood:高, has_rollback:true, has_emergency:true}` → exit=0，输出含 `level`（score=4, level=高）
- `low_risk`：`{impact_scope:低, failure_likelihood:低, has_rollback:true, has_emergency:true}` → exit=0，输出含 `level`（score=0, level=低）
- `missing_file`：文件不存在 → exit=3，输出含 `error`
