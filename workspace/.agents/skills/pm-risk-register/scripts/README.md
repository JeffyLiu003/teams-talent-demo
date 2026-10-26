# scripts/ — 项目风险登记技能脚本

本目录包含 `pm-risk-register` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `risk_scorer.py` | 项目风险评分：概率×影响矩阵定级，输出风险等级（低/中/高） | 0/3 |

---

## risk_scorer.py

### 用途
对项目风险进行量化评分。读取风险 JSON（含 `probability`、`impact` 两个字段，取值低/中/高），按"概率×影响"矩阵计算得分并输出风险等级。Agent 可参考该等级，人工可调整但须记录理由。

### 接口
```
python risk_scorer.py <risk_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `risk_json` | 风险JSON文件路径，须含字段：`probability`（低/中/高）、`impact`（低/中/高） |
| `--json` | 显式声明 JSON 输出（默认即为 JSON，效果相同） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 评分成功（无论等级高低均返回 0） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 注意：脚本始终返回 0（除参数错误外），不依据风险等级返回不同退出码。CI 门禁须读取 `level` 字段判定是否阻断。

### 检查项
1. **JSON 加载**：读取 `risk_json` 文件并解析为字典。文件不存在或 JSON 非法时返回 exit=3。
2. **概率取值**：`probability` 取值 `低=1 / 中=2 / 高=3`，缺省或无法识别时默认 2。
3. **影响取值**：`impact` 取值 `低=1 / 中=2 / 高=3`，缺省或无法识别时默认 2。
4. **得分计算**：`score = probability_level × impact_level`。
5. **等级判定**：`score ≤ 2 → 低`；`3 ≤ score ≤ 5 → 中`；`score ≥ 6 → 高`。

### 评分矩阵
| 概率 \ 影响 | 低 (1) | 中 (2) | 高 (3) |
|------------|--------|--------|--------|
| 低 (1) | 1（低） | 2（低） | 3（中） |
| 中 (2) | 2（低） | 4（中） | 6（高） |
| 高 (3) | 3（中） | 6（高） | 9（高） |

### 等级阈值
| 总分 | 等级 |
|------|------|
| 1–2 | 低 |
| 3–5 | 中 |
| ≥ 6 | 高 |

### JSON 输出示例
高风险示例（`probability=高, impact=高`）：
```json
{
  "score": 9,
  "level": "高"
}
```

低风险示例（`probability=低, impact=低`）：
```json
{
  "score": 1,
  "level": "低"
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
# 基本评分
python skills/pm-risk-register/scripts/risk_scorer.py ./risk.json

# JSON 输出（供 Agent 消费）
python skills/pm-risk-register/scripts/risk_scorer.py ./risk.json --json

# CI 门禁（依据 level 字段判定）
level=$(python skills/pm-risk-register/scripts/risk_scorer.py ./risk.json --json | python -c "import sys,json;print(json.load(sys.stdin)['level'])")
[ "$level" = "高" ] && echo "高风险，须升级路径" || echo "风险等级：$level"

# risk.json 示例
# {
#   "probability": "高",
#   "impact": "中"
# }
# → score = 3 × 2 = 6 → level = 高
```

### 能力边界
- 仅依据概率×影响两个字段评分，不解析风险描述文本（字段值须人工或上游脚本填充）
- 不引用历史同类项目风险事故率（L3 深度要求须人工补充）
- 不输出应对策略、升级路径、责任人等字段（须在风险登记册模板中独立维护）
- 默认值策略：字段缺失时按"中"档（2 分）处理，可能低估或高估风险
- 与 `change-risk-assessment/risk_classifier.py` 不同：本脚本用于项目风险（概率×影响），后者用于变更风险（影响面+失败概率+回滚+应急）

### 单测对应
`tests/test_scripts.py` 中 `pm-risk-register/risk_scorer.py` 条目（3 用例）：
- `high_score`：`{probability:高, impact:高}` → exit=0，输出含 `level`（score=9, level=高）
- `low_score`：`{probability:低, impact:低}` → exit=0，输出含 `level`（score=1, level=低）
- `missing_file`：文件不存在 → exit=3，输出含 `error`
