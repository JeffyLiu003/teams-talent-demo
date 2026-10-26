# scripts/ — 测试执行技能脚本

本目录包含 `qa-test-execution` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `test_progress_tracker.py` | 测试进度跟踪与状态汇总：输入执行结果JSON，输出执行率/通过率/状态分布 | 0/3 |

---

## test_progress_tracker.py

### 用途
对测试执行结果进行进度汇总统计。输入执行结果 JSON 数组（每条含用例ID与状态），输出总数、状态分布、执行率、通过率四项关键指标，供日报与退出评估使用。

### 接口
```
python test_progress_tracker.py <results_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `results_json` | 执行结果 JSON 文件路径，格式为 `[{"id":"TC-001","status":"通过"}, ...]`，status 取值：通过/失败/阻塞/未执行 |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 汇总成功（数据采集与统计无错误） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 注：本脚本只做数据汇总，不判定通过/失败门禁。退出码 0 表示汇总成功，不代表测试通过。

### 检查项
1. **JSON 解析**：读取并解析执行结果 JSON 文件，解析失败返回退出码 3。
2. **状态统计**：按 status 字段聚合统计各状态数量（通过/失败/阻塞/未执行）。
3. **执行率计算**：执行率 = (总数 - 未执行数) / 总数。
4. **通过率计算**：通过率 = 通过数 / 已执行数（已执行 = 总数 - 未执行数）。
5. **空数据处理**：总数为 0 时执行率与通过率返回 0，不抛异常。

### 输入 JSON 格式
```json
[
  {"id": "TC-001", "status": "通过"},
  {"id": "TC-002", "status": "失败"},
  {"id": "TC-003", "status": "阻塞"},
  {"id": "TC-004", "status": "未执行"},
  {"id": "TC-005", "status": "通过"}
]
```

### 状态取值
| 状态 | 含义 |
|------|------|
| 通过 | 用例执行通过 |
| 失败 | 用例执行失败（已发现缺陷） |
| 阻塞 | 用例因环境/依赖问题无法执行 |
| 未执行 | 用例尚未执行 |

### JSON 输出示例
```json
{
  "total": 5,
  "counts": {
    "通过": 2,
    "失败": 1,
    "阻塞": 1,
    "未执行": 1
  },
  "executed_rate": 0.8,
  "pass_rate": 0.6667
}
```

### 调用示例
```bash
# 基本汇总
python skills/qa-test-execution/scripts/test_progress_tracker.py 执行结果.json

# JSON 输出（供 Agent 消费）
python skills/qa-test-execution/scripts/test_progress_tracker.py 执行结果.json --json

# CI 门禁（退出码驱动，仅校验采集成功）
python skills/qa-test-execution/scripts/test_progress_tracker.py 执行结果.json && echo "进度汇总成功" || echo "进度汇总失败"
```

### 能力边界
- 仅做数据汇总统计，不判定测试是否通过（通过/失败门禁由 SKILL.md 质量门禁章节定义）。
- 不校验执行结果与测试管理系统的数据一致性（需人工或外部系统比对）。
- 不区分用例优先级（P0/P1/P2 统一统计，如需分级统计需在输入 JSON 中按优先级分批调用）。
- 不生成日报文档（日报生成由模板 + 人工补充阻塞项/责任人完成）。

### 单测对应
`tests/test_scripts.py` 中 `qa-test-execution/test_progress_tracker.py` 条目（3 用例）：
- `normal_summary`：正常执行结果汇总 → exit=0，输出含 `executed_rate` 与 `pass_rate`
- `empty_results`：空数组输入 → exit=0，执行率与通过率为 0
- `missing_file`：文件不存在 → exit=3，输出含 `error`
