#!/usr/bin/env python3
"""覆盖率审核：总体+关键路径双重门禁。"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("coverage_json", help="覆盖率JSON: {overall, critical_paths:[{name,coverage}]}")
    ap.add_argument("--overall_threshold", type=float, default=80.0)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        d = json.load(open(args.coverage_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    overall_ok = float(d.get("overall", 0)) >= args.overall_threshold
    gaps = [p for p in d.get("critical_paths", []) if float(p.get("coverage", 0)) < 100]
    ok = overall_ok and not gaps
    print(json.dumps({"overall_ok": overall_ok, "critical_gaps": gaps, "pass": ok}, ensure_ascii=False, indent=2))
    sys.exit(0 if ok else 2)

if __name__ == "__main__":
    main()
