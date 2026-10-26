#!/usr/bin/env python3
"""慢查询分析：输入慢查询列表，按执行时间排序并给建议。"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("queries_json", help="慢查询JSON: [{sql, duration_ms, scan_rows, index_used}]")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        data = json.load(open(args.queries_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    data.sort(key=lambda q: -q.get("duration_ms", 0))
    for q in data:
        q["suggestion"] = "检查索引" if not q.get("index_used") else "评估查询逻辑/分页"
    print(json.dumps({"top_slow": data[:10], "count": len(data)}, ensure_ascii=False, indent=2))
    sys.exit(0)

if __name__ == "__main__":
    main()
