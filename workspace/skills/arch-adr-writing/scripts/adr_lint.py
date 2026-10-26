#!/usr/bin/env python3
"""ADR格式与完整性检查。"""
import argparse, json, sys

REQUIRED = ["背景", "决策", "后果", "状态"]
ALTERNATIVES = [("备选方案", "候选方案")]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("adr_md")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        text = open(args.adr_md, encoding="utf-8").read()
    except OSError as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    missing = [k for k in REQUIRED if k not in text]
    for group in ALTERNATIVES:
        if not any(k in text for k in group):
            missing.append(group[0] + "/" + group[1])
    print(json.dumps({"missing": missing, "valid": not missing}, ensure_ascii=False, indent=2))
    sys.exit(0 if not missing else 2)

if __name__ == "__main__":
    main()
