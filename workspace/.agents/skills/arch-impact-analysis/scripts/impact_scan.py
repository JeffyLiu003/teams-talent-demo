#!/usr/bin/env python3
"""扫描代码目录中引用指定变更点（模块/接口/表名）的文件列表。"""
import argparse, json, sys
from pathlib import Path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("code_root", help="代码根目录")
    ap.add_argument("--keywords", nargs="*", default=[], help="变更点关键词")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    root = Path(args.code_root)
    if not root.is_dir():
        print(json.dumps({"error": f"目录不存在: {root}"}, ensure_ascii=False)); sys.exit(3)
    hits = {}
    for p in root.rglob("*"):
        if p.is_file() and p.suffix.lower() in {".java", ".py", ".xml", ".yml", ".yaml", ".sql", ".ts", ".js", ".vue"}:
            try:
                text = p.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            found = [k for k in args.keywords if k in text]
            if found:
                hits[str(p)] = found
    print(json.dumps({"total_files": len(hits), "hits": hits}, ensure_ascii=False, indent=2))
    sys.exit(0)

if __name__ == "__main__":
    main()
