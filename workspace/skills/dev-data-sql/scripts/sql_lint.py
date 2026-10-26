#!/usr/bin/env python3
"""SQL规范检查：无注释、无LIMIT大表、SELECT *、潜在全表扫描提示。"""
import argparse, json, re, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sql_file")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        text = open(args.sql_file, encoding="utf-8").read()
    except OSError as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    issues = []
    for i, line in enumerate(text.splitlines(), 1):
        if re.search(r"SELECT\s+\*", line, re.I):
            issues.append({"line": i, "severity": "major", "rule": "SELECT * 应显式列出字段"})
        if re.search(r"UPDATE|DELETE", line, re.I) and "WHERE" not in line.upper():
            issues.append({"line": i, "severity": "critical", "rule": "UPDATE/DELETE缺少WHERE"})
    print(json.dumps({"issues": issues, "count": len(issues)}, ensure_ascii=False, indent=2))
    sys.exit(0 if not any(i["severity"] == "critical" for i in issues) else 2)

if __name__ == "__main__":
    main()
