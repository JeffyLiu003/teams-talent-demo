#!/usr/bin/env python3
"""覆盖率缺口分析：对比总体/关键路径覆盖率。"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("coverage_json", help="覆盖率JSON: {overall, critical_paths:[{name,coverage}]}")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        d = json.load(open(args.coverage_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    gaps = [p for p in d.get("critical_paths", []) if float(p.get("coverage", 0)) < 100]
    print(json.dumps({"overall": d.get("overall"), "gaps": gaps, "all_critical_covered": not gaps}, ensure_ascii=False, indent=2))
    sys.exit(0 if not gaps else 2)

if __name__ == "__main__":
    main()
