#!/usr/bin/env python3
"""缺陷严重级别初判：按影响关键词与模块。"""
import argparse, json, sys

CRITICAL = ["资金", "交易丢失", "重复扣款", "越权", "生产", "数据丢失"]
MAJOR = ["主流程", "无法登录", "核心功能", "阻塞"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("defect_json", help="缺陷JSON: {title, description, module}")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        d = json.load(open(args.defect_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    text = (d.get("title", "") + d.get("description", "") + d.get("module", ""))
    if any(k in text for k in CRITICAL): level = "致命"
    elif any(k in text for k in MAJOR): level = "严重"
    else: level = "一般"
    print(json.dumps({"suggested_severity": level, "priority": {"致命": "P0", "严重": "P1", "一般": "P2"}[level]}, ensure_ascii=False, indent=2))
    sys.exit(0)

if __name__ == "__main__":
    main()
