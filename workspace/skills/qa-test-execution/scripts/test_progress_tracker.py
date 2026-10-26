#!/usr/bin/env python3
"""测试进度跟踪：输入执行结果JSON，输出汇总。"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("results_json", help="执行结果JSON: [{id,status}] status in 通过/失败/阻塞/未执行")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        data = json.load(open(args.results_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    total = len(data)
    counts = {}
    for r in data:
        counts[r.get("status")] = counts.get(r.get("status"), 0) + 1
    executed = total - counts.get("未执行", 0)
    report = {"total": total, "counts": counts, "executed_rate": round(executed / total, 4) if total else 0,
              "pass_rate": round(counts.get("通过", 0) / executed, 4) if executed else 0}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    sys.exit(0)

if __name__ == "__main__":
    main()
