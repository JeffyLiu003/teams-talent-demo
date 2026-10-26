# scripts/ — 变更窗口排期技能脚本

本目录包含 `change-window-scheduling` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `window_scheduler.py` | 变更窗口排期：读取日历JSON，统计已有窗口与冻结期数量，输出冲突检测结果与建议 | 0/1/3 |

---

## window_scheduler.py

### 用途
读取变更窗口日历 JSON，统计已有变更窗口与冻结期数量，作为冲突检测结果输出。脚本为简化实现：将 `existing` 与 `frozen` 列表中的条目数量之和作为冲突计数，并给出"按业务日历人工确认具体时段"的统一建议。Agent 可基于该结果进一步推荐具体窗口与备选方案。

### 接口
```
python window_scheduler.py <calendar_json> [--slot_minutes N] [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `calendar_json` | 日历JSON文件路径，须含字段：`existing`（已有变更窗口列表）、`frozen`（冻结期列表）、`business_hours`（业务高峰时段，可选） |
| `--slot_minutes` | 窗口时长（分钟），默认 120。当前实现未实际使用该参数，预留扩展 |
| `--json` | 显式声明 JSON 输出（默认即为 JSON，效果相同） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 无冲突（`existing` 与 `frozen` 列表均为空） |
| 1 | 检测到冲突（`existing` 与 `frozen` 列表之和 > 0） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 退出码优先级：参数错误（3）> 冲突（1）> 无冲突（0）。

### 检查项
1. **JSON 加载**：读取 `calendar_json` 文件并解析为字典。文件不存在或 JSON 非法时返回 exit=3。
2. **冲突统计**：将 `existing` 列表与 `frozen` 列表合并，统计条目总数作为 `conflicts_found`。
3. **建议输出**：固定输出"请按业务日历人工确认具体时段"的建议，`suggestions` 列表当前为空（预留扩展）。
4. **退出码判定**：`conflicts_found == 0` → exit=0；`conflicts_found > 0` → exit=1。

### 日历JSON字段说明
| 字段 | 类型 | 说明 |
|------|------|------|
| `existing` | array | 已有变更窗口列表，每项含 `start`、`end`（日期/时间字符串） |
| `frozen` | array | 冻结期列表，每项含 `start`、`end`（日期/时间字符串） |
| `business_hours` | array | 业务高峰时段列表（可选，当前实现未使用） |

### JSON 输出示例
无冲突时输出：
```json
{
  "conflicts_found": 0,
  "recommendation": "请按业务日历人工确认具体时段",
  "suggestions": []
}
```

检测到冲突时输出：
```json
{
  "conflicts_found": 2,
  "recommendation": "请按业务日历人工确认具体时段",
  "suggestions": []
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
# 基本冲突检测
python skills/change-window-scheduling/scripts/window_scheduler.py ./calendar.json

# 指定窗口时长（当前实现未使用，预留扩展）
python skills/change-window-scheduling/scripts/window_scheduler.py ./calendar.json --slot_minutes 180

# CI 门禁（退出码驱动）
python skills/change-window-scheduling/scripts/window_scheduler.py ./calendar.json && echo "无窗口冲突" || echo "检测到窗口冲突，需人工确认"

# calendar.json 示例
# {
#   "existing": [
#     {"start": "2026-08-20T22:00", "end": "2026-08-20T23:30"}
#   ],
#   "frozen": [
#     {"start": "2026-09-30", "end": "2026-10-08"}
#   ],
#   "business_hours": [
#     {"start": "09:00", "end": "18:00"}
#   ]
# }
# → conflicts_found = 2, exit = 1
```

### 能力边界
- 仅统计 `existing` 与 `frozen` 列表条目数量，不做时段重叠计算（不解析日期/时间）
- `--slot_minutes` 参数当前未实际使用，仅作接口预留
- `suggestions` 列表当前固定为空，具体窗口推荐须人工或上游 Agent 完成
- 不识别业务高峰时段（`business_hours` 字段当前未参与计算）
- 不输出备选窗口、依赖系统就绪时间等 L3 深度字段
- L3 深度门禁（跨系统依赖链、监管冻结期校验、备选窗口 ≥ 2）须人工或额外脚本完成

### 单测对应
`tests/test_scripts.py` 中 `change-window-scheduling/window_scheduler.py` 条目（3 用例）：
- `no_conflicts`：`{existing:[], frozen:[]}` → exit=0，输出含 `conflicts_found`
- `conflict_detected`：`{existing:[{start,end}], frozen:[]}` → exit=1，输出含 `conflicts_found`
- `missing_file`：文件不存在 → exit=3，输出含 `error`
