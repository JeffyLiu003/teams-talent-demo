# scripts/ — 扫描评审技能脚本

本目录包含 `sec-scan-review` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `triage_vulns.py` | 扫描结果分级聚合：CVSS分级、高危漏洞汇总、豁免到期提醒、误报标注、放行/打回结论 | 0/2/3 |

---

## triage_vulns.py

### 用途
读取扫描结果 JSON，按 CVSS 分级（严重/高/中/低），汇总未关闭的高危漏洞，检测即将到期或已过期的豁免，标注误报项，并产出放行（PASS）或打回（BLOCK）结论。是发布前安全门禁的确定性判定器。

### 接口
```
python triage_vulns.py <scan_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `scan_json` | 扫描结果 JSON 路径，内容为对象数组，每项含 `id`、`cvss`、`false_positive`、`waiver_until` 等字段 |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### CVSS 分级标准
| CVSS 区间 | 级别 |
|-----------|------|
| ≥9.0 | 严重 |
| 7.0–8.9 | 高 |
| 4.0–6.9 | 中 |
| <4.0 | 低 |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | PASS（无未关闭的高危/严重漏洞，可放行） |
| 2 | BLOCK（存在未关闭的高危/严重漏洞，须打回） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 退出码优先级：BLOCK（2）> 参数错误（3）。当 JSON 解析失败时直接返回 3，不进行分级判定。

### 检查项
1. **JSON 解析**：读取扫描结果文件，解析失败返回退出码 3。
2. **CVSS 分级**：按 `level()` 函数将每条漏洞映射到 严重/高/中/低 四级。
3. **误报标注**：`false_positive=true` 的漏洞计入 `false_positives` 列表，不计入未关闭高危列表。
4. **未关闭高危汇总**：严重/高级别（非误报）漏洞进入 `open_high` 列表，含 `id`、`cvss`、`waiver_until`。
5. **豁免到期检测**：含 `waiver_until` 且日期 ≤ 当日 的漏洞进入 `waivers_expiring` 列表。
6. **放行结论**：`open_high` 为空 → `verdict=PASS`（退出码 0）；非空 → `verdict=BLOCK`（退出码 2）。

### 输入 JSON 示例
```json
[
  {"id": "V-001", "title": "SQL注入", "cvss": 9.1, "false_positive": false},
  {"id": "V-002", "title": "硬编码密钥", "cvss": 7.5, "false_positive": false, "waiver_until": "2026-09-01"},
  {"id": "V-003", "title": "XSS", "cvss": 6.4, "false_positive": false},
  {"id": "V-004", "title": "误报项", "cvss": 8.0, "false_positive": true}
]
```

### JSON 输出示例
```json
{
  "by_level": {"严重": 1, "高": 1, "中": 1},
  "open_high": [
    {"id": "V-001", "cvss": 9.1, "waiver_until": null},
    {"id": "V-002", "cvss": 7.5, "waiver_until": "2026-09-01"}
  ],
  "waivers_expiring": [],
  "false_positives": ["V-004"],
  "verdict": "BLOCK"
}
```

### 调用示例
```bash
# 基本分级（人类可读 JSON）
python skills/sec-scan-review/scripts/triage_vulns.py scan-results.json

# JSON 输出（供 Agent 消费）
python skills/sec-scan-review/scripts/triage_vulns.py scan-results.json --json

# CI 门禁（退出码驱动，存在高危漏洞则阻断发布）
python skills/sec-scan-review/scripts/triage_vulns.py scan-results.json && echo "安全门禁通过" || echo "安全门禁打回"
```

### 能力边界
- 仅按 CVSS 数值分级，不解析 CWE 编号或攻击路径（由 L3 人工补充）。
- 误报判定依赖输入 JSON 的 `false_positive` 字段，不自行复现 PoC。
- 豁免到期检测按日粒度（`date.fromisoformat`），不支持时区。
- 不区分修复中/已修复状态，所有非误报的高危漏洞均视为"未关闭"。
- 不调用外部扫描器，仅消费已生成的扫描结果 JSON。

### 单测对应
`tests/test_scripts.py` 中 `sec-scan-review/triage_vulns.py` 条目（3 用例）：
- `high_blocks`：含 CVSS=8.5 高危漏洞 → exit=2，输出含 `open_high`
- `low_passes`：仅含 CVSS=2.0 低危漏洞 → exit=0，输出含 `verdict`
- `missing_file`：文件不存在 → exit=3，输出含 `error`
