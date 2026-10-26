#!/usr/bin/env python3
"""迁移回滚验证：校验迁移文件含回滚脚本标记。"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("migration_sql")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        text = open(args.migration_sql, encoding="utf-8").read()
    except OSError as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    has_forward = "ALTER TABLE" in text or "CREATE TABLE" in text
    has_rollback = "回滚" in text or "ROLLBACK" in text.upper() or "DROP COLUMN" in text
    print(json.dumps({"has_forward": has_forward, "has_rollback": has_rollback, "ok": has_forward and has_rollback}, ensure_ascii=False, indent=2))
    sys.exit(0 if has_forward and has_rollback else 2)

if __name__ == "__main__":
    main()
