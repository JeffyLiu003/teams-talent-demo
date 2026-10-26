# scripts/ — 回归选择技能脚本

本目录包含 `qa-regression-selection` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `impact_analyzer.py` | 回归影响分析：输入变更文件清单，匹配模块映射，输出受影响模块 | 0/3 |
| `testcase_selector.py` | 回归用例选择：按影响模块与风险等级输出用例清单 | 0/3 |

---

## impact_analyzer.py

### 用途
对代码变更进行影响分析。输入变更文件清单与模块映射（模块名→关键词列表），通过文件路径关键词匹配输出受影响模块清单，用于回归范围选择。

### 接口
```
python impact_analyzer.py <change_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `change_json` | 变更 JSON 文件路径，格式为 `{"files": ["path/to/file"], "module_map": {"模块名": ["关键词"]}}` |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 分析成功（输出受影响模块清单，无论是否为空） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 注：本脚本只做影响分析，不判定回归范围是否充分。退出码 0 表示分析完成，不代表回归范围已确定。

### 检查项
1. **JSON 解析**：读取并解析变更 JSON 文件，解析失败返回退出码 3。
2. **文件遍历**：遍历 files 列表中的每个变更文件路径。
3. **模块匹配**：对每个文件路径，检查是否包含 module_map 中各模块的关键词，匹配则记入受影响模块。
4. **去重排序**：受影响模块去重并排序输出。

### 输入 JSON 格式
```json
{
  "files": [
    "src/transfer/service/TransferService.java",
    "src/account/service/AccountService.java",
    "src/common/util/DateUtil.java"
  ],
  "module_map": {
    "转账模块": ["transfer"],
    "账户模块": ["account"],
    "公共模块": ["common"]
  }
}
```

### JSON 输出示例
```json
{
  "affected_modules": ["转账模块", "账户模块", "公共模块"]
}
```

### 调用示例
```bash
# 基本影响分析
python skills/qa-regression-selection/scripts/impact_analyzer.py 变更.json

# JSON 输出（供 Agent 消费）
python skills/qa-regression-selection/scripts/impact_analyzer.py 变更.json --json

# CI 门禁（退出码驱动，分析成功才继续）
python skills/qa-regression-selection/scripts/impact_analyzer.py 变更.json && echo "影响分析完成" || echo "影响分析失败"
```

### 能力边界
- 仅做文件路径关键词匹配，不做代码语义分析（如方法调用链、依赖图）。
- 模块映射需人工维护（关键词列表需覆盖模块所有可能路径）。
- 不区分变更类型（新增/修改/删除统一匹配）。
- 不输出影响程度（仅输出受影响模块清单，不区分强/弱影响）。

### 单测对应
`tests/test_scripts.py` 中 `qa-regression-selection/impact_analyzer.py` 条目（3 用例）：
- `affected_modules`：变更文件匹配到多个模块 → exit=0，affected_modules 非空
- `no_affected`：变更文件未匹配到任何模块 → exit=0，affected_modules 为空
- `missing_file`：文件不存在 → exit=3，输出含 `error`

---

## testcase_selector.py

### 用途
根据影响模块与风险等级选择回归用例。输入选择 JSON（含风险等级、受影响模块、模块↔用例映射），输出选定用例清单。高风险时自动选择全量用例。

### 接口
```
python testcase_selector.py <selector_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `selector_json` | 选择 JSON 文件路径，格式为 `{"risk_level": "高", "affected_modules": ["模块A"], "cases": {"模块A": ["TC-001"]}}` |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 选择成功（输出选定用例清单） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 注：本脚本只做用例选择，不判定用例是否充分。退出码 0 表示选择完成，不代表回归范围已确定。

### 检查项
1. **JSON 解析**：读取并解析选择 JSON 文件，解析失败返回退出码 3。
2. **模块用例选择**：遍历 affected_modules，从 cases 映射中取各模块用例。
3. **高风险全量扩展**：risk_level 为"高"时，追加 cases 中所有模块的用例（全量回归）。
4. **去重排序**：选定用例去重并排序输出。

### 风险等级规则
| 风险等级 | 用例选择策略 |
|---------|------------|
| 高 | 受影响模块用例 + 全量用例（全量回归 + 专项测试） |
| 中 | 受影响模块用例（相关模块全量 + 核心冒烟） |
| 低 | 受影响模块用例（相关功能点 + 冒烟） |

### 输入 JSON 格式
```json
{
  "risk_level": "高",
  "affected_modules": ["转账模块", "账户模块"],
  "cases": {
    "转账模块": ["TC-001", "TC-002"],
    "账户模块": ["TC-003"],
    "公共模块": ["TC-004", "TC-005"]
  }
}
```

### JSON 输出示例
```json
{
  "risk_level": "高",
  "selected": ["TC-001", "TC-002", "TC-003", "TC-004", "TC-005"],
  "count": 5
}
```

### 调用示例
```bash
# 基本用例选择
python skills/qa-regression-selection/scripts/testcase_selector.py 选择.json

# JSON 输出（供 Agent 消费）
python skills/qa-regression-selection/scripts/testcase_selector.py 选择.json --json

# CI 门禁（退出码驱动，选择成功才继续）
python skills/qa-regression-selection/scripts/testcase_selector.py 选择.json && echo "用例选择完成" || echo "用例选择失败"
```

### 能力边界
- 仅按模块↔用例映射选择，不做用例优先级排序（P0/P1/P2 需人工排序）。
- 高风险全量扩展策略固定（追加 cases 中所有模块用例），不支持自定义扩展规则。
- 不校验用例有效性（选定用例是否存在需由用例管理系统确认）。
- 不生成回归执行计划（仅输出用例清单，执行计划由人工制定）。

### 单测对应
`tests/test_scripts.py` 中 `qa-regression-selection/testcase_selector.py` 条目（3 用例）：
- `high_risk_full_selection`：高风险选择全量用例 → exit=0，selected 含所有模块用例
- `low_risk_partial_selection`：低风险仅选受影响模块用例 → exit=0，selected 仅含受影响模块用例
- `missing_file`：文件不存在 → exit=3，输出含 `error`
