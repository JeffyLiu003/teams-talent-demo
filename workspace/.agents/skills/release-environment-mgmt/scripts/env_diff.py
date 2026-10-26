#!/usr/bin/env python3
"""多环境配置对比：输入{env:{key:value}}，输出差异。"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("config_json", help="配置JSON: {env:{key:value}}")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        data = json.load(open(args.config_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    keys = sorted({k for env in data.values() for k in env})
    diffs = []
    for k in keys:
        vals = {env: v.get(k) for env, v in data.items()}
        if len(set(str(v) for v in vals.values())) > 1:
            diffs.append({"key": k, "values": vals})
    print(json.dumps({"diffs": diffs, "drift": len(diffs) > 0}, ensure_ascii=False, indent=2))
    sys.exit(0 if not diffs else 1)

if __name__ == "__main__":
    main()
