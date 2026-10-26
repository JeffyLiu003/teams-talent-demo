# scripts/ — UAT支持技能脚本

本目录包含 `qa-uat-support` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `uat_progress_tracker.py` | UAT进度跟踪：输入场景执行结果JSON，输出执行率与状态分布 | 0/3 |
| `uat_defect_classifier.py` | UAT问题分类：按关键词将问题分为缺陷/需求变更/操作问题 | 0/3 |

---

## uat_progress_tracker.py

### 用途
对UAT场景执行结果进行进度汇总统计。输入执行结果 JSON 数组（每条含场景ID与状态），输出总数、状态分布、执行率，供UAT日报与验收评估使用。

### 接口
```
python uat_progress_tracker.py <results_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `results_json` | 执行结果 JSON 文件路径，格式为 `[{"id":"US-001", "status":"通过"}, ...]`，status 取值：通过/失败/阻塞/未执行 |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 汇总成功（数据采集与统计无错误） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 注：本脚本只做数据汇总，不判定UAT是否通过。退出码 0 表示汇总成功，不代表UAT通过。

### 检查项
1. **JSON 解析**：读取并解析执行结果 JSON 文件，解析失败返回退出码 3。
2. **状态统计**：按 status 字段聚合统计各状态数量（通过/失败/阻塞/未执行）。
3. **执行率计算**：执行率 = (总数 - 未执行数) / 总数。
4. **空数据处理**：总数为 0 时执行率返回 0，不抛异常。

### 输入 JSON 格式
```json
[
  {"id": "US-001", "status": "通过"},
  {"id": "US-002", "status": "失败"},
  {"id": "US-003", "status": "阻塞"},
  {"id": "US-004", "status": "未执行"}
]
```

### 状态取值
| 状态 | 含义 |
|------|------|
| 通过 | UAT场景执行通过 |
| 失败 | UAT场景执行失败（发现缺陷或不符合预期） |
| 阻塞 | UAT场景因环境/依赖/权限问题无法执行 |
| 未执行 | UAT场景尚未执行 |

### JSON 输出示例
```json
{
  "total": 4,
  "counts": {
    "通过": 1,
    "失败": 1,
    "阻塞": 1,
    "未执行": 1
  },
  "executed_rate": 0.75
}
```

### 调用示例
```bash
# 基本汇总
python skills/qa-uat-support/scripts/uat_progress_tracker.py 执行结果.json

# JSON 输出（供 Agent 消费）
python skills/qa-uat-support/scripts/uat_progress_tracker.py 执行结果.json --json

# CI 门禁（退出码驱动，仅校验采集成功）
python skills/qa-uat-support/scripts/uat_progress_tracker.py 执行结果.json && echo "UAT进度汇总成功" || echo "UAT进度汇总失败"
```

### 能力边界
- 仅做数据汇总统计，不判定UAT是否通过（通过/失败门禁由 SKILL.md 质量门禁章节定义）。
- 不计算通过率（UAT通过率需结合业务验收标准人工判定）。
- 不区分场景优先级（核心/非核心场景统一统计）。
- 不生成UAT日报文档（日报生成由模板 + 人工补充缺陷分析/验收意见完成）。

### 单测对应
`tests/test_scripts.py` 中 `qa-uat-support/uat_progress_tracker.py` 条目（3 用例）：
- `normal_summary`：正常执行结果汇总 → exit=0，输出含 `executed_rate`
- `empty_results`：空数组输入 → exit=0，执行率为 0
- `missing_file`：文件不存在 → exit=3，输出含 `error`

---

## uat_defect_classifier.py

### 用途
对UAT问题进行自动分类。输入问题 JSON（含标题与描述），基于关键词匹配将问题分为三类：操作问题/需求变更/缺陷，供UAT问题跟踪与分派使用。最终分类须由人工复核确认。

### 接口
```
python uat_defect_classifier.py <issue_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `issue_json` | 问题 JSON 文件路径，格式为 `{"title":"...", "description":"..."}` |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 分类成功（关键词匹配或默认分类完成） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 注：本脚本只做分类初判，不判定问题严重级别。退出码 0 表示分类完成，不代表分类最终确定（须人工复核）。

### 检查项
1. **JSON 解析**：读取并解析问题 JSON 文件，解析失败返回退出码 3。
2. **关键词匹配-操作问题**：扫描标题+描述文本，匹配操作问题关键词（不会用/怎么操作/不懂）则判为"操作问题"。
3. **关键词匹配-需求变更**：未命中操作问题关键词时，匹配需求变更关键词（希望/增加/变更/需求）则判为"需求变更"。
4. **默认分类**：未命中任何关键词时判为"缺陷"。

### 关键词规则
| 分类 | 关键词 | 说明 |
|------|--------|------|
| 操作问题 | 不会用、怎么操作、不懂 | 业务用户操作不当，需培训/答疑 |
| 需求变更 | 希望、增加、变更、需求 | 业务用户提出新需求或变更 |
| 缺陷 | （未命中上述关键词） | 系统功能缺陷，需开发修复 |

### 输入 JSON 格式
```json
{
  "title": "转账页面不会用",
  "description": "业务用户反馈不知道怎么操作转账功能"
}
```

### JSON 输出示例
```json
{
  "category": "操作问题"
}
```

### 调用示例
```bash
# 基本分类
python skills/qa-uat-support/scripts/uat_defect_classifier.py 问题.json

# JSON 输出（供 Agent 消费）
python skills/qa-uat-support/scripts/uat_defect_classifier.py 问题.json --json

# CI 门禁（退出码驱动，仅校验分类成功）
python skills/qa-uat-support/scripts/uat_defect_classifier.py 问题.json && echo "分类成功" || echo "分类失败"
```

### 能力边界
- 仅做关键词匹配初判，不替代人工复核（复杂问题需UAT协调人确认分类）。
- 关键词列表固定在脚本中，不支持外部配置扩展。
- 不区分问题严重级别（致命/严重/一般统一按关键词分类）。
- 不生成问题单文档（问题单生成由模板 + 人工补充复现步骤/证据完成）。
- 不做问题趋势分析（由 SKILL.md 工作流 Step 6 人工完成）。

### 单测对应
`tests/test_scripts.py` 中 `qa-uat-support/uat_defect_classifier.py` 条目（3 用例）：
- `operation_issue`：含"不会用/怎么操作"关键词 → exit=0，category 为"操作问题"
- `defect_issue`：未命中关键词 → exit=0，category 为"缺陷"
- `missing_file`：文件不存在 → exit=3，输出含 `error`
