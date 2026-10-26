-- 取自 docs/design/05-api-catalog.md §0 的种子用户；密码为 PBKDF2-HMAC-SHA256 哈希（ADR-008），不得明文入库。
-- 明文仅用于本地演示：ADMIN001 / admin123，USER0001 / user1234。
INSERT INTO sec_user (user_id, first_name, last_name, password_hash, user_type, version)
VALUES ('ADMIN001', 'System', 'Administrator',
        'pbkdf2$210000$n25aKv4JuPM8wKaNo/11KQ==$jz7ISZRkT3GCAw5Bp7Bz9qnh/f1X9fRUavGfTgJhrB8=',
        'A', 0),
       ('USER0001', 'Demo', 'User',
        'pbkdf2$210000$79MTjMtdOCgD2yOF5nN8dg==$HY//zJddGDTuCNvn51tENgtN/5C4ej/NJCfBG85OfeY=',
        'U', 0);
