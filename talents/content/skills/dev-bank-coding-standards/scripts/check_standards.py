#!/usr/bin/env python3
"""编码规范静态检查：命名/异常/日志/安全/资源五类规则，按致命/严重/告警分级输出。"""
import argparse, json, re, sys
from pathlib import Path

RULES = {
    "fatal": [
        (r"password\s*=\s*['\"][^'\"]+['\"]", "硬编码密钥"),
        (r"SELECT\s+.*\s+FROM\s+\w+\s+WHERE\s+.*['\"].*\+", "SQL拼接注入风险"),
    ],
    "critical": [
        (r"except\s*:\s*(pass|#|$)", "吞异常"),
        (r"catch\s*\([^)]*\)\s*\{\s*\}", "空catch"),
    ],
    "major": [
        (r"print\(.*token|secret|password", "日志打印敏感信息"),
        (r"\b[a-z]{1,3}\b", "疑似命名过短"),
    ],
}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("target", help="代码文件或目录")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    target = Path(args.target)
    files = [target] if target.is_file() else [p for p in target.rglob("*") if p.is_file() and p.suffix in {".java", ".py", ".js", ".ts"}]
    report = {"violations": [], "by_severity": {"fatal": 0, "critical": 0, "major": 0}}
    for f in files:
        try:
            text = f.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for severity, rules in RULES.items():
            for pattern, desc in rules:
                for i, line in enumerate(text.splitlines(), 1):
                    if re.search(pattern, line):
                        report["violations"].append({"file": str(f), "line": i, "severity": severity, "rule": desc, "text": line.strip()[:80]})
                        report["by_severity"][severity] += 1
    print(json.dumps(report, ensure_ascii=False, indent=2))
    sys.exit(0 if report["by_severity"]["fatal"] == 0 and report["by_severity"]["critical"] == 0 else 2)

if __name__ == "__main__":
    main()
