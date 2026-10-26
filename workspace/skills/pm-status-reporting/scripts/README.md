# scripts/ — 项目状态报告技能脚本

本目录包含 `pm-status-reporting` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `status_aggregator.py` | 状态汇总：输入计划/实际数据，逐项计算偏差（delta）并统计偏差项数量 | 0/3 |

---

## status_aggregator.py

### 用途
对项目状态数据进行多源汇总与偏差计算。读取数据 JSON（含 `items` 列表，每项含 `name`、`planned`、`actual`），逐项计算 `delta = actual - planned`，并标记是否存在偏差（`abs(delta) > 0`）。输出每项偏差详情与偏差项总数。

### 接口
```
python status_aggregator.py <data_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `data_json` | 数据JSON文件路径，须含字段：`items`（数组），每项含 `name`（名称）、`planned`（计划值，数值）、`actual`（实际值，数值） |
| `--json` | 显式声明 JSON 输出（默认即为 JSON，效果相同） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 汇总成功（无论是否存在偏差均返回 0） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 注意：脚本始终返回 0（除参数错误外），不依据偏差数量返回不同退出码。CI 门禁须读取 `deviations` 字段判定是否阻断。

### 检查项
1. **JSON 加载**：读取 `data_json` 文件并解析为字典。文件不存在或 JSON 非法时返回 exit=3。
2. **逐项计算**：遍历 `items` 列表，对每项计算 `delta = float(actual) - float(planned)`。若 `actual` 或 `planned` 非数值（TypeError/ValueError），则 `delta = None`。
3. **偏差标记**：`deviation = True` 当且仅当 `delta is not None` 且 `abs(delta) > 0`。
4. **偏差统计**：统计 `deviation=True` 的项数，作为 `deviations` 字段输出。

### 数据JSON字段说明
| 字段 | 类型 | 说明 |
|------|------|------|
| `items` | array | 数据项列表 |
| `items[].name` | string | 数据项名称（如"已完成故事数"、"缺陷数"） |
| `items[].planned` | number | 计划值 |
| `items[].actual` | number | 实际值 |

### JSON 输出示例
存在偏差时输出：
```json
{
  "items": [
    {"name": "已完成故事数", "delta": 2.0, "deviation": true},
    {"name": "缺陷数", "delta": -1.0, "deviation": true},
    {"name": "测试覆盖率", "delta": 0.0, "deviation": false}
  ],
  "deviations": 2
}
```

无数据项时输出：
```json
{
  "items": [],
  "deviations": 0
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
# 基本汇总
python skills/pm-status-reporting/scripts/status_aggregator.py ./status.json

# JSON 输出（供 Agent 消费）
python skills/pm-status-reporting/scripts/status_aggregator.py ./status.json --json

# CI 门禁（依据 deviations 字段判定）
dev=$(python skills/pm-status-reporting/scripts/status_aggregator.py ./status.json --json | python -c "import sys,json;print(json.load(sys.stdin)['deviations'])")
[ "$dev" -gt 0 ] && echo "存在 $dev 项偏差，需根因分析" || echo "无偏差"

# status.json 示例
# {
#   "items": [
#     {"name": "已完成故事数", "planned": 20, "actual": 18},
#     {"name": "缺陷数", "planned": 5, "actual": 8},
#     {"name": "测试覆盖率(%)", "planned": 80, "actual": 82}
#   ]
# }
# → items = [
#   {name:"已完成故事数", delta:-2.0, deviation:true},
#   {name:"缺陷数", delta:3.0, deviation:true},
#   {name:"测试覆盖率(%)", delta:2.0, deviation:true}
# ]
# → deviations = 3
```

### 能力边界
- 仅计算数值型偏差（`actual - planned`），不支持百分比/比率类偏差（须上游预处理）
- 不区偏差方向（正/负均为 `deviation=true`），不判定偏差严重度
- 不引用历史趋势数据（L3 深度要求须人工或额外脚本完成）
- 不输出根因分析、纠正措施、门禁状态、决策项等 L3 深度字段
- 不做多源交叉校验（L3 深度要求须人工或额外脚本完成）
- 非数值字段静默处理（`delta=null`），不报错

### 单测对应
`tests/test_scripts.py` 中 `pm-status-reporting/status_aggregator.py` 条目（3 用例）：
- `deviation`：`{items:[{name:A, planned:10, actual:12}]}` → exit=0，输出含 `deviations`（delta=2.0, deviations=1）
- `no_items`：`{items:[]}` → exit=0，输出含 `deviations`（deviations=0）
- `missing_file`：文件不存在 → exit=3，输出含 `error`
