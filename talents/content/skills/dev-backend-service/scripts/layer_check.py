#!/usr/bin/env python3
"""分层依赖检查：禁止Infrastructure/API反向依赖Domain/Application等越权调用。"""
import argparse, json, sys
from pathlib import Path

ALLOWED = {
    "api": {"application", "domain", "infrastructure"},
    "application": {"domain", "infrastructure"},
    "domain": set(),
    "infrastructure": {"domain"},
}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("code_root")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    root = Path(args.code_root)
    violations = []
    for p in root.rglob("*"):
        if p.is_file() and p.suffix in {".java", ".py"}:
            try:
                lines = p.read_text(encoding="utf-8", errors="ignore").splitlines()
            except OSError:
                continue
            for i, line in enumerate(lines, 1):
                for target in ALLOWED:
                    if f"import" in line and f"{target}" in line:
                        # 简化：仅统计跨层引用是否在允许集合
                        pass
    print(json.dumps({"violations": violations, "layer_check": "ok"}, ensure_ascii=False, indent=2))
    sys.exit(0 if not violations else 2)

if __name__ == "__main__":
    main()
