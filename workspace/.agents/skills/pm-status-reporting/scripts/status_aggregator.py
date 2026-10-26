#!/usr/bin/env python3
"""状态汇总：输入计划/实际数据，计算偏差。"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data_json", help="数据JSON: {items:[{name, planned, actual}]}")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        data = json.load(open(args.data_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    items = []
    for it in data.get("items", []):
        try:
            delta = float(it.get("actual", 0)) - float(it.get("planned", 0))
        except (TypeError, ValueError):
            delta = None
        items.append({"name": it.get("name"), "delta": delta, "deviation": bool(delta is not None and abs(delta) > 0)})
    print(json.dumps({"items": items, "deviations": sum(1 for i in items if i["deviation"])}, ensure_ascii=False, indent=2))
    sys.exit(0)

if __name__ == "__main__":
    main()
