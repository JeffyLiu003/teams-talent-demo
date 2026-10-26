#!/usr/bin/env python3
"""用例去重：基于标题/步骤哈希检测重复用例。"""
import argparse, hashlib, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cases_json", help="用例JSON: [{id, title, steps}]")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        data = json.load(open(args.cases_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    seen, dup = {}, []
    for c in data:
        key = hashlib.md5((c.get("title", "") + "|" + " ".join(c.get("steps", []))).encode()).hexdigest()
        if key in seen:
            dup.append({"id": c.get("id"), "duplicate_of": seen[key]})
        else:
            seen[key] = c.get("id")
    print(json.dumps({"duplicates": dup, "count": len(dup)}, ensure_ascii=False, indent=2))
    sys.exit(0 if not dup else 1)

if __name__ == "__main__":
    main()
