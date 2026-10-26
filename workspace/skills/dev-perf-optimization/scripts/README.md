# scripts/ — 性能优化技能脚本

本目录包含 `dev-perf-optimization` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `perf_compare.py` | 优化前后基准对比：输入 before/after JSON，输出 TPS/P95 提升率 | 0/1/3 |
| `slow_query_analyzer.py` | 慢查询分析：按执行时间排序并给优化建议 | 0/3 |

---

## perf_compare.py

### 用途
优化前后基准对比：读取 before/after 两份基准 JSON（含 tps、p95_ms），计算 TPS 提升率与 P95 改善率，判定性能是否改善。TPS 上升且 P95 下降视为 improved=true。

### 接口
```
python perf_compare.py <before_json> <after_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `before_json` | 优化前基准 JSON，格式 `{"tps": 4000, "p95_ms": 1200}` |
| `after_json` | 优化后基准 JSON，格式同上 |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 性能改善（improved=true：TPS 上升且 P95 下降） |
| 1 | 性能未改善或回退（improved=false） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

### 检查项
1. **TPS 提升率**：`(after.tps - before.tps) / before.tps * 100`，保留 1 位小数。
2. **P95 改善率**：`(after.p95_ms - before.p95_ms) / before.p95_ms * 100`，负值表示延迟下降（改善）。
3. **improved 判定**：`after.tps >= before.tps` 且 `after.p95_ms <= before.p95_ms` 时 improved=true。
4. **除零保护**：before 值为 0 时提升率返回 null。

### 判定逻辑
| 条件 | improved | 退出码 |
|------|---------|--------|
| TPS 上升 且 P95 下降 | true | 0 |
| TPS 下降 或 P95 上升 | false | 1 |

### 输入 JSON 示例
优化前（before.json）：
```json
{"tps": 4000, "p95_ms": 1200}
```
优化后（after.json）：
```json
{"tps": 6000, "p95_ms": 900}
```

### 输出 JSON 示例
```json
{
  "tps_improvement": 50.0,
  "p95_improvement": -25.0,
  "improved": true
}
```

### 调用示例
```bash
# 性能改善场景（TPS 上升 + P95 下降）
python skills/dev-perf-optimization/scripts/perf_compare.py before.json after.json

# 性能回退场景（TPS 下降）
python skills/dev-perf-optimization/scripts/perf_compare.py good_before.json bad_after.json

# CI 门禁（优化必须改善才放行）
python skills/dev-perf-optimization/scripts/perf_compare.py before.json after.json && echo "性能改善" || echo "性能未改善或回退"
```

### 单测对应
`tests/test_scripts.py` 中 `dev-perf-optimization/perf_compare.py` 条目（3 用例）：
- `improved`：before tps=4000/p95=1200, after tps=6000/p95=900 → exit=0，输出含 `improved`
- `degraded`：before tps=6000/p95=900, after tps=4000/p95=1200 → exit=1，输出含 `improved`
- `missing_file`：after 文件不存在 → exit=3，输出含 `error`

---

## slow_query_analyzer.py

### 用途
慢查询分析：输入慢查询列表 JSON，按执行时间降序排序，对未走索引的查询给出"检查索引"建议，对走索引的查询给出"评估查询逻辑/分页"建议。输出 Top 10 慢查询。

### 接口
```
python slow_query_analyzer.py <queries_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `queries_json` | 慢查询 JSON 路径，格式 `[{"sql": "...", "duration_ms": 500, "index_used": false}, ...]` |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 分析完成（无论是否检出慢查询） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 本脚本为**分析工具**，不阻断流程；退出码恒为 0（除参数错误），优化决策由人工根据 top_slow 清单判断。

### 检查项
1. **执行时间排序**：按 `duration_ms` 降序排序。
2. **索引使用判定**：`index_used=false` 时建议"检查索引"。
3. **查询逻辑建议**：`index_used=true` 时建议"评估查询逻辑/分页"。
4. **Top 10 截断**：最多输出前 10 条慢查询。
5. **空列表兼容**：输入空数组时输出空 top_slow 与 count=0（exit=0）。

### 建议规则表
| 条件 | 建议 |
|------|------|
| `index_used=false` | 检查索引 |
| `index_used=true` | 评估查询逻辑/分页 |

### 输入 JSON 示例
```json
[
  {"sql": "SELECT * FROM accounts WHERE balance > 1000", "duration_ms": 500, "index_used": false},
  {"sql": "SELECT id FROM accounts WHERE id = 1", "duration_ms": 50, "index_used": true}
]
```

### 输出 JSON 示例
```json
{
  "top_slow": [
    {"sql": "SELECT * FROM accounts WHERE balance > 1000", "duration_ms": 500, "index_used": false, "suggestion": "检查索引"},
    {"sql": "SELECT id FROM accounts WHERE id = 1", "duration_ms": 50, "index_used": true, "suggestion": "评估查询逻辑/分页"}
  ],
  "count": 2
}
```

### 调用示例
```bash
# 慢查询分析
python skills/dev-perf-optimization/scripts/slow_query_analyzer.py slow_queries.json

# 空列表场景
python skills/dev-perf-optimization/scripts/slow_query_analyzer.py empty.json

# CI 集成（输出供性能优化决策）
python skills/dev-perf-optimization/scripts/slow_query_analyzer.py slow_queries.json > slow_query_report.json
```

### 单测对应
`tests/test_scripts.py` 中 `dev-perf-optimization/slow_query_analyzer.py` 条目（3 用例）：
- `slow_queries`：1 条慢查询（duration_ms=500, index_used=false） → exit=0，输出含 `top_slow`
- `empty_list`：空数组 → exit=0，输出含 `count`
- `missing_file`：文件不存在 → exit=3，输出含 `error`

---

## 能力边界

- 上述脚本为**轻量性能分析**，不替代专业压测工具（JMeter/Gatling）与 APM（Pinpoint/SkyWalking）。
- `perf_compare.py` 仅对比 **TPS 与 P95** 两项指标；完整性能评估须覆盖 P99、错误率、资源消耗、并发数等。
- `slow_query_analyzer.py` 仅基于输入的 **duration_ms 与 index_used** 给建议，不解析 SQL 执行计划；执行计划分析须依赖 EXPLAIN 或 DBA 工具。
- `slow_query_analyzer.py` 的建议为**通用建议**（检查索引/评估查询逻辑），不针对具体 SQL 给优化方案；具体优化须人工分析。
- 资金类接口的性能优化须在 L3 档位下额外覆盖 P99 长尾延迟、边界压测（2x/5x 目标 TPS）、疲劳测试、并发安全验证。
