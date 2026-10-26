#!/usr/bin/env python3
"""部署手册完整性校验：必须含前置检查/步骤/后置验证/异常处理。"""
import argparse, json, sys

REQUIRED = ["前置检查", "部署步骤", "后置验证", "异常处理", "操作", "验证"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("runbook_md")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        text = open(args.runbook_md, encoding="utf-8").read()
    except OSError as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    missing = [k for k in REQUIRED if k not in text]
    print(json.dumps({"missing": missing, "valid": not missing}, ensure_ascii=False, indent=2))
    sys.exit(0 if not missing else 2)

if __name__ == "__main__":
    main()
