# scripts/ — 性能测试技能脚本

本目录包含 `qa-performance-test` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `perf_result_analyzer.py` | 性能结果分析：与目标对比，识别瓶颈信号，输出PASS/FAIL判定 | 0/2/3 |
| `load_model_gen.py` | 负载模型生成：按场景比例与目标TPS生成加压模型 | 0/3 |

---

## perf_result_analyzer.py

### 用途
对性能测试结果进行分析。输入结果 JSON（含P95响应时间、TPS、错误率与目标值），与目标对比输出三项检查结果与PASS/FAIL判定，并给出瓶颈提示。

### 接口
```
python perf_result_analyzer.py <result_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `result_json` | 结果 JSON 文件路径，格式为 `{"p95_ms": 200, "tps": 500, "error_rate": 0.0005, "target": {"p95_ms": 500, "tps": 300}}` |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 性能达标（三项检查全部通过，verdict=PASS） |
| 2 | 性能未达标（有检查项未通过，verdict=FAIL） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 退出码优先级：参数错误（3） > 未达标（2） > 达标（0）。

### 检查项
1. **JSON 解析**：读取并解析结果 JSON 文件，解析失败返回退出码 3。
2. **P95响应时间检查**：实际 p95_ms ≤ 目标 p95_ms 则通过。
3. **TPS检查**：实际 tps ≥ 目标 tps 则通过。
4. **错误率检查**：实际 error_rate < 0.001（0.1%）则通过。
5. **综合判定**：三项检查全部通过 → PASS（exit=0）；否则 → FAIL（exit=2）。
6. **瓶颈提示**：FAIL 时输出瓶颈提示（建议检查资源使用率与慢查询）。

### 输入 JSON 格式
```json
{
  "p95_ms": 200,
  "tps": 500,
  "error_rate": 0.0005,
  "target": {
    "p95_ms": 500,
    "tps": 300
  }
}
```

### JSON 输出示例
```json
{
  "checks": {
    "p95_ok": true,
    "tps_ok": true,
    "error_rate_ok": true
  },
  "verdict": "PASS",
  "bottleneck_hint": null
}
```

### 调用示例
```bash
# 基本分析
python skills/qa-performance-test/scripts/perf_result_analyzer.py 结果.json

# JSON 输出（供 Agent 消费）
python skills/qa-performance-test/scripts/perf_result_analyzer.py 结果.json --json

# CI 门禁（退出码驱动，性能达标才放行）
python skills/qa-performance-test/scripts/perf_result_analyzer.py 结果.json && echo "性能达标" || echo "性能未达标，需调优"
```

### 能力边界
- 仅做三项指标检查（P95/TPS/错误率），不检查资源使用率（CPU/内存/IO/网络需由监控工具采集）。
- 错误率阈值固定为0.1%（0.001），不支持外部配置。
- 瓶颈提示为固定文案，不做具体瓶颈定位（需由监控工具与日志分析完成）。
- 不生成性能报告文档（报告生成由模板 + 人工补充瓶颈分析/调优建议完成）。

### 单测对应
`tests/test_scripts.py` 中 `qa-performance-test/perf_result_analyzer.py` 条目（3 用例）：
- `perf_pass`：三项指标达标 → exit=0，verdict=PASS
- `perf_fail`：P95超目标或TPS不足 → exit=2，verdict=FAIL
- `missing_file`：文件不存在 → exit=3，输出含 `error`

---

## load_model_gen.py

### 用途
生成性能测试负载模型。输入场景 JSON（含目标TPS与各场景比例），按比例分配各场景TPS，输出负载模型供性能测试工具（JMeter/Gatling等）使用。

### 接口
```
python load_model_gen.py <scenario_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `scenario_json` | 场景 JSON 文件路径，格式为 `{"target_tps": 1000, "scenarios": [{"name": "转账", "ratio": 30}, {"name": "查询", "ratio": 70}]}` |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 生成成功（输出负载模型） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 注：本脚本只做负载模型生成，不校验模型合理性。退出码 0 表示生成完成，不代表模型已确认。

### 检查项
1. **JSON 解析**：读取并解析场景 JSON 文件，解析失败返回退出码 3。
2. **比例归一化**：计算所有场景比例总和（total_ratio），用于归一化分配。
3. **TPS分配**：每个场景TPS = target_tps × ratio / total_ratio，保留两位小数。
4. **模型输出**：输出各场景名称与分配TPS。

### 输入 JSON 格式
```json
{
  "target_tps": 1000,
  "scenarios": [
    {"name": "转账交易", "ratio": 30},
    {"name": "账户查询", "ratio": 50},
    {"name": "报表导出", "ratio": 20}
  ]
}
```

### JSON 输出示例
```json
{
  "load_model": [
    {"name": "转账交易", "tps": 300.0},
    {"name": "账户查询", "tps": 500.0},
    {"name": "报表导出", "tps": 200.0}
  ]
}
```

### 调用示例
```bash
# 基本生成
python skills/qa-performance-test/scripts/load_model_gen.py 场景.json

# JSON 输出（供 Agent 消费）
python skills/qa-performance-test/scripts/load_model_gen.py 场景.json --json

# CI 门禁（退出码驱动，生成成功才继续）
python skills/qa-performance-test/scripts/load_model_gen.py 场景.json && echo "负载模型生成成功" || echo "负载模型生成失败"
```

### 能力边界
- 仅按比例分配TPS，不考虑场景间依赖与资源竞争（需由性能测试工具处理）。
- 比例归一化处理（比例总和无需为100，脚本自动归一化）。
- 不校验目标TPS合理性（过高或过低的TPS需人工评估）。
- 不生成性能测试脚本（脚本开发由 JMeter/Gatling 等工具完成）。
- 不支持阶梯加压与持续时间配置（需由性能测试工具设置）。

### 单测对应
`tests/test_scripts.py` 中 `qa-performance-test/load_model_gen.py` 条目（3 用例）：
- `normal_model`：正常场景比例 → exit=0，load_model 各场景TPS分配正确
- `single_scenario`：单场景 → exit=0，该场景TPS=target_tps
- `missing_file`：文件不存在 → exit=3，输出含 `error`
