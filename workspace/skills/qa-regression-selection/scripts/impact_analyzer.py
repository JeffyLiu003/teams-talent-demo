#!/usr/bin/env python3
"""回归影响分析：输入变更文件清单，匹配模块映射，输出影响模块。"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("change_json", help="变更JSON: {files:[path], module_map:{module:[keyword]}}")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        d = json.load(open(args.change_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    affected = set()
    for f in d.get("files", []):
        for module, keywords in d.get("module_map", {}).items():
            if any(k in f for k in keywords):
                affected.add(module)
    print(json.dumps({"affected_modules": sorted(affected)}, ensure_ascii=False, indent=2))
    sys.exit(0)

if __name__ == "__main__":
    main()
