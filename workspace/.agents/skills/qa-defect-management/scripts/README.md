# scripts/ — 缺陷管理技能脚本

本目录包含 `qa-defect-management` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `defect_classifier.py` | 缺陷严重级别初判：按影响关键词与模块自动分级（致命/严重/一般） | 0/3 |

---

## defect_classifier.py

### 用途
对缺陷进行严重级别初判。输入缺陷 JSON（含标题/描述/模块），基于关键词匹配规则输出建议严重级别与优先级，供缺陷登记时辅助分级。最终级别须由人工复核确认。

### 接口
```
python defect_classifier.py <defect_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `defect_json` | 缺陷 JSON 文件路径，格式为 `{"title":"...", "description":"...", "module":"..."}` |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 分级成功（关键词匹配或默认分级完成） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 注：本脚本只做级别初判，不判定缺陷是否可关闭。退出码 0 表示分级完成，不代表级别最终确定（须人工复核）。

### 检查项
1. **JSON 解析**：读取并解析缺陷 JSON 文件，解析失败返回退出码 3。
2. **关键词匹配-致命**：扫描标题+描述+模块文本，匹配致命关键词（资金/交易丢失/重复扣款/越权/生产/数据丢失）则判为"致命"。
3. **关键词匹配-严重**：未命中致命关键词时，匹配严重关键词（主流程/无法登录/核心功能/阻塞）则判为"严重"。
4. **默认分级**：未命中任何关键词时判为"一般"。
5. **优先级映射**：致命→P0，严重→P1，一般→P2。

### 关键词规则
| 级别 | 关键词 | 优先级 |
|------|--------|--------|
| 致命 | 资金、交易丢失、重复扣款、越权、生产、数据丢失 | P0 |
| 严重 | 主流程、无法登录、核心功能、阻塞 | P1 |
| 一般 | （未命中上述关键词） | P2 |

### 输入 JSON 格式
```json
{
  "title": "转账交易重复扣款",
  "description": "客户执行转账后系统重复扣款两次，导致资金损失",
  "module": "转账服务"
}
```

### JSON 输出示例
```json
{
  "suggested_severity": "致命",
  "priority": "P0"
}
```

### 调用示例
```bash
# 基本分级
python skills/qa-defect-management/scripts/defect_classifier.py 缺陷.json

# JSON 输出（供 Agent 消费）
python skills/qa-defect-management/scripts/defect_classifier.py 缺陷.json --json

# CI 门禁（退出码驱动，仅校验分级成功）
python skills/qa-defect-management/scripts/defect_classifier.py 缺陷.json && echo "分级成功" || echo "分级失败"
```

### 能力边界
- 仅做关键词匹配初判，不替代人工复核（复杂缺陷需 QA 负责人确认级别）。
- 关键词列表固定在脚本中，不支持外部配置扩展（需修改脚本添加关键词）。
- 不区分缺陷类型（功能/性能/安全/兼容性统一按关键词分级）。
- 不生成缺陷单文档（缺陷单生成由模板 + 人工补充复现步骤/证据完成）。
- 不做缺陷趋势分析与退出风险评估（由 SKILL.md 工作流 Step 5-6 人工完成）。

### 单测对应
`tests/test_scripts.py` 中 `qa-defect-management/defect_classifier.py` 条目（3 用例）：
- `critical_defect`：含"资金/重复扣款"关键词 → exit=0，输出 `suggested_severity` 为"致命"
- `normal_defect`：未命中关键词 → exit=0，输出 `suggested_severity` 为"一般"
- `missing_file`：文件不存在 → exit=3，输出含 `error`
