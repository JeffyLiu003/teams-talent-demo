#!/usr/bin/env python3
"""安全编码静态检查：注入/XSS/硬编码密钥/越权缺失等规则。"""
import argparse, json, re, sys
from pathlib import Path

RULES = [
    (r"SELECT\s+.*\+|f['\"].*SELECT", "SQL拼接注入", "fatal"),
    (r"innerHTML\s*=|dangerouslySetInnerHTML", "XSS风险", "critical"),
    (r"(password|secret|token)\s*=\s*['\"][^'\"]{6,}['\"]", "硬编码密钥", "fatal"),
    (r"document\.write", "DOM XSS", "critical"),
]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("target", help="代码文件或目录")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    t = Path(args.target)
    files = [t] if t.is_file() else [p for p in t.rglob("*") if p.is_file() and p.suffix in {".java", ".py", ".js", ".ts", ".sql"}]
    violations = []
    for f in files:
        try:
            text = f.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for i, line in enumerate(text.splitlines(), 1):
            for pattern, desc, sev in RULES:
                if re.search(pattern, line):
                    violations.append({"file": str(f), "line": i, "severity": sev, "rule": desc})
    print(json.dumps({"violations": violations, "count": len(violations)}, ensure_ascii=False, indent=2))
    sys.exit(0 if not any(v["severity"] in ("fatal", "critical") for v in violations) else 2)

if __name__ == "__main__":
    main()
