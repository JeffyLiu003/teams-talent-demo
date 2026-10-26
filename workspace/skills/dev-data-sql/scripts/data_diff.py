#!/usr/bin/env python3
"""数据一致性比对：输入两表导出JSON，输出差异。"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source_json", help="源数据JSON: [{key, value}]")
    ap.add_argument("target_json", help="目标数据JSON")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        src = json.load(open(args.source_json, encoding="utf-8"))
        tgt = json.load(open(args.target_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    smap = {r.get("key"): r for r in src}
    tmap = {r.get("key"): r for r in tgt}
    missing = [k for k in smap if k not in tmap]
    mismatched = [k for k in smap if k in tmap and smap[k] != tmap[k]]
    print(json.dumps({"source": len(src), "target": len(tgt), "missing": missing, "mismatched": mismatched[:20], "consistent": not missing and not mismatched}, ensure_ascii=False, indent=2))
    sys.exit(0 if not missing and not mismatched else 2)

if __name__ == "__main__":
    main()
