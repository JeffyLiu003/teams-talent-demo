#!/usr/bin/env python3
"""对比新旧需求文档差异，输出差异点。"""
import argparse, difflib, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("old_doc")
    ap.add_argument("new_doc")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        old = open(args.old_doc, encoding="utf-8").read().splitlines()
        new = open(args.new_doc, encoding="utf-8").read().splitlines()
    except OSError as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    diff = list(difflib.unified_diff(old, new, lineterm="", n=1))
    changed = [ln for ln in diff if ln.startswith(("+", "-")) and not ln.startswith(("+++", "---"))]
    print(json.dumps({"diff_lines": len(changed), "sample": changed[:20]}, ensure_ascii=False, indent=2))
    sys.exit(0 if changed else 0)

if __name__ == "__main__":
    main()
