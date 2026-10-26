#!/usr/bin/env python3
"""风险评分：概率×影响矩阵定级。"""
import argparse, json, sys

LEVEL = {"低": 1, "中": 2, "高": 3}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("risk_json", help="风险JSON: {probability, impact} 取值低/中/高")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        d = json.load(open(args.risk_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    score = LEVEL.get(d.get("probability"), 2) * LEVEL.get(d.get("impact"), 2)
    level = "低" if score <= 2 else ("中" if score <= 5 else "高")
    print(json.dumps({"score": score, "level": level}, ensure_ascii=False, indent=2))
    sys.exit(0)

if __name__ == "__main__":
    main()
