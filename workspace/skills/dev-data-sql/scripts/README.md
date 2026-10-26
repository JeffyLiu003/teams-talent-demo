# scripts/ — 数据层SQL技能脚本

本目录包含 `dev-data-sql` 技能的确定性校验脚本。所有脚本遵循统一接口规范：CLI 调用、JSON 输出、退出码表示结果。

## 脚本清单

| 脚本 | 用途 | 退出码 |
|------|------|--------|
| `sql_lint.py` | SQL 规范检查与性能反模式（SELECT */UPDATE 无 WHERE 等） | 0/2/3 |
| `migration_verify.py` | 迁移回滚验证：校验迁移文件含回滚脚本标记 | 0/2/3 |
| `data_diff.py` | 数据一致性比对：输入两表导出 JSON，输出差异 | 0/2/3 |

---

## sql_lint.py

### 用途
SQL 规范检查：扫描 SQL 文件，识别性能反模式与高危操作（SELECT *、UPDATE/DELETE 缺 WHERE），按严重级别输出问题清单。

### 接口
```
python sql_lint.py <sql_file> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `sql_file` | SQL 文件路径（.sql） |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 无 critical 违规（可有 major 告警） |
| 2 | 存在 critical 违规（UPDATE/DELETE 缺 WHERE） |
| 3 | 参数错误（文件不存在 / 读取失败） |

> 退出码仅由 critical 决定；major（SELECT *）告警不阻断，但建议修复。

### 检查项
1. **SELECT * 检测**：`SELECT *` 模式 → major，应显式列出字段。
2. **UPDATE/DELETE 无 WHERE 检测**：UPDATE 或 DELETE 语句不含 WHERE → critical，避免全表更新/删除。
3. **行级定位**：每条 issue 含 line、severity、rule。
4. **严重级别**：critical（阻断）与 major（告警）两级。

### 规则分级表
| 严重级别 | 规则 | 模式示例 |
|---------|------|---------|
| critical | UPDATE/DELETE 缺少 WHERE | `UPDATE t SET a=1;` |
| major | SELECT * 应显式列出字段 | `SELECT * FROM t;` |

### 输入 JSON 示例
无需输入 JSON，直接扫描 SQL 文件：
```sql
-- bad.sql
SELECT * FROM accounts;
UPDATE accounts SET balance = balance - 100;
```

### 输出 JSON 示例
```json
{
  "issues": [
    {"line": 2, "severity": "major", "rule": "SELECT * 应显式列出字段"},
    {"line": 3, "severity": "critical", "rule": "UPDATE/DELETE缺少WHERE"}
  ],
  "count": 2
}
```

### 调用示例
```bash
# 单文件检查
python skills/dev-data-sql/scripts/sql_lint.py query.sql

# critical 场景（UPDATE 无 WHERE）
python skills/dev-data-sql/scripts/sql_lint.py dangerous_update.sql

# CI 门禁（critical 为零才放行）
python skills/dev-data-sql/scripts/sql_lint.py migration.sql && echo "SQL 检查通过" || echo "存在 critical 违规"
```

### 单测对应
`tests/test_scripts.py` 中 `dev-data-sql/sql_lint.py` 条目（3 用例）：
- `update_no_where`：`UPDATE t SET a=1;` → exit=2，输出含 `critical`
- `clean_sql`：`SELECT a, b FROM t WHERE id=1;` → exit=0，输出含 `count`
- `missing_file`：文件不存在 → exit=3，输出含 `error`

---

## migration_verify.py

### 用途
迁移回滚验证：校验迁移 SQL 文件同时包含正向脚本（ALTER/CREATE TABLE）与回滚脚本（含"回滚"标记或 DROP COLUMN）。确保迁移可回滚。

### 接口
```
python migration_verify.py <migration_sql> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `migration_sql` | 迁移 SQL 文件路径（.sql） |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 迁移含正向脚本且含回滚脚本（ok=true） |
| 2 | 缺少正向脚本或回滚脚本（ok=false） |
| 3 | 参数错误（文件不存在 / 读取失败） |

### 检查项
1. **正向脚本检测**：文件含 `ALTER TABLE` 或 `CREATE TABLE`。
2. **回滚脚本检测**：文件含 `回滚`、`ROLLBACK` 或 `DROP COLUMN` 标记。
3. **ok 判定**：has_forward 与 has_rollback 均为 true 时 ok=true。

### 回滚标记识别
| 标记类型 | 示例 |
|---------|------|
| 中文标记 | `-- 回滚脚本` |
| 英文标记 | `ROLLBACK` |
| DDL 标记 | `DROP COLUMN` |

