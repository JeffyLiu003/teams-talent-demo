# scripts/ — 单元测试技能脚本

本目录包含 `dev-unit-test` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `coverage_report.py` | 解析覆盖率报告（JSON/文本/JaCoCo XML）并对比阈值 | 0/2/3 |

---

## coverage_report.py

### 用途
解析覆盖率报告（支持 JSON / 文本百分比 / JaCoCo XML 三种格式），提取总体覆盖率并与阈值对比，输出覆盖率与通过判定。

### 接口
```
python coverage_report.py <report> [--threshold <N>] [--jacoco] [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `report` | 覆盖率报告文件路径（JSON / 文本 / JaCoCo XML） |
| `--threshold` | 覆盖率阈值（百分比），默认 80.0 |
| `--jacoco` | 解析 JaCoCo XML（LINE 计数器），取报告级汇总（最后一个 LINE 计数器） |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 覆盖率达到阈值（coverage >= threshold，pass=true） |
| 2 | 覆盖率未达阈值（coverage < threshold，pass=false） |
| 3 | 参数错误（文件不存在 / 读取失败） |

### 检查项
1. **格式自动识别**（无 `--jacoco` 时）：
   - 优先尝试 JSON 解析，读取 `overall_coverage` 或 `coverage` 字段。
   - JSON 解析失败时退化为文本正则匹配 `(\d+(?:\.\d+)?)%`。
2. **JaCoCo XML 解析**（`--jacoco` 时）：
   - 正则匹配 `<counter type="LINE" missed="(\d+)" covered="(\d+)"`。
   - 取最后一个 LINE 计数器作为报告级汇总：`coverage = covered / (missed + covered) * 100`。
3. **阈值对比**：`coverage >= threshold` 时 pass=true。
4. **空报告兼容**：无法提取覆盖率时 coverage=0.0。

### 支持的输入格式
| 格式 | 触发条件 | 提取字段 |
|------|---------|---------|
| JSON | 默认（非 `--jacoco`） | `overall_coverage` 或 `coverage` |
| 文本百分比 | 默认且 JSON 解析失败 | 首个 `(\d+)%` 模式 |
| JaCoCo XML | `--jacoco` | 最后一个 LINE 计数器（missed/covered） |

### 输入 JSON 示例
JSON 格式（cov.json）：
```json
{"overall_coverage": 82.5}
```
JaCoCo XML 格式（jacoco.xml）：
```xml
<report><counter type="LINE" missed="15" covered="85"/></report>
```

### 输出 JSON 示例
```json
{
  "overall_coverage": 82.5,
  "threshold": 80.0,
  "pass": true
}
```

### 调用示例
```bash
# JSON 覆盖率报告 + 默认阈值 80%
python skills/dev-unit-test/scripts/coverage_report.py cov.json

# 自定义阈值 90%
python skills/dev-unit-test/scripts/coverage_report.py cov.json --threshold 90

# JaCoCo XML 报告
python skills/dev-unit-test/scripts/coverage_report.py jacoco.xml --jacoco

# CI 门禁（覆盖率达阈值才放行）
python skills/dev-unit-test/scripts/coverage_report.py cov.json && echo "覆盖率达标" || echo "覆盖率未达标"
```

### 单测对应
`tests/test_scripts.py` 中 `dev-unit-test/coverage_report.py` 条目（4 用例）：
- `above_threshold`：`{"overall_coverage": 82.5}` → exit=0，输出含 `pass`
- `below_threshold`：`{"overall_coverage": 60.0}` → exit=2，输出含 `pass`
- `jacoco_xml`：`<counter type="LINE" missed="15" covered="85"/>` → exit=0，输出含 `pass`
- `missing_file`：文件不存在 → exit=3，输出含 `error`

---

## 能力边界

- 本脚本为**轻量覆盖率解析**，不替代专业覆盖率工具（JaCoCo/Coverage.py/Istanbul）的完整报告。
- JSON 格式仅识别 `overall_coverage` 与 `coverage` 两个字段；其他字段名（如 `lines.total`）不被识别。
- 文本格式仅匹配**首个百分比**，多模块报告可能提取错误模块的覆盖率。
- JaCoCo XML 仅取**最后一个 LINE 计数器**作为报告级汇总；若报告含多个 package，须确保最后一个计数器是报告级（JaCoCo 通常如此）。
- 覆盖率达标**不等于**测试质量达标；关键路径覆盖、异常路径覆盖、断言充分性须由 dev-unit-test-extended 技能的 coverage_analyzer.py 与 test_smell_detector.py 评估。
- 资金类代码的单测须在 L3 档位下额外覆盖字段级边界用例、异常路径用例、并发安全用例、事务与回滚用例。
