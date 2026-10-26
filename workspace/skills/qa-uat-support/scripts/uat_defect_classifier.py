#!/usr/bin/env python3
"""UAT问题分类：缺陷/需求变更/操作问题。"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("issue_json", help="问题JSON: {title, description}")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        d = json.load(open(args.issue_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    text = d.get("title", "") + d.get("description", "")
    if any(k in text for k in ["不会用", "怎么操作", "不懂"]):
        category = "操作问题"
    elif any(k in text for k in ["希望", "增加", "变更", "需求"]):
        category = "需求变更"
    else:
        category = "缺陷"
    print(json.dumps({"category": category}, ensure_ascii=False, indent=2))
    sys.exit(0)

if __name__ == "__main__":
    main()
