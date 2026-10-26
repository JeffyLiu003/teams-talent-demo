# scripts/ — 发布计划技能脚本

本目录包含 `release-plan` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `build_verify.py` | 制品指纹校验：比对 artifact 与 build 记录的 sha256，确保发布制品与构建产物一致 | 0/2/3 |

---

## build_verify.py

### 用途
校验待发布制品的 sha256 指纹与构建记录中的 sha256 是否一致，防止制品被篡改或构建记录与实际制品不符。是发布前确定性门禁，确保"构建即发布"的完整性。

### 接口
```
python build_verify.py <verify_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `verify_json` | 含 artifact 与 build 指纹的 JSON 路径，结构为 `{artifact:{name,sha256}, build:{sha256}}` |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 指纹一致（match=true，制品可发布） |
| 2 | 指纹不一致或缺失（match=false，禁止发布） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

> 退出码判定：`artifact.sha256` 与 `build.sha256` 均存在且完全相等时返回 0；任一缺失或不等返回 2。

### 检查项
1. **JSON 解析**：读取校验文件，解析失败返回退出码 3。
2. **指纹提取**：从 `artifact.sha256` 与 `build.sha256` 提取指纹。
3. **一致性比对**：两个 sha256 均非空且字符串完全相等时 `match=true`。
4. **结论输出**：`match=true` → 退出码 0；`match=false` → 退出码 2。

### 输入 JSON 示例
```json
{
  "artifact": {"name": "payment-svc-1.2.3.jar", "sha256": "a1b2c3d4e5f6..."},
  "build": {"sha256": "a1b2c3d4e5f6..."}
}
```

### JSON 输出示例
```json
{
  "artifact_sha": "a1b2c3d4e5f6...",
  "build_sha": "a1b2c3d4e5f6...",
  "match": true
}
```

### 调用示例
```bash
# 基本校验（人类可读 JSON）
python skills/release-plan/scripts/build_verify.py verify.json

# JSON 输出（供 Agent 消费）
python skills/release-plan/scripts/build_verify.py verify.json --json

# CI 门禁（指纹不符则阻断发布）
python skills/release-plan/scripts/build_verify.py verify.json && echo "制品指纹校验通过" || echo "制品指纹不符，禁止发布"
```

### 能力边界
- 仅校验 sha256 字符串相等性，不计算文件实际哈希（哈希由构建系统产出）。
- 不校验 sha256 长度或格式合法性（非空且相等即视为一致）。
- 不比对制品名称或版本号，仅比对指纹。
- 不追溯构建链路（如多次构建的指纹历史），仅校验当前两条记录。
- 不调用构建系统 API，仅消费已产出的 JSON 文件。

### 单测对应
`tests/test_scripts.py` 中 `release-plan/build_verify.py` 条目（3 用例）：
- `matching_fingerprint`：artifact 与 build 的 sha256 均为 "abc" → exit=0，输出含 `match`
- `mismatch_fails`：artifact sha256="abc"，build sha256="def" → exit=2，输出含 `match`
- `missing_file`：文件不存在 → exit=3，输出含 `error`
