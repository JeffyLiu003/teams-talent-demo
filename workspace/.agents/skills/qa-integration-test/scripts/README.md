# scripts/ — 集成测试技能脚本

本目录包含 `qa-integration-test` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `interface_contract_test.py` | 接口契约自动化测试：比对契约字段与接口响应样例，检测 missing 字段 | 0/2/3 |
| `data_flow_verify.py` | 端到端数据一致性校验：比对各系统数据导出的关键字段 key 集合 | 0/2/3 |

---

## interface_contract_test.py

### 用途
对接口契约进行自动化测试。比对契约 JSON 中定义的接口字段与响应样例 JSON 中的实际字段，检测 missing 字段（契约定义但响应中缺失），输出每个接口的校验结果与整体通过率。

### 接口
```
python interface_contract_test.py <contract_json> <responses_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `contract_json` | 契约 JSON 文件路径，格式为 `{"interfaces": [{"name": "...", "fields": ["f1", "f2"]}]}` |
| `responses_json` | 响应 JSON 文件路径，格式为 `[{"name": "...", "response": {"f1": "v1"}}]` |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 全部接口契约通过（无 missing 字段） |
| 2 | 契约校验失败（有接口存在 missing 字段） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 退出码优先级：参数错误（3） > 契约失败（2） > 通过（0）。

### 检查项
1. **JSON 解析**：读取并解析契约 JSON 与响应 JSON 文件，解析失败返回退出码 3。
2. **接口匹配**：按 name 字段匹配契约接口与响应样例。
3. **字段校验**：对每个接口，检查契约定义的 fields 是否全部存在于响应中，缺失字段记入 missing。
4. **通过率计算**：pass_rate = 通过接口数 / 总接口数。
5. **门禁判定**：所有接口无 missing → 通过（exit=0）；否则 → 失败（exit=2）。

### 输入 JSON 格式
契约 JSON：
```json
{
  "interfaces": [
    {"name": "transferService", "fields": ["txnId", "amount", "status", "timestamp"]},
    {"name": "accountService", "fields": ["accountId", "balance", "currency"]}
  ]
}
```

响应 JSON：
```json
[
  {"name": "transferService", "response": {"txnId": "T001", "amount": 100, "status": "SUCCESS"}},
  {"name": "accountService", "response": {"accountId": "A001", "balance": 5000, "currency": "CNY"}}
]
```

### JSON 输出示例
```json
{
  "results": [
    {"name": "transferService", "missing": ["timestamp"], "pass": false},
    {"name": "accountService", "missing": [], "pass": true}
  ],
  "pass_rate": 0.5
}
```

### 调用示例
```bash
# 基本契约测试
python skills/qa-integration-test/scripts/interface_contract_test.py 契约.json 响应.json

# JSON 输出（供 Agent 消费）
python skills/qa-integration-test/scripts/interface_contract_test.py 契约.json 响应.json --json

# CI 门禁（退出码驱动，契约全通过才放行）
python skills/qa-integration-test/scripts/interface_contract_test.py 契约.json 响应.json && echo "契约测试通过" || echo "契约测试失败"
```

### 能力边界
- 仅校验字段存在性，不校验字段类型与取值范围（需由接口测试工具如 Postman/JMeter 完成）。
- 按 name 字段匹配接口，name 须在契约与响应中一致。
- 不校验请求字段（仅校验响应字段）。
- 不校验错误码与超时（需由接口测试用例覆盖）。

### 单测对应
`tests/test_scripts.py` 中 `qa-integration-test/interface_contract_test.py` 条目（3 用例）：
- `contract_pass`：响应字段全覆盖契约 → exit=0，pass_rate=1.0
- `contract_fail`：响应缺字段 → exit=2，missing 非空
- `missing_file`：文件不存在 → exit=3，输出含 `error`

---

## data_flow_verify.py

### 用途
对端到端数据流进行一致性校验。输入各系统数据导出 JSON，比对各系统关键字段 key 集合是否一致，检测跨系统数据不一致的字段，用于数据流一致性门禁。

### 接口
```
python data_flow_verify.py <systems_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `systems_json` | 系统数据 JSON 文件路径，格式为 `{"systemA": [{"key": "k1", "value": "v1"}], "systemB": [{"key": "k1", "value": "v2"}]}` |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 数据流一致（各系统 key 集合相同） |
| 2 | 数据流不一致（有系统 key 集合不同） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 退出码优先级：参数错误（3） > 不一致（2） > 一致（0）。

### 检查项
1. **JSON 解析**：读取并解析系统数据 JSON 文件，解析失败返回退出码 3。
2. **key 集合提取**：对每个系统，提取所有记录的 key 字段，去重排序形成 key 集合。
3. **一致性比对**：以第一个系统的 key 集合为基准，比对其他系统的 key 集合是否一致。
4. **差异输出**：不一致的系统记入 inconsistent，输出差异字段（对称差集，最多20个）。
5. **门禁判定**：所有系统 key 集合一致 → 通过（exit=0）；否则 → 失败（exit=2）。

### 输入 JSON 格式
```json
{
  "transferSystem": [
    {"key": "txnId", "value": "T001"},
    {"key": "amount", "value": "100"},
    {"key": "status", "value": "SUCCESS"}
  ],
  "accountSystem": [
    {"key": "txnId", "value": "T001"},
    {"key": "amount", "value": "100"}
  ]
}
```

### JSON 输出示例
```json
{
  "systems": 2,
  "inconsistent": [
    {"system_index": 1, "diff": ["status"]}
  ],
  "consistent": false
}
```

### 调用示例
```bash
# 基本数据流校验
python skills/qa-integration-test/scripts/data_flow_verify.py 系统数据.json

# JSON 输出（供 Agent 消费）
python skills/qa-integration-test/scripts/data_flow_verify.py 系统数据.json --json

# CI 门禁（退出码驱动，数据一致才放行）
python skills/qa-integration-test/scripts/data_flow_verify.py 系统数据.json && echo "数据流一致" || echo "数据流不一致"
```

### 能力边界
- 仅校验 key 集合一致性，不校验 value 值一致性（需由数据比对工具完成）。
- 以第一个系统为基准，其他系统与之比对（基准系统选择影响结果）。
- 差异字段最多输出20个（避免输出过大）。
- 不校验数据时效性与顺序（仅校验 key 存在性）。

### 单测对应
`tests/test_scripts.py` 中 `qa-integration-test/data_flow_verify.py` 条目（3 用例）：
- `data_consistent`：各系统 key 集合相同 → exit=0，consistent=true
- `data_inconsistent`：系统间 key 集合不同 → exit=2，inconsistent 非空
- `missing_file`：文件不存在 → exit=3，输出含 `error`
