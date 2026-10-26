# scripts/ — 环境管理技能脚本

本目录包含 `release-environment-mgmt` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `env_diff.py` | 多环境配置对比：输入多套环境的配置键值，输出差异项与漂移结论 | 0/1/3 |

---

## env_diff.py

### 用途
读取多套环境（如 DEV/SIT/UAT/PROD/DR）的配置 JSON，按配置键逐项对比，输出存在差异的键及各环境的取值，并给出漂移结论。是环境一致性检查与配置漂移检测的确定性工具。

### 接口
```
python env_diff.py <config_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `config_json` | 配置 JSON 路径，结构为 `{env:{key:value}}`，如 `{"SIT":{"a":1}, "UAT":{"a":2}}` |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 无漂移（所有环境配置一致，drift=false） |
| 1 | 检测到漂移（存在差异项，drift=true） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 退出码说明：本脚本对漂移使用退出码 1（警告级），而非 2（失败级）；漂移项需人工评估是否为预期差异，不直接阻断流程。

### 检查项
1. **JSON 解析**：读取配置文件，解析失败返回退出码 3。
2. **键集合并集**：汇总所有环境出现的配置键，按字母排序。
3. **逐键对比**：对每个键，收集各环境的取值；若取值集合（字符串化后）元素数 >1，则标记为差异项。
4. **漂移结论**：`diffs` 列表非空 → `drift=true`（退出码 1）；为空 → `drift=false`（退出码 0）。

### 输入 JSON 示例
```json
{
  "SIT": {"db_pool_size": 50, "log_level": "INFO", "timeout_ms": 3000},
  "UAT": {"db_pool_size": 50, "log_level": "DEBUG", "timeout_ms": 5000},
  "PROD": {"db_pool_size": 100, "log_level": "WARN", "timeout_ms": 3000}
}
```

### JSON 输出示例
```json
{
  "diffs": [
    {"key": "db_pool_size", "values": {"SIT": 50, "UAT": 50, "PROD": 100}},
    {"key": "log_level", "values": {"SIT": "INFO", "UAT": "DEBUG", "PROD": "WARN"}},
    {"key": "timeout_ms", "values": {"SIT": 3000, "UAT": 5000, "PROD": 3000}}
  ],
  "drift": true
}
```

### 调用示例
```bash
# 基本对比（人类可读 JSON）
python skills/release-environment-mgmt/scripts/env_diff.py env-config.json

# JSON 输出（供 Agent 消费）
python skills/release-environment-mgmt/scripts/env_diff.py env-config.json --json

# CI 门禁（检测漂移并告警，不阻断流程）
python skills/release-environment-mgmt/scripts/env_diff.py env-config.json && echo "无配置漂移" || echo "检测到配置漂移，请评估"
```

### 能力边界
- 仅做键值层面的浅对比，不递归比较嵌套对象（嵌套对象以整体字符串化后比较）。
- 取值为 `None`（键缺失）与具体值视为差异，但不在输出中标注"缺失"原因。
- 不区差异是"预期差异"（如生产环境增大连接池）还是"非预期漂移"，需人工评估。
- 不支持配置项的语义校验（如值域、单位、合规性）。
- 不调用环境管理 API 或配置中心，仅消费已导出的 JSON 文件。
- 退出码 1（漂移）不阻断 CI 流程，由下游人工或脚本决定是否放行。

### 单测对应
`tests/test_scripts.py` 中 `release-environment-mgmt/env_diff.py` 条目（3 用例）：
- `same_config`：SIT 与 UAT 配置相同 → exit=0，输出含 `drift`
- `drift_detected`：SIT `a=1`，UAT `a=2` → exit=1，输出含 `drift`
- `missing_file`：文件不存在 → exit=3，输出含 `error`
