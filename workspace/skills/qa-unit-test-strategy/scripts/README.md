# scripts/ — 单测策略技能脚本

本目录包含 `qa-unit-test-strategy` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `coverage_review.py` | 覆盖率自动审核：总体覆盖率+关键路径覆盖率双重门禁 | 0/2/3 |
| `ut_quality_score.py` | 单测质量评分：按测试独立性/断言充分性/命名规范评分 | 0/2/3 |

---

## coverage_review.py

### 用途
对单元测试覆盖率进行双重门禁审核。输入覆盖率 JSON（含总体覆盖率与关键路径列表），校验总体覆盖率是否达标且关键路径覆盖率是否100%，输出审核结果与缺口清单。

### 接口
```
python coverage_review.py <coverage_json> [--overall_threshold 80.0] [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `coverage_json` | 覆盖率 JSON 文件路径，格式为 `{"overall": 85.5, "critical_paths": [{"name":"...", "coverage": 100}]}` |
| `--overall_threshold` | 总体覆盖率阈值，默认 80.0（百分比） |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 审核通过（总体覆盖率达标且关键路径100%） |
| 2 | 审核失败（总体覆盖率不达标或关键路径有缺口） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 退出码优先级：参数错误（3） > 审核失败（2） > 通过（0）。

### 检查项
1. **JSON 解析**：读取并解析覆盖率 JSON 文件，解析失败返回退出码 3。
2. **总体覆盖率校验**：overall 字段值 ≥ overall_threshold（默认80）则总体达标。
3. **关键路径覆盖率校验**：critical_paths 列表中每条路径的 coverage 字段须 = 100，否则记入缺口。
4. **双重门禁判定**：总体达标且无关键路径缺口 → 通过（exit=0）；否则 → 失败（exit=2）。
5. **缺口清单输出**：未达100%的关键路径列入 critical_gaps，指导补测。

### 输入 JSON 格式
```json
{
  "overall": 85.5,
  "critical_paths": [
    {"name": "转账服务-扣款逻辑", "coverage": 100},
    {"name": "账户服务-余额校验", "coverage": 90},
    {"name": "权限服务-越权检查", "coverage": 100}
  ]
}
```

### JSON 输出示例
```json
{
  "overall_ok": true,
  "critical_gaps": [
    {"name": "账户服务-余额校验", "coverage": 90}
  ],
  "pass": false
}
```

### 调用示例
```bash
# 基本审核（默认阈值80%）
python skills/qa-unit-test-strategy/scripts/coverage_review.py 覆盖率.json

# 自定义阈值
python skills/qa-unit-test-strategy/scripts/coverage_review.py 覆盖率.json --overall_threshold 90.0

# CI 门禁（退出码驱动，阻断提测）
python skills/qa-unit-test-strategy/scripts/coverage_review.py 覆盖率.json && echo "覆盖率审核通过" || echo "覆盖率审核失败，阻断提测"
```

### 能力边界
- 仅校验输入 JSON 中的覆盖率数据，不采集实际覆盖率（需由 JaCoCo/Istanbul/Coverage.py 等工具生成）。
- 关键路径覆盖率门禁固定为100%，不可配置（银行关键业务逻辑要求）。
- 不区分覆盖率类型（行/分支/MC/DC 统一按 overall 字段校验）。
- 不生成补测计划（缺口清单指导补测优先级，具体计划由人工制定）。

### 单测对应
`tests/test_scripts.py` 中 `qa-unit-test-strategy/coverage_review.py` 条目（3 用例）：
- `coverage_pass`：总体≥80且关键路径100% → exit=0，输出 `pass` 为 true
- `coverage_fail`：关键路径有缺口 → exit=2，输出 `critical_gaps` 非空
- `missing_file`：文件不存在 → exit=3，输出含 `error`

---

## ut_quality_score.py

### 用途
对单元测试质量进行评分。输入质量 JSON（含独立性/断言充分性/命名规范三项布尔指标），按权重计算质量评分（0-100），判定是否达标（≥80）。

### 接口
```
python ut_quality_score.py <quality_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `quality_json` | 质量 JSON 文件路径，格式为 `{"independent": true, "assertions_ok": true, "naming_ok": false}` |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 评分达标（score ≥ 80） |
| 2 | 评分不达标（score < 80） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

### 检查项
1. **JSON 解析**：读取并解析质量 JSON 文件，解析失败返回退出码 3。
2. **评分计算**：score = independent(40) + assertions_ok(40) + naming_ok(20)，各指标为布尔值（true=1, false=0）。
3. **达标判定**：score ≥ 80 则达标（exit=0），否则不达标（exit=2）。

### 评分权重
| 指标 | 权重 | 说明 |
|------|------|------|
| independent（测试独立性） | 40分 | UT用例无外部依赖（数据库/网络/文件系统） |
| assertions_ok（断言充分性） | 40分 | 每条UT用例有有效断言且覆盖预期结果 |
| naming_ok（命名规范） | 20分 | UT用例命名符合规范（方法名_场景_预期） |

### 输入 JSON 格式
```json
{
  "independent": true,
  "assertions_ok": true,
  "naming_ok": false
}
```

### JSON 输出示例
```json
{
  "score": 80,
  "pass": true
}
```

### 调用示例
```bash
# 基本评分
python skills/qa-unit-test-strategy/scripts/ut_quality_score.py 质量.json

# JSON 输出（供 Agent 消费）
python skills/qa-unit-test-strategy/scripts/ut_quality_score.py 质量.json --json

# CI 门禁（退出码驱动，阻断提测）
python skills/qa-unit-test-strategy/scripts/ut_quality_score.py 质量.json && echo "质量评分达标" || echo "质量评分不达标，阻断提测"
```

### 能力边界
- 评分基于三项布尔指标，指标判定需由人工或代码扫描工具完成（脚本不做代码扫描）。
- 评分权重固定（40/40/20），不支持外部配置调整。
- 不检测代码坏味道（重复/复杂度/魔法值等），仅做三项指标评分。
- 不生成改进建议（改进建议由 SKILL.md 工作流 Step 7 人工完成）。

### 单测对应
`tests/test_scripts.py` 中 `qa-unit-test-strategy/ut_quality_score.py` 条目（3 用例）：
- `quality_pass`：三项指标均达标 → exit=0，score=100
- `quality_fail`：naming_ok 为 false → exit=0 或 exit=2（取决于 score 是否≥80）
- `missing_file`：文件不存在 → exit=3，输出含 `error`
