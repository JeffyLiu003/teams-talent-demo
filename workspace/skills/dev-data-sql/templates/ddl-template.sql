-- 建表模板
CREATE TABLE <schema>.<table> (
    id BIGINT PRIMARY KEY,
    <field> <type> NOT NULL,
    <sensitive_field> <type> ENCRYPTED, -- 敏感字段加密
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 索引：关键查询字段
CREATE INDEX idx_<table>_<field> ON <schema>.<table>(<field>);

---

## L3 必填深度字段

| 字段 | 要求 |
|------|------|
| 索引设计 | 关键查询索引说明 |
| 回滚 | 迁移回滚脚本 |
