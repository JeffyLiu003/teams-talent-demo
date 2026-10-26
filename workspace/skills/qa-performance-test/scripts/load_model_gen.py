#!/usr/bin/env python3
"""负载模型生成：按场景比例与目标TPS生成加压模型。"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scenario_json", help="场景JSON: {target_tps, scenarios:[{name,ratio}]}")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        d = json.load(open(args.scenario_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    total_ratio = sum(s.get("ratio", 0) for s in d.get("scenarios", [])) or 1
    model = []
    for s in d.get("scenarios", []):
        model.append({"name": s.get("name"), "tps": round(d.get("target_tps", 0) * s.get("ratio", 0) / total_ratio, 2)})
    print(json.dumps({"load_model": model}, ensure_ascii=False, indent=2))
    sys.exit(0)

if __name__ == "__main__":
    main()
