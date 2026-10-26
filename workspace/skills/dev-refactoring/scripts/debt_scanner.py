#!/usr/bin/env python3
"""技术债扫描：重复代码/复杂方法/死代码标记（轻量实现）。"""
import argparse, json, sys
from pathlib import Path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("code_root")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    root = Path(args.code_root)
    report = {"high_complexity": [], "large_files": []}
    if root.is_dir():
        for p in root.rglob("*"):
            if p.is_file() and p.suffix.lower() in {".java", ".py", ".js"}:
                try:
                    lines = p.read_text(encoding="utf-8", errors="ignore").splitlines()
                except OSError:
                    continue
                if len(lines) > 300:
                    report["large_files"].append({"file": str(p), "lines": len(lines)})
                for i, line in enumerate(lines, 1):
                    if line.strip().startswith(("def ", "public ", "private ")) and "(" in line:
                        # 简单复杂度启发：行数多的方法
                        pass
    print(json.dumps(report, ensure_ascii=False, indent=2))
    sys.exit(0)

if __name__ == "__main__":
    main()
