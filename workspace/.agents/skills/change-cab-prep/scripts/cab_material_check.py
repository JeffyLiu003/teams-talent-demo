#!/usr/bin/env python3
"""CAB材料完整性检查。"""
import argparse, json, sys

MATERIALS = ["RFC", "风险评估", "回滚", "测试", "影响分析", "发布计划"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cab_dir", help="材料目录")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    import os
    try:
        files = os.listdir(args.cab_dir)
    except OSError as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    text = " ".join(files)
    missing = [m for m in MATERIALS if m not in text]
    print(json.dumps({"missing": missing, "complete": not missing}, ensure_ascii=False, indent=2))
    sys.exit(0 if not missing else 2)

if __name__ == "__main__":
    main()
