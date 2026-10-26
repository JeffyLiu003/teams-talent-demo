#!/usr/bin/env python3
"""回归用例选择：按影响模块与风险等级输出用例清单。"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("selector_json", help="选择JSON: {risk_level, affected_modules:[], cases:{module:[id]}}")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        d = json.load(open(args.selector_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    selected = []
    for m in d.get("affected_modules", []):
        selected.extend(d.get("cases", {}).get(m, []))
    if d.get("risk_level") == "高":
        for cases in d.get("cases", {}).values():
            selected.extend(cases)
    selected = sorted(set(selected))
    print(json.dumps({"risk_level": d.get("risk_level"), "selected": selected, "count": len(selected)}, ensure_ascii=False, indent=2))
    sys.exit(0)

if __name__ == "__main__":
    main()
