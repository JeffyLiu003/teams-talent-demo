# scripts/ — 验收标准技能脚本

本目录包含 `ba-acceptance-criteria` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `rtm_check.py` | 需求追溯矩阵（RTM）校验：故事↔需求关联、孤儿需求检测、验收结构完整性 | 0/1/2/3 |

---

## rtm_check.py

### 用途
校验用户故事文档与需求说明书之间的追溯关系完整性。检测三类问题：(1) 故事引用了不存在于需求文档中的 REQ 编号（未关联故事）；(2) 需求文档中的 REQ 编号未被任何故事覆盖（孤儿需求）；(3) 故事缺少 Given/When/Then 验收结构。

### 接口
```
python rtm_check.py <requirement_doc.md> <stories_doc.md> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `requirement_doc` | 需求说明书路径（.md），须含 `REQ-xxx` 格式的功能需求编号 |
| `stories_doc` | 用户故事文档路径（.md），须含 `US-xxx` 格式的故事标题 |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 全部通过（所有故事已关联、无孤儿需求、验收结构完整） |
| 1 | 警告（故事缺少 Given/When/Then 验收结构，但关联关系正确） |
| 2 | 失败（存在未关联故事或孤儿需求） |
| 3 | 参数错误（文件不存在 / 未找到 REQ 编号 / 未找到 US 故事） |

> 退出码优先级：未关联或孤儿（2） > 验收结构缺失（1） > 通过（0）。即同时存在关联问题与结构缺失时，返回 2。

### 检查项
1. **REQ 编号提取**：从需求文档中提取所有 `REQ-xxx`（三位数字）编号，保持出现顺序。仅匹配三位数字格式（REQ-001），避免误匹配文档编号（REQ-2026-xxxx）。
2. **故事切分**：按 `US-xxx` 标题（Markdown 标题级别 2-4）切分故事区块，每个区块独立校验。
3. **关联校验**：每条故事区块内提取 REQ 编号，与需求文档中的 REQ 列表比对。未匹配到任何有效 REQ 的故事标记为"未关联"。
4. **孤儿需求检测**：需求文档中未被任何故事引用的 REQ 编号标记为"孤儿需求"。
5. **验收结构检查**：每条故事区块检查是否包含 Given（前置条件/Given）、When（操作/When）、Then（预期结果/Then）三要素。支持中英文标记。

### REQ 编号格式
- 匹配模式：`REQ-\d{3}`（如 REQ-001、REQ-002）
- 不匹配：REQ-2026-001（避免误匹配文档编号）
- 故事标题模式：`US-\d+`（如 US-1、US-001）

### 验收结构标记
脚本识别以下标记（中英文均可）：
| 要素 | 中文标记 | 英文标记 |
|------|---------|---------|
| Given（前置条件） | 前置条件 | Given |
| When（操作） | 操作 | When |
| Then（预期结果） | 预期结果 | Then |

### JSON 输出示例
```json
{
  "total_stories": 5,
  "linked": 4,
  "unlinked": [
    {
      "story_id": "US-005",
      "found_reqs": ["REQ-999"],
      "reason": "未关联到需求文档中的有效REQ编号"
    }
  ],
  "orphan_stories": ["REQ-003"],
  "stories_without_acceptance": [
    {"story_id": "US-003", "missing": ["given", "then"]}
  ],
  "requirement_ids": ["REQ-001", "REQ-002", "REQ-003"]
}
```

### 调用示例
```bash
# 基本校验
python skills/ba-acceptance-criteria/scripts/rtm_check.py 需求说明书.md 用户故事.md

# JSON 输出（供 Agent 消费）
python skills/ba-acceptance-criteria/scripts/rtm_check.py 需求说明书.md 用户故事.md --json

# CI 门禁（退出码驱动）
python skills/ba-acceptance-criteria/scripts/rtm_check.py 需求说明书.md 用户故事.md && echo "RTM校验通过" || echo "RTM校验失败"
```

### 单测对应
`tests/test_scripts.py` 中 `ba-acceptance-criteria/rtm_check.py` 条目（3 用例）：
- `linked_stories`：故事正确关联需求 → exit=0，输出含 `linked`
- `unlinked_story_fails`：故事引用不存在的REQ → exit=2，输出含 `unlinked`
- `missing_file`：文件不存在 → exit=3，输出含 `error`
