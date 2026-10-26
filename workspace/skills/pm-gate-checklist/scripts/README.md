# scripts/ — PM 门禁检查清单技能脚本

本目录包含 `pm-gate-checklist` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `gate_collect.py` | 从状态 JSON 汇总 G1–G8 门禁状态，输出通过/缺失清单 | 0/2/3 |

---

## gate_collect.py

### 用途

读取本地门禁状态 JSON（生产环境对应从 ALM/CI/ITSM 三源对齐后落地的快照），按"通过/PASS 视为通过，其他均为缺失"的口径汇总门禁状态，输出 `{gates, missing, all_passed}` 结构化报告。

> 本脚本模拟"从 ALM/CI/ITSM 自动采集门禁状态"的能力：在银行生产环境，状态 JSON 应由集成层从 ALM（需求/缺陷/测试用例）、CI（构建/扫描/MR）、ITSM（变更/发布/工单）三源拉取并对齐后落地为本地 JSON；本脚本只负责消费该 JSON 做汇总判定，不直接调用上游 API。

### 接口
```
python gate_collect.py <status_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `status_json` | 门禁状态 JSON 文件路径，格式 `{G1:{status, approver, ...}, G2:{...}, ...}` |
| `--json` | 接口兼容参数（脚本默认即输出 JSON，行为相同） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 全部门禁通过（missing 为空） |
| 2 | 存在未通过门禁（missing 非空） |
| 3 | 参数错误（文件不存在或 JSON 解析失败） |

### 输入 JSON 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `G1`–`G8` | object | 是 | 各阶段门禁对象，键名即门禁编号 |
| `G*.status` | string | 是 | 门禁状态，`通过` 或 `PASS` 视为通过，其他值（待评审/缺失/待办等）均视为缺失 |
| `G*.approver` | string | 否 | 审批人（L3 留痕字段，脚本不强制） |
| `G*.evidence_url` | string | 否 | 证据链接（L3 留痕字段，脚本不强制） |
| `G*.collected_from` | string | 否 | 采集来源（ALM/CI/ITSM，L3 字段） |

> 脚本仅消费 `status` 字段做通过/缺失判定；其他字段（approver/evidence_url/collected_from）会原样回显在 `gates` 输出中，便于 Agent 或下游消费者读取。

### 输出 JSON 结构
```json
{
  "gates": { ... 原样回显输入的门禁对象 ... },
  "missing": ["G2", "G4"],
  "all_passed": false
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `gates` | object | 原样回显输入 JSON 的门禁对象 |
| `missing` | array[string] | 未通过的门禁编号列表（status 既不是"通过"也不是"PASS"的项） |
| `all_passed` | bool | `missing` 为空时为 true，否则 false |

### 判定逻辑

1. 解析输入 JSON，遍历每个门禁键（不限于 G1–G8，按实际键集合遍历）
2. 读取 `status` 字段，与 `通过` / `PASS` 比对：
   - 匹配 → 视为通过
   - 不匹配 / 缺失 → 视为缺失，加入 `missing` 列表
3. 输出汇总 JSON，按 `missing` 是否为空决定退出码（0 或 2）

### JSON 输出示例

全部通过：
```json
{
  "gates": {
    "G1": {"status": "通过", "approver": "业务负责人"},
    "G2": {"status": "通过", "approver": "ARB"},
    "G3": {"status": "PASS"}
  },
  "missing": [],
  "all_passed": true
}
```

存在未通过门禁：
```json
{
  "gates": {
    "G1": {"status": "通过"},
    "G2": {"status": "待评审", "approver": "ARB"},
    "G3": {"status": "PASS"},
    "G4": {"status": "缺失"}
  },
  "missing": ["G2", "G4"],
  "all_passed": false
}
```

参数错误（文件不存在或 JSON 解析失败）：
```json
{"error": "无法解析的 JSON: ..."}
```

### 调用示例

```bash
# 基本检查（默认输出 JSON）
python skills/pm-gate-checklist/scripts/gate_collect.py gate-status.json

# 显式指定 --json（行为与默认相同，接口兼容）
python skills/pm-gate-checklist/scripts/gate_collect.py gate-status.json --json > gate-report.json

# 在 CI 流水线中根据退出码做门禁阻断
python skills/pm-gate-checklist/scripts/gate_collect.py gate-status.json --json
if [ $? -ne 0 ]; then
  echo "门禁未通过，阻断流水线"
  exit 1
fi
```

### 输入 JSON 编写示例

最小通过示例：
```json
{
  "G1": {"status": "通过"},
  "G2": {"status": "PASS"}
}
```

L3 完整字段示例（脚本会原样回显附加字段）：
```json
{
  "G1": {
    "status": "通过",
    "approver": "张三",
    "evidence_url": "https://alm.example.com/req/REQ-001",
    "collected_from": "ALM",
    "collected_at": "2026-08-11T10:00:00+08:00"
  },
  "G2": {
    "status": "待评审",
    "approver": "ARB",
    "evidence_url": "https://alm.example.com/design/ADR-001",
    "collected_from": "ALM"
  }
}
```

### 单测对应

`tests/test_scripts.py` 中 `pm-gate-checklist/gate_collect.py` 条目（3 用例）：
- `all_passed`：G1/G2 均为"通过" → exit=0，输出含 `all_passed`
- `open_gate`：G1 通过、G2 待评审 → exit=2，输出含 `missing`
- `missing_file`：文件不存在 → exit=3，输出含 `error`

### 注意事项

- **本脚本不直接调用 ALM/CI/ITSM API**：所有上游采集逻辑应在集成层完成，落地为本地 JSON 后由本脚本消费。这样设计是为了：
  - 在受限网络环境（无外网）也能本地校验
  - 便于离线重放与单测覆盖
  - 上游 API 变更不影响本脚本稳定性
- **状态值口径**：`通过` 与 `PASS` 双语兼容，其他状态（待评审/缺失/待办/不适用）均视为缺失并加入 `missing`；如需区分"缺失"与"待办"，由下游消费者读取 `gates` 原始 `status` 字段自行处理。
- **门禁编号不强制为 G1–G8**：脚本按 JSON 实际键集合遍历，可扩展支持 G9+ 等自定义门禁。
