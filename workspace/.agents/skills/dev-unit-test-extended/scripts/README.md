# scripts/ — 扩展单元测试技能脚本

本目录包含 `dev-unit-test-extended` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `coverage_analyzer.py` | 覆盖率缺口分析：对比总体/关键路径覆盖率 | 0/2/3 |
| `test_smell_detector.py` | 测试坏味道检测：sleep/断言过弱/直接访问私有成员 | 0/1 |

---

## coverage_analyzer.py

### 用途
覆盖率缺口分析：读取覆盖率 JSON（含总体覆盖率与关键路径覆盖率列表），识别 coverage<100% 的关键路径作为缺口，输出缺口清单与是否全部覆盖的判定。

### 接口
```
python coverage_analyzer.py <coverage_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `coverage_json` | 覆盖率 JSON 路径，格式 `{"overall": 80, "critical_paths": [{"name": "p1", "coverage": 50}]}` |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 关键路径全部覆盖（all_critical_covered=true，gaps 为空） |
| 2 | 存在覆盖率缺口（all_critical_covered=false，gaps 非空） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

### 检查项
1. **总体覆盖率提取**：读取 `overall` 字段。
2. **关键路径覆盖率遍历**：遍历 `critical_paths` 数组，每条路径含 `name` 与 `coverage`。
3. **缺口识别**：`coverage < 100` 的路径进入 gaps 清单。
4. **all_critical_covered 判定**：gaps 为空时 all_critical_covered=true。

### 缺口判定规则
| 条件 | gaps | all_critical_covered | 退出码 |
|------|------|---------------------|--------|
| 所有关键路径 coverage=100 | [] | true | 0 |
| 任一关键路径 coverage<100 | [{name, coverage}] | false | 2 |

### 输入 JSON 示例
```json
{
  "overall": 80,
  "critical_paths": [
    {"name": "transfer", "coverage": 100},
    {"name": "limit_check", "coverage": 50},
    {"name": "idempotency", "coverage": 0}
  ]
}
```

### 输出 JSON 示例
```json
{
  "overall": 80,
  "gaps": [
    {"name": "limit_check", "coverage": 50},
    {"name": "idempotency", "coverage": 0}
  ],
  "all_critical_covered": false
}
```

### 调用示例
```bash
# 覆盖率缺口分析（有缺口）
python skills/dev-unit-test-extended/scripts/coverage_analyzer.py coverage.json

# 全覆盖场景
python skills/dev-unit-test-extended/scripts/coverage_analyzer.py full_coverage.json

# CI 门禁（关键路径必须 100% 覆盖）
python skills/dev-unit-test-extended/scripts/coverage_analyzer.py coverage.json && echo "关键路径全覆盖" || echo "存在覆盖率缺口"
```

### 单测对应
`tests/test_scripts.py` 中 `dev-unit-test-extended/coverage_analyzer.py` 条目（3 用例）：
- `gaps`：overall=80, p1 coverage=50 → exit=2，输出含 `gaps`
- `all_covered`：overall=90, p1 coverage=100 → exit=0，输出含 `all_critical_covered`
- `missing_file`：文件不存在 → exit=3，输出含 `error`

---

## test_smell_detector.py

### 用途
测试坏味道检测：扫描测试目录中的 `.py`/`.java`/`.ts` 文件，识别常见测试坏味道（sleep 等待、断言过弱 not None），输出坏味道清单。

### 接口
```
python test_smell_detector.py <test_dir> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `test_dir` | 测试代码目录路径，递归扫描 `.py`/`.java`/`.ts` 文件 |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 无测试坏味道（含空目录场景） |
| 1 | 存在测试坏味道（sleep 或断言过弱） |

### 检查项
1. **sleep 等待检测**：匹配 `sleep(` 模式（Python `time.sleep` / Java `Thread.sleep` / TS `setTimeout` 等），标记为"测试中使用sleep"。
2. **断言过弱检测**：匹配 `assert not None`（Python）或 `assertNotNull(`（Java）模式，标记为"断言过弱（not None）"。
3. **行级定位**：每条 smell 含 file、line、smell 描述。
4. **smells 截断**：最多输出前 50 条坏味道。
5. **空目录兼容**：目录不存在或无测试文件时输出空 smells（exit=0）。

### 坏味道规则表
| 坏味道 | 匹配模式 | 说明 |
|--------|---------|------|
| 测试中使用 sleep | `sleep\s*\(` | 应用等待/事件通知替代 sleep |
| 断言过弱（not None） | `assert\s+not\s+None` / `assertNotNull\s*\(` | 应断言具体值而非仅非空 |

### 输入 JSON 示例
无需输入 JSON，直接扫描测试目录：
```python
# test_a.py
import time
time.sleep(1)
result = service.do()
assert result is not None
```

### 输出 JSON 示例
```json
{
  "smells": [
    {"file": "tests/test_a.py", "line": 2, "smell": "测试中使用sleep"},
    {"file": "tests/test_a.py", "line": 4, "smell": "断言过弱（not None）"}
  ],
  "count": 2
}
```

### 调用示例
```bash
# 测试坏味道检测
python skills/dev-unit-test-extended/scripts/test_smell_detector.py tests/

# sleep 坏味道场景
python skills/dev-unit-test-extended/scripts/test_smell_detector.py bad_tests/

# CI 门禁（坏味道为零才放行）
python skills/dev-unit-test-extended/scripts/test_smell_detector.py tests/ && echo "无测试坏味道" || echo "存在测试坏味道"
```

### 单测对应
`tests/test_scripts.py` 中 `dev-unit-test-extended/test_smell_detector.py` 条目（3 用例）：
- `sleep_smell`：`import time\ntime.sleep(1)` → exit=1，输出含 `smells`
- `clean_tests`：`def test_x():\n    assert 1 == 1` → exit=0，输出含 `smells`
- `missing_dir`：目录不存在 → exit=0，输出含 `smells`

---

## 能力边界

- 上述脚本为**轻量测试质量分析**，不替代专业测试质量工具（SonarQube Test/CodeScene）。
- `coverage_analyzer.py` 仅识别**关键路径 coverage<100%** 的缺口，不分析缺口的根因（是没写测试还是测试没跑到）。
- `test_smell_detector.py` 仅检测 **sleep 与断言过弱** 两类坏味道；其他坏味道（如测试顺序依赖、共享状态、Magic Number、过度 Mock）须依赖 SonarQube 或人工审查。
- `test_smell_detector.py` 的 sleep 检测为**模式匹配**，可能误报注释中的 sleep 或生产代码中的 sleep（若测试目录混入生产代码）。
- 断言过弱检测仅识别 `not None` 模式，不识别其他弱断言（如 `assert True` / `assert len(x) > 0` 不验证内容）。
- 资金类代码的测试质量须在 L3 档位下额外覆盖字段级缺口分析（资金/权限/监管路径）、异常路径测试清单、并发安全测试、Mock 行为可验证。
