#!/usr/bin/env python3
"""性能结果分析：输入结果JSON，与目标对比，识别瓶颈信号。"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("result_json", help="结果JSON: {p95_ms, tps, error_rate, target:{p95_ms, tps}}")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        d = json.load(open(args.result_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    t = d.get("target", {})
    checks = {
        "p95_ok": d.get("p95_ms", 1e9) <= t.get("p95_ms", 1e9),
        "tps_ok": d.get("tps", 0) >= t.get("tps", 0),
        "error_rate_ok": d.get("error_rate", 1) < 0.001,
    }
    ok = all(checks.values())
    print(json.dumps({"checks": checks, "verdict": "PASS" if ok else "FAIL", "bottleneck_hint": None if ok else "建议检查资源使用率与慢查询"}, ensure_ascii=False, indent=2))
    sys.exit(0 if ok else 2)

if __name__ == "__main__":
    main()
