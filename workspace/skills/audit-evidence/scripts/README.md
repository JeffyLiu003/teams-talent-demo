# scripts/ — 审计证据技能脚本

本目录包含 `audit-evidence` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `trace_check.py` | 校验全链路 ID 链完整性与链接有效性（ID 非空 + URL 格式校验） | 0/2/3 |

---

## trace_check.py

### 用途
校验审计证据包的全链路 ID 链完整性与链接有效性。输入证据包 JSON（`{chain:[{stage,id,url}]}`），输出链总数、缺失 ID 列表、失效链接列表与链完整性结论。

### 接口
```
python trace_check.py <evidence_json> [--check-urls] [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `evidence_json` | 证据包 JSON 路径，结构为 `{"chain": [{"stage": "环节名", "id": "ID", "url": "链接"}, ...]}` |
| `--check-urls` | 启用链接校验：检查 `url` 字段是否为合法 http/https URL（默认不校验链接） |
| `--json` | 显式声明 JSON 输出（脚本默认即输出 JSON，此参数为接口一致性保留） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 链完整（无缺失 ID，无失效链接） |
| 2 | 链不完整（存在缺失 ID 或失效链接） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 注意：本脚本无退出码 1（无警告级别）。任何缺失或失效即视为失败（exit=2）。

### 输入 JSON 结构
```json
{
  "chain": [
    {"stage": "需求", "id": "REQ-2026-0001", "url": "https://rm.example.com/req/REQ-2026-0001"},
    {"stage": "故事", "id": "US-001", "url": "https://agile.example.com/us/US-001"},
    {"stage": "MR",   "id": "MR-789", "url": "https://git.example.com/merge/MR-789"},
    {"stage": "测试", "id": "TC-001", "url": "https://test.example.com/case/TC-001"},
    {"stage": "变更", "id": "CHG-012", "url": "https://change.example.com/rfc/CHG-012"},
    {"stage": "发布", "id": "REL-034", "url": "https://release.example.com/rel/REL-034"},
    {"stage": "复核", "id": "PIR-005", "url": "https://pir.example.com/report/PIR-005"}
  ]
}
```

字段说明：
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `chain` | array | 是 | 工件链数组，每个元素代表一个 SDLC 环节 |
| `stage` | string | 是 | 环节名称（需求/故事/MR/测试/变更/发布/复核） |
| `id` | string | 是 | 工件 ID（如 `REQ-2026-0001`），空字符串视为缺失 |
| `url` | string | 否 | 工件链接，仅当 `--check-urls` 启用时校验 |

### 检查项
1. **ID 非空校验**：`chain` 中每个元素的 `id` 字段非空字符串；空字符串计入 `missing_ids`
2. **链接格式校验**（仅 `--check-urls` 启用时）：`url` 字段非空且匹配 `^https?://` 正则；不合法计入 `broken_links`

### 输出 JSON 结构
```json
{
  "total": 7,
  "missing_ids": [
    {"stage": "变更", "id": ""}
  ],
  "broken_links": ["发布"],
  "chain_complete": false
}
```

字段说明：
| 字段 | 类型 | 说明 |
|------|------|------|
| `total` | int | `chain` 数组长度（参与校验的工件总数） |
| `missing_ids` | array | ID 为空的工件列表（含 `stage` 与空 `id`） |
| `broken_links` | array | 链接失效的环节名列表（仅 `--check-urls` 启用时填充；未启用时为空数组） |
| `chain_complete` | bool | `missing_ids` 与 `broken_links` 均为空时为 `true` |

### 调用示例
```bash
# 基本校验（仅校验 ID 非空，不校验链接）
python skills/audit-evidence/scripts/trace_check.py evidence.json

# 含链接格式校验
python skills/audit-evidence/scripts/trace_check.py evidence.json --check-urls

# JSON 输出（供门禁自动化消费）
python skills/audit-evidence/scripts/trace_check.py evidence.json --json
```

### 完整通过示例
输入 `evidence.json`：
```json
{"chain": [{"stage": "需求", "id": "REQ-001"}, {"stage": "故事", "id": "US-001"}]}
```
输出：
```json
{
  "total": 2,
  "missing_ids": [],
  "broken_links": [],
  "chain_complete": true
}
```
退出码：`0`

### 缺失 ID 示例
输入 `evidence.json`：
```json
{"chain": [{"stage": "需求", "id": ""}, {"stage": "故事", "id": "US-001"}]}
```
输出：
```json
{
  "total": 2,
  "missing_ids": [{"stage": "需求", "id": ""}],
  "broken_links": [],
  "chain_complete": false
}
```
退出码：`2`

### 文件不存在示例
```bash
python trace_check.py nope.json
```
输出：
```json
{"error": "[Errno 2] No such file or directory: 'nope.json'"}
```
退出码：`3`

### 能力边界（重要）

当前 `trace_check.py` 实现的校验范围与未覆盖项：

| 能力 | 是否支持 | 说明 |
|------|---------|------|
| ID 非空校验 | 支持 | `id` 字段为空字符串即计入 `missing_ids` |
| URL 格式校验（http/https 前缀） | 支持（`--check-urls`） | 仅校验前缀正则，不发起 HTTP 请求 |
| URL 实际可达性（HTTP 请求） | **不支持** | 当前实现未发起 HTTP 请求验证可达性，仅校验 URL 字符串格式 |
| ID 编码规范校验（前缀/年份/序列） | **不支持** | 仅校验非空，不校验 ID 是否符合 `references/id-conventions.md` 规范 |
| 相邻环节 ID 关联校验（如 US→REQ） | **不支持** | 仅逐项校验，不校验跨环节关联 |
| 缺失原因输出 | **不支持** | 输出仅含缺失项列表，不含原因字段；L3 要求的"缺失原因分类"须在证据包 Markdown 中人工填写 |
| 替代证据登记 | **不支持** | 脚本不参与替代证据判定，须在证据包中人工登记 |
| 按需求/变更单追溯索引 | **不支持** | 脚本不生成追溯索引，须在证据包中人工构建 |

> L3 实施级要求的全链路 ID 矩阵、缺失原因分类、替代证据登记、追溯索引等深度字段，均须在 `templates/evidence-pack.md` 中人工填写并经合规确认，脚本不参与判定。后续版本规划支持缺失原因字段与 ID 编码规范校验。

### 单测对应
`tests/test_scripts.py` 中 `audit-evidence/trace_check.py` 条目（3 用例）：
- `complete_chain`：完整链路（2 环节均含 ID）→ exit=0，输出含 `chain_complete`
- `missing_id`：缺失 ID（1 环节 ID 为空）→ exit=2，输出含 `missing_ids`
- `missing_file`：文件不存在 → exit=3，输出含 `error`
