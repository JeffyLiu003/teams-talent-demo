# scripts/ — 系统测试设计技能脚本

本目录包含 `qa-system-test-design` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `req_coverage_check.py` | 需求覆盖率计算：比对需求文档REQ与用例集中的REQ引用，输出覆盖率与未覆盖清单 | 0/2/3 |
| `testcase_dedup.py` | 用例去重检测：基于标题+步骤哈希检测重复用例 | 0/1/3 |

---

## req_coverage_check.py

### 用途
计算系统测试用例对需求的覆盖率。比对需求文档中的 REQ 编号与用例文档中引用的 REQ 编号，输出覆盖率、已覆盖数、未覆盖清单（missing），用于 ST 用例需求覆盖门禁。

### 接口
```
python req_coverage_check.py <req_doc> <testcase_doc> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `req_doc` | 需求文档路径（.md），须含 `REQ-xxx` 格式的需求编号 |
| `testcase_doc` | 用例文档路径（.md），须含 `REQ-xxx` 格式的需求引用 |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 覆盖率100%（无 missing 需求） |
| 2 | 覆盖率未达100%（有 missing 需求） |
| 3 | 参数错误（文件不存在） |

> 退出码优先级：参数错误（3） > 覆盖不全（2） > 通过（0）。

### 检查项
1. **REQ 编号提取-需求文档**：从需求文档中提取所有 `REQ-\d{3}`（三位数字）编号，去重排序。
2. **REQ 编号提取-用例文档**：从用例文档中提取所有 `REQ-\d{3}` 编号，去重排序。
3. **覆盖率计算**：rate = 用例文档中匹配到的 REQ 数 / 需求文档中 REQ 总数。
4. **未覆盖清单**：需求文档中未被任何用例引用的 REQ 编号列入 missing。
5. **门禁判定**：missing 为空 → 通过（exit=0）；否则 → 失败（exit=2）。

### REQ 编号格式
- 匹配模式：`REQ-\d{3}`（如 REQ-001、REQ-002）
- 不匹配：REQ-2026-001（避免误匹配文档编号）

### 输入文件格式
需求文档（.md）与用例文档（.md）均为 Markdown 文本，脚本通过正则提取 REQ 编号。

### JSON 输出示例
```json
{
  "total": 5,
  "covered": 4,
  "rate": 0.8,
  "missing": ["REQ-003"]
}
```

### 调用示例
```bash
# 基本校验
python skills/qa-system-test-design/scripts/req_coverage_check.py 需求文档.md 用例文档.md

# JSON 输出（供 Agent 消费）
python skills/qa-system-test-design/scripts/req_coverage_check.py 需求文档.md 用例文档.md --json

# CI 门禁（退出码驱动，覆盖率100%才通过）
python skills/qa-system-test-design/scripts/req_coverage_check.py 需求文档.md 用例文档.md && echo "需求覆盖率100%" || echo "需求覆盖率未达标"
```

### 能力边界
- 仅校验 REQ 编号引用，不校验用例内容与需求语义一致性（需人工评审）。
- REQ 编号格式固定为三位数字（REQ-001），不支持其他格式。
- 不区分用例类型（正常/边界/异常统一按 REQ 引用统计覆盖率）。
- 不生成补测计划（missing 清单指导补测，具体计划由人工制定）。

### 单测对应
`tests/test_scripts.py` 中 `qa-system-test-design/req_coverage_check.py` 条目（3 用例）：
- `coverage_pass`：用例覆盖全部REQ → exit=0，missing 为空
- `coverage_fail`：用例未覆盖部分REQ → exit=2，missing 非空
- `missing_file`：文件不存在 → exit=3，输出含 `error`

---

## testcase_dedup.py

### 用途
检测系统测试用例中的重复用例。基于用例标题+步骤的 MD5 哈希值检测完全相同的重复用例，输出重复清单与数量，用于用例去重门禁。

### 接口
```
python testcase_dedup.py <cases_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `cases_json` | 用例 JSON 文件路径，格式为 `[{"id":"TC-001", "title":"...", "steps":["步骤1","步骤2"]}]` |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 无重复用例 |
| 1 | 有重复用例（警告，不阻断） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 退出码优先级：参数错误（3） > 有重复（1） > 无重复（0）。退出码 1 为警告级别，不强制阻断。

### 检查项
1. **JSON 解析**：读取并解析用例 JSON 文件，解析失败返回退出码 3。
2. **哈希计算**：对每条用例计算 `title + "|" + steps` 的 MD5 哈希值作为唯一键。
3. **重复检测**：相同哈希值的用例标记为重复，记录重复用例ID与被重复用例ID。
4. **门禁判定**：无重复 → 通过（exit=0）；有重复 → 警告（exit=1）。

### 输入 JSON 格式
```json
[
  {"id": "TC-001", "title": "正常转账", "steps": ["登录", "输入金额", "确认转账"]},
  {"id": "TC-002", "title": "正常转账", "steps": ["登录", "输入金额", "确认转账"]},
  {"id": "TC-003", "title": "超额转账", "steps": ["登录", "输入超额金额", "确认转账"]}
]
```

### JSON 输出示例
```json
{
  "duplicates": [
    {"id": "TC-002", "duplicate_of": "TC-001"}
  ],
  "count": 1
}
```

### 调用示例
```bash
# 基本检测
python skills/qa-system-test-design/scripts/testcase_dedup.py 用例.json

# JSON 输出（供 Agent 消费）
python skills/qa-system-test-design/scripts/testcase_dedup.py 用例.json --json

# CI 门禁（退出码驱动，无重复才通过）
python skills/qa-system-test-design/scripts/testcase_dedup.py 用例.json && echo "无重复用例" || echo "检测到重复用例"
```

### 能力边界
- 仅检测标题+步骤完全相同的用例（MD5 哈希），不检测语义相似（如"正常转账"与"标准转账"）。
- 哈希键仅含 title 与 steps，不含预期结果与测试数据（相同步骤不同数据不会被标记为重复）。
- 退出码 1 为警告级别，不强制阻断（可根据项目策略决定是否阻断）。
- 不自动合并或删除重复用例（仅输出清单，由人工处理）。

### 单测对应
`tests/test_scripts.py` 中 `qa-system-test-design/testcase_dedup.py` 条目（3 用例）：
- `no_duplicates`：用例无重复 → exit=0，count=0
- `has_duplicates`：用例有重复 → exit=1，count>0
- `missing_file`：文件不存在 → exit=3，输出含 `error`
