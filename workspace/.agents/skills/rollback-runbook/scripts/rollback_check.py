#!/usr/bin/env python3
"""校验回滚手册完整性：必须含回退点/步骤/验证/责任人。"""
import argparse, json, sys

REQUIRED = ["回滚", "步骤", "验证", "责任人", "时限"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("rollback_md", help="回滚手册路径")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        text = open(args.rollback_md, encoding="utf-8").read()
    except OSError as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    missing = [k for k in REQUIRED if k not in text]
    print(json.dumps({"missing": missing, "complete": not missing}, ensure_ascii=False, indent=2))
    sys.exit(0 if not missing else 2)

if __name__ == "__main__":
    main()
