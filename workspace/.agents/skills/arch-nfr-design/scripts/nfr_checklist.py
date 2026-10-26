#!/usr/bin/env python3
"""NFR维度完整性检查。"""
import argparse, json, sys

DIMENSIONS = ["性能", "可用性", "安全", "可扩展", "可维护", "合规"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("nfr_md")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        text = open(args.nfr_md, encoding="utf-8").read()
    except OSError as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    missing = [d for d in DIMENSIONS if d not in text]
    print(json.dumps({"missing": missing, "complete": not missing}, ensure_ascii=False, indent=2))
    sys.exit(0 if not missing else 2)

if __name__ == "__main__":
    main()
