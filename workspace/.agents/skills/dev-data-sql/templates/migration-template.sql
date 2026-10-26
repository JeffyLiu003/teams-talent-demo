-- 增量迁移（版本化）
BEGIN;
ALTER TABLE <schema>.<table> ADD COLUMN <field> <type>;
-- 数据回填（可选）
COMMIT;

-- 回滚脚本
-- ALTER TABLE <schema>.<table> DROP COLUMN <field>;

---

## L3 必填深度字段

| 字段 | 要求 |
|------|------|
| 索引设计 | 关键查询索引说明 |
| 回滚 | 迁移回滚脚本 |
