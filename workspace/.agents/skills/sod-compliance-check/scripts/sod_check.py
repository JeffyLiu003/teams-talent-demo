#!/usr/bin/env python3
"""SoD冲突检测：输入角色权限与冲突矩阵，输出冲突清单。"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("config_json", help="配置JSON: {roles:{role:[permissions]}, conflicts:[[permA,permB]]}")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        d = json.load(open(args.config_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    conflicts = []
    for role, perms in d.get("roles", {}).items():
        permset = set(perms)
        for a, b in d.get("conflicts", []):
            if a in permset and b in permset:
                conflicts.append({"role": role, "pair": [a, b]})
    print(json.dumps({"conflicts": conflicts, "compliant": not conflicts}, ensure_ascii=False, indent=2))
    sys.exit(0 if not conflicts else 2)

if __name__ == "__main__":
    main()
