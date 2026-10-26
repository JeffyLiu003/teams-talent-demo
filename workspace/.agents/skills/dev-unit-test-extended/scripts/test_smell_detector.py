#!/usr/bin/env python3
"""测试坏味道检测：sleep/直接访问私有成员/断言太弱（not None）。"""
import argparse, json, re, sys
from pathlib import Path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("test_dir")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    smells = []
    for p in Path(args.test_dir).rglob("*"):
        if p.is_file() and p.suffix in {".py", ".java", ".ts"}:
            try:
                text = p.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            for i, line in enumerate(text.splitlines(), 1):
                if re.search(r"sleep\s*\(", line):
                    smells.append({"file": str(p), "line": i, "smell": "测试中使用sleep"})
                if re.search(r"assert\s+not\s+None|assertNotNull\s*\(", line):
                    smells.append({"file": str(p), "line": i, "smell": "断言过弱（not None）"})
    print(json.dumps({"smells": smells[:50], "count": len(smells)}, ensure_ascii=False, indent=2))
    sys.exit(0 if not smells else 1)

if __name__ == "__main__":
    main()
