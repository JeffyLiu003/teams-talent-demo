#!/usr/bin/env python3
"""变更风险分级建议：按影响面/窗口/回滚完整性打分。"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("assessment_json", help="评估JSON: {impact_scope, failure_likelihood, has_rollback, has_emergency}")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        d = json.load(open(args.assessment_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    score = 0
    score += {"低": 0, "中": 1, "高": 2}.get(d.get("impact_scope"), 1)
    score += {"低": 0, "中": 1, "高": 2}.get(d.get("failure_likelihood"), 1)
    if not d.get("has_rollback"): score += 1
    if not d.get("has_emergency"): score += 1
    level = "低" if score <= 1 else ("中" if score <= 3 else "高")
    print(json.dumps({"score": score, "level": level, "suggested": level}, ensure_ascii=False, indent=2))
    sys.exit(0)

if __name__ == "__main__":
    main()
