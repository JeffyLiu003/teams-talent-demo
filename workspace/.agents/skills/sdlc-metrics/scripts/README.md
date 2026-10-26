# sdlc-metrics 脚本说明

本目录包含 SDLC 交付效能度量体系的可执行脚本，无第三方依赖，仅需 Python 3.8+。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `collect_metrics.py` | 从 context-bus.json 和门禁结果采集度量数据，计算全部指标 | 0=成功, 1=数据不完整 |
| `generate_dashboard.py` | 读取 metrics-report.json 生成 Markdown 可视化看板 | 0=成功, 1=失败 |
| `validate_metrics.py` | 校验度量数据完整性（时间戳/DORA/合理性） | 0=完整, 1=缺失/异常 |

## 能力边界

### collect_metrics.py
**能做**：
- 读取 context-bus.json（兼容 `phases.G1` 与 `requirement` 两种结构）
- 自动扫描各阶段目录下的 `*gate_result*.json` 文件，提取脚本通过/失败统计
- 计算 Lead Time（G1 开始 → G8 完成总时长、各阶段耗时、门禁等待时间）
- 计算门禁拦截率（G1/G3/G5 退回率、退回原因 TOP3）
- 计算 DORA 四指标（部署频率、变更失败率、MTTR、缺陷逃逸率）
- 计算 Agent 效能（脚本通过率、人工干预次数、返工率、Agent 自主率）
- 输出标准化的 `metrics-report.json`

**不能做**：
- 不直接连数据库或调用 API，只读本地文件
- 不生成可视化看板（由 `generate_dashboard.py` 负责）
- 不校验数据合理性（由 `validate_metrics.py` 负责）
- 不做趋势对比（历史数据由 `generate_dashboard.py --trend` 消费）

**数据来源兜底**：当 context-bus.json 缺少时间戳时，会用文件修改时间作为兜底；当门禁结果 JSON 缺失时，相关统计记为 0。

### generate_dashboard.py
**能做**：
- 读取 `metrics-report.json`，生成 Markdown 看板
- 输出指标表格、ASCII 进度条、各阶段明细表
- 通过 `--trend` 参数加载历史数据，生成 ASCII 趋势图（Lead Time、脚本通过率）
- 看板包含 7 个部分：概览、Lead Time、门禁拦截、DORA、Agent 效能、阶段明细、趋势分析、数据完整度

**不能做**：
- 不重新采集数据（只消费已生成的 `metrics-report.json`）
- 不输出 JSON（只输出 Markdown）
- 不校验数据完整性（看板会标注"数据不足"但不阻断）

**趋势图说明**：`--trend` 接受单条历史度量（dict）或度量列表（list），与当前数据点合并后绘制 ASCII 折线图。建议至少 3 次交付后启用趋势分析。

### validate_metrics.py
**能做**：
- 检查 8 个阶段的时间戳完整性（started_at + completed_at）
- 检查 DORA 四指标是否都有值（4/4）
- 检查数值合理性（耗时 > 0 且 < 合理上限：单阶段 ≤ 30 天、全流程 ≤ 60 天、MTTR ≤ 7 天、百分比 ∈ [0,100]）
- 输出结构化校验报告（JSON），列出全部问题清单

**不能做**：
- 不修复数据（只校验、不修改）
- 不采集数据（只消费已生成的 `metrics-report.json`）
- 不生成看板

**校验阈值**：见脚本内 `SANITY_LIMITS` 常量，可根据项目实际情况调整。

## 使用示例

```bash
# 1. 采集度量数据（每个门禁执行后或 G8 完成后调用）
python collect_metrics.py \
    --context .sdlc-demo/context-bus.json \
    --output .sdlc-demo/08-pm/metrics-report.json

# 2. 校验度量数据完整性（采集后必跑）
python validate_metrics.py \
    --metrics .sdlc-demo/08-pm/metrics-report.json

# 3. 生成可视化看板（无趋势）
python generate_dashboard.py \
    --metrics .sdlc-demo/08-pm/metrics-report.json \
    --output .sdlc-demo/08-pm/dashboard.md

# 4. 生成可视化看板（含趋势对比）
python generate_dashboard.py \
    --metrics .sdlc-demo/08-pm/metrics-report.json \
    --output .sdlc-demo/08-pm/dashboard.md \
    --trend .sdlc-demo/08-pm/history.json

# 5. 查看帮助
python collect_metrics.py --help
python generate_dashboard.py --help
python validate_metrics.py --help
```

## 输出文件

| 文件 | 生成脚本 | 路径 | 说明 |
|------|---------|------|------|
| `metrics-report.json` | collect_metrics.py | 由 `--output` 指定 | 度量数据（标准化 JSON） |
| `dashboard.md` | generate_dashboard.py | 由 `--output` 指定 | Markdown 可视化看板 |
| 校验报告 | validate_metrics.py | stdout 或 `--output` 指定 | JSON 格式校验结果 |

## 度量报告结构

`metrics-report.json` 的完整结构参见 `templates/metrics-report-template.json`。主要包含：
- `stages`：G1-G8 各阶段度量（时间戳、耗时、门禁状态、脚本统计、人工干预）
- `lead_time`：Lead Time 指标（总时长、各阶段耗时、门禁等待、达标判定）
- `gate_interception`：门禁拦截率（G1/G3/G5 退回率、退回原因 TOP3）
- `dora`：DORA 四指标（部署频率、变更失败率、MTTR、缺陷逃逸率）
- `agent_efficiency`：Agent 效能（脚本通过率、人工干预、返工率、自主率）
- `summary`：数据完整度汇总

## 编码与兼容性

- 所有脚本以 `#!/usr/bin/env python3` 开头，UTF-8 编码无 BOM
- JSON 读取使用 `utf-8-sig`，兼容带 BOM 的文件
- 时间解析兼容 ISO 8601（含时区后缀 `Z`）、`YYYY-MM-DDTHH:MM:SS` 等多种格式
- 无第三方依赖，仅使用 Python 标准库