### 输入 JSON 示例
无需输入 JSON，直接扫描迁移文件：
```sql
-- migration.sql
ALTER TABLE accounts ADD COLUMN currency VARCHAR(3);
-- 回滚脚本
ALTER TABLE accounts DROP COLUMN currency;
```

### 输出 JSON 示例
```json
{
  "has_forward": true,
  "has_rollback": true,
  "ok": true
}
```

### 调用示例
```bash
# 迁移回滚验证（含回滚段）
python skills/dev-data-sql/scripts/migration_verify.py migration_with_rollback.sql

# 无回滚场景（仅 ALTER）
python skills/dev-data-sql/scripts/migration_verify.py migration_no_rollback.sql

# CI 门禁（迁移必须可回滚）
python skills/dev-data-sql/scripts/migration_verify.py migration.sql && echo "迁移可回滚" || echo "迁移缺少回滚脚本"
```

### 单测对应
`tests/test_scripts.py` 中 `dev-data-sql/migration_verify.py` 条目（3 用例）：
- `with_rollback`：ALTER + 回滚脚本 → exit=0，输出含 `ok`
- `no_rollback`：仅 ALTER TABLE → exit=2，输出含 `ok`
- `missing_file`：文件不存在 → exit=3，输出含 `error`

---

## data_diff.py

### 用途
数据一致性比对：输入源表与目标表的导出 JSON（键值对列表），输出缺失键与值不匹配键，用于迁移/ETL 后的数据对账。

### 接口
```
python data_diff.py <source_json> <target_json> [--json]
```

### 参数
| 参数 | 说明 |
|------|------|
| `source_json` | 源数据 JSON 路径，格式 `[{"key": "k1", "value": 1}, ...]` |
| `target_json` | 目标数据 JSON 路径，格式同上 |
| `--json` | 输出 JSON 格式（默认即为 JSON） |

### 退出码
| 码 | 含义 |
|----|------|
| 0 | 源目标数据一致（consistent=true） |
| 2 | 存在缺失键或不匹配键（consistent=false） |
| 3 | 参数错误（文件不存在 / JSON 解析失败） |

### 检查项
1. **键映射构建**：源与目标分别按 `key` 字段构建字典。
2. **缺失键检测**：源中存在但目标中不存在的键。
3. **值不匹配检测**：源与目标都存在但 value 不同的键。
4. **mismatched 截断**：最多输出前 20 条不匹配，避免大规模数据输出爆炸。
5. **consistent 判定**：missing 与 mismatched 均为空时 consistent=true。

### 输入 JSON 示例
源数据（source.json）：
```json
[{"key": "acct_001", "value": 1000}, {"key": "acct_002", "value": 2000}]
```
目标数据（target.json）：
```json
[{"key": "acct_001", "value": 1000}, {"key": "acct_002", "value": 1500}]
```

### 输出 JSON 示例
```json
{
  "source": 2,
  "target": 2,
  "missing": [],
  "mismatched": ["acct_002"],
  "consistent": false
}
```

### 调用示例
```bash
# 数据一致性比对（一致）
python skills/dev-data-sql/scripts/data_diff.py source.json target.json

# 缺失键场景（目标缺数据）
python skills/dev-data-sql/scripts/data_diff.py source.json incomplete_target.json

# CI 门禁（迁移后必须一致）
python skills/dev-data-sql/scripts/data_diff.py source.json target.json && echo "数据一致" || echo "数据不一致"
```

### 单测对应
`tests/test_scripts.py` 中 `dev-data-sql/data_diff.py` 条目（3 用例）：
- `consistent`：源目标数据一致 → exit=0，输出含 `consistent`
- `missing_key`：目标缺 k1 → exit=2，输出含 `missing`
- `missing_file`：目标文件不存在 → exit=3，输出含 `error`

---

## 能力边界

- 上述脚本为**轻量静态/数据校验**，不替代 DBA 专业审查与生产数据对账工具。
- `sql_lint.py` 仅检测 **SELECT * 与 UPDATE/DELETE 无 WHERE** 两类反模式；完整 SQL 审查须依赖 SQLFluff/pt-query-advisor。
- `migration_verify.py` 仅校验**回滚标记存在性**，不验证回滚脚本正确性；回滚脚本有效性须在测试库演练。
- `data_diff.py` 仅做**键值对级别的差异检测**，不处理嵌套结构/大对象/时序数据；复杂对账须依赖专业 ETL 对账工具。
- 资金类数据迁移须在 L3 档位下额外覆盖分批迁移、断点续传、余额对账（双向）、监管报送字段格式校验。
