# scripts/ — 需求分析技能脚本

本目录包含 `ba-requirement-analysis` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `spec_completeness.py` | 需求说明书完整性与空项检查、业务规则来源、编号唯一性、模糊词扫描，输出质量得分 | 0/1/2/3 |
| `ambiguity_check.py` | 模糊词扫描与标注（30+ 词，分级分类，含上下文） | 0/1/2/3 |

---

## spec_completeness.py

### 用途
检查需求说明书是否包含所有必需章节、字段是否为空、业务规则是否有来源、需求编号是否唯一、是否存在模糊词。输出质量得分（0–100）与 PASS/WARNING/FAIL 结论。

### 接口
```
python spec_completeness.py <requirement_doc.md> [--json] [--strict]
```

### 参数
| 参数 | 说明 |
|------|------|
| `requirement_doc` | 需求说明书路径（.md） |
| `--json` | 输出 JSON 格式（默认输出人类可读文本） |
| `--strict` | 严格模式：模糊词也计为失败（默认模糊词仅警告） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 全部通过 |
| 1 | 有警告（可选字段缺失或模糊词，且未加 --strict） |
| 2 | 失败（必填章节缺失 / 业务规则无来源 / 需求编号重复 / --strict 下有模糊词） |
| 3 | 参数错误（文件不存在） |

### 检查项
1. **章节完整性**：13 个必选章节（文档信息/修订记录/背景与目标/用户角色/范围定义/功能需求/业务规则/非功能需求/安全需求/数据需求/数据安全/风险与应对/合规标注）
2. **空字段**：占位符 `{{...}}` / `_待回复_` / `[待确认]` / `TODO|FIXME`
3. **模糊词**：大概/可能/尽量/尽快/等等/之类/适当/相应/相关/有关/等
4. **业务规则来源**：`BR-xxx` 表格行是否有来源列非空
5. **需求编号唯一性**：`[REQ-xxx]` 是否重复

### 评分规则
满分 100；缺失必选章节 -5/项、业务规则无来源 -2/项、空字段 -1/项（上限 20）、重复编号 -10/项。

### JSON 输出示例
```json
{
  "filepath": "requirement.md",
  "score": 85,
  "section_check": {"missing_count": 1, "missing_required": ["合规标注"]},
  "empty_fields": {"total_empty": 3},
  "ambiguity": {"total_ambiguous": 2},
  "business_rules": {"total_rules": 5, "missing_source_count": 1},
  "requirement_ids": {"total_requirements": 8, "has_duplicates": false},
  "verdict": "FAIL"
}
```

### 调用示例
```bash
# 基本检查（人类可读）
python skills/ba-requirement-analysis/scripts/spec_completeness.py tests/demo-output/02-requirement-spec-draft.md

# JSON 输出（供 Agent 消费）
python skills/ba-requirement-analysis/scripts/spec_completeness.py requirement.md --json

# 严格模式（模糊词也阻断）
python skills/ba-requirement-analysis/scripts/spec_completeness.py requirement.md --strict --json
```

### 单测对应
`tests/test_scripts.py` 中 `ba-requirement-analysis/spec_completeness.py` 条目（3 用例）：
- `missing_file`：文件不存在 → exit=3
- `draft_warning`：草稿文档 → exit∈{0,1}，输出含 `score`
- `empty_doc_fails`：空文档 → exit=2，输出含 `score`

---

## ambiguity_check.py

### 用途
扫描文档中的模糊表述词汇，按严重度（high/medium）与类别（程度/时间/范围/可能性/数量/质量）分类，输出位置、上下文与修改建议。30+ 词的分级词表。

### 接口
```
python ambiguity_check.py <document.md> [--json] [--threshold N]
```

### 参数
| 参数 | 说明 |
|------|------|
| `document` | 文档路径（.md） |
| `--json` | 输出 JSON 格式 |
| `--threshold` | 高严重度模糊词阈值，超过则失败（默认 10） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 无模糊词 |
| 1 | 有少量模糊词（警告，未超阈值） |
| 2 | 大量模糊词（高严重度 ≥ threshold） |
| 3 | 参数错误（文件不存在） |

### 词表分类
| 类别 | 示例词 |
|------|--------|
| 程度 | 大概/大约/左右/差不多/尽量/尽可能/适当/相应 |
| 时间 | 尽快/及时/定期/不定期/暂时 |
| 范围 | 等/等等/之类/相关/有关/其他 |
| 可能性 | 可能/也许/或许 |
| 数量 | 一些/若干/多数/少数/大量/少量 |
| 质量 | 比较好/较好/良好/正常/合理 |

### JSON 输出示例
```json
{
  "total_findings": 5,
  "high_severity": 3,
  "medium_severity": 2,
  "by_word": {"大概": {"count": 2, "severity": "high", "category": "程度"}},
  "findings": [{"word": "大概", "line": 12, "context": "...", "suggestion": "请给出具体数值或范围"}],
  "verdict": "WARNING"
}
```

### 特殊处理
- 跳过代码块（``` 包裹的行）
- 紧邻 `[待确认]` 标注的模糊词跳过（已标记为待确认）
- 输出前 50 处详情，按词聚合统计

### 单测对应
`tests/test_scripts.py` 中 `ba-requirement-analysis/ambiguity_check.py` 条目（3 用例）：
- `missing_file`：文件不存在 → exit=3
- `draft_has_ambiguous`：草稿文档 → exit∈{0,1}，输出含 `total_findings`
- `clean_doc_passes`：无模糊词文档 → exit=0，输出含 `total_findings`
