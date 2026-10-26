# scripts/ — SoD 合规检查技能脚本

本目录包含 `sod-compliance-check` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `sod_check.py` | SoD 冲突自动检测（角色权限互斥对扫描） | 0/2/3 |

---

## sod_check.py

### 用途

输入角色权限配置与 SoD 冲突矩阵，对每个角色检查其权限集是否同时包含互斥权限对，输出冲突清单与合规结论。用于门禁评审、配置变更、审计抽检等场景，确保职责分离（执行/审批/复核/审计四眼原则）在全流程执行。

### 接口
```
python sod_check.py <config_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `config_json` | 配置 JSON 文件路径。结构：`{roles: {role: [permissions]}, conflicts: [[permA, permB]]}` |
| `--json` | 输出 JSON 格式（为接口一致性保留；脚本默认即输出 JSON，加不加该参数输出一致） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 通过（无冲突，所有角色权限集均未命中互斥对） |
| 2 | 失败（检出冲突，存在角色同时持有互斥权限对） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 退出码优先级：冲突检出（2） > 通过（0）。文件读取或 JSON 解析异常返回 3。无中间告警态（1 未使用）。

### 检查项
1. **直接冲突检测**：遍历每个角色的权限集，与冲突矩阵中的互斥权限对逐一比对。若角色同时持有冲突对的两个权限，记为一条冲突。
2. **合规判定**：`conflicts` 为空则 `compliant=true`（退出码 0）；非空则 `compliant=false`（退出码 2）。

### 配置 JSON 格式

```json
{
  "roles": {
    "dev": ["编码", "单元测试", "代码评审"],
    "approver": ["代码评审", "批准MR"],
    "release": ["变更申请", "生产发布"],
    "ops": ["参数配置", "生产发布"],
    "audit": ["审计读取", "数据导出"]
  },
  "conflicts": [
    ["编码", "代码评审"],
    ["编码", "批准MR"],
    ["测试", "缺陷修复"],
    ["变更申请", "生产发布"],
    ["参数配置", "参数审批"],
    ["安全放行", "漏洞修复"],
    ["审计读取", "数据修改"]
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `roles` | object | 角色→权限列表映射。键为角色名，值为该角色持有的权限名数组 |
| `conflicts` | array | 互斥权限对列表。每个元素为 `[权限A, 权限B]` 二元数组，表示二者不可由同一角色同时持有 |

### JSON 输出示例

**检出冲突（exit=2）：**
```json
{
  "conflicts": [
    {"role": "dev", "pair": ["编码", "代码评审"]}
  ],
  "compliant": false
}
```

**合规通过（exit=0）：**
```json
{
  "conflicts": [],
  "compliant": true
}
```

**参数错误（exit=3）：**
```json
{
  "error": "[Errno 2] No such file or directory: 'nope.json'"
}
```

### 调用示例
```bash
# 基本检测（人类可读 JSON）
python skills/sod-compliance-check/scripts/sod_check.py config.json

# JSON 输出（供 Agent 消费）
python skills/sod-compliance-check/scripts/sod_check.py config.json --json

# 管道消费（退出码驱动 CI 门禁）
python skills/sod-compliance-check/scripts/sod_check.py config.json && echo "SoD合规通过" || echo "存在SoD冲突，请检查"

# 配合 jq 提取冲突角色
python skills/sod-compliance-check/scripts/sod_check.py config.json | jq -r '.conflicts[].role'
```

### 能力边界与 L3 期望能力

当前脚本仅支持**单角色直接冲突检测**：检查同一角色内是否同时持有互斥权限对。

**尚未实现（L3 期望能力）：**

| 能力 | 说明 | L3 用途 |
|------|------|---------|
| 用户多角色累积冲突 | 用户持有多个角色时，合并权限集后检测冲突（单角色合规但组合违规） | 间接冲突检测 |
| 权限依赖传递闭包 | 权限间存在依赖关系（持有 X 隐含 Y）时，扩展权限集后检测 | 间接冲突检测 |
| 冲突关系传递闭包 | 冲突图 G 的 Floyd-Warshall 闭包，发现 N 跳间接冲突 | 间接冲突路径 |
| 门禁执行人/审批人校验 | 检查 gates 配置中 executor≠approver | 四眼原则 |
| 严重度分级 | 按资金/监管/流程/审计分级（高/中/低） | 处置建议 |
| 处置建议生成 | 从冲突矩阵查表输出动作/责任人/时效 | 整改驱动 |

> L3 场景的间接冲突（传递闭包）需按 `SKILL.md` 中「L3 工作流补充」的算法人工计算或扩展工具支持，结果填入 `templates/sod-compliance-report.md` 的【L3必填】字段。脚本接口保持不变，后续扩展应以可选参数（如 `--user-roles`、`--transitive`）增量提供，不破坏现有退出码与输出契约。

### 单测对应
`tests/test_scripts.py` 中 `sod-compliance-check/sod_check.py` 条目（3 用例）：
- `conflict`：角色同时持有"编码"+"代码评审" → exit=2，输出含 `conflicts`
- `compliant`：角色仅持有"编码" → exit=0，输出含 `compliant`
- `missing_file`：文件不存在 → exit=3，输出含 `error`
