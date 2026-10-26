#!/usr/bin/env python3
"""从ALM/CI/ITSM模拟采集门禁状态（本地用状态JSON代替），输出门禁清单。"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("status_json", help="门禁状态JSON: {G1:{status,approver}, ...}")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        data = json.load(open(args.status_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    missing = [g for g, v in data.items() if v.get("status") not in ("通过", "PASS")]
    report = {"gates": data, "missing": missing, "all_passed": not missing}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    sys.exit(0 if not missing else 2)

if __name__ == "__main__":
    main()
