#!/usr/bin/env python3
"""单测质量评分：按测试独立性/断言充分性/命名规范评分。"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("quality_json", help="质量JSON: {independent, assertions_ok, naming_ok} bool")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        d = json.load(open(args.quality_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    score = int(d.get("independent")) * 40 + int(d.get("assertions_ok")) * 40 + int(d.get("naming_ok")) * 20
    print(json.dumps({"score": score, "pass": score >= 80}, ensure_ascii=False, indent=2))
    sys.exit(0 if score >= 80 else 2)

if __name__ == "__main__":
    main()
