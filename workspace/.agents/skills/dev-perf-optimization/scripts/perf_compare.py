#!/usr/bin/env python3
"""优化前后基准对比：输入before/after JSON，输出提升率。"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("before_json", help="基准JSON: {tps, p95_ms}")
    ap.add_argument("after_json")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        before = json.load(open(args.before_json, encoding="utf-8"))
        after = json.load(open(args.after_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    def pct(a, b):
        try:
            return round((b - a) / a * 100, 1) if a else None
        except TypeError:
            return None
    report = {
        "tps_improvement": pct(before.get("tps"), after.get("tps")),
        "p95_improvement": pct(before.get("p95_ms"), after.get("p95_ms")),
        "improved": (after.get("tps", 0) >= before.get("tps", 0)) and (after.get("p95_ms", 1e9) <= before.get("p95_ms", 1e9)),
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    sys.exit(0 if report["improved"] else 1)

if __name__ == "__main__":
    main()
