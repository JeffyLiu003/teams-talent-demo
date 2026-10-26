#!/usr/bin/env python3
"""敏感信息扫描与脱敏。输入文本文件，输出脱敏后文本与报告。"""
import argparse, json, re, sys

PATTERNS = {
    "手机号": (r"1[3-9]\d{9}", lambda m: m.group(0)[:3] + "****" + m.group(0)[-4:]),
    "身份证": (r"\d{17}[\dXx]", lambda m: m.group(0)[:6] + "********" + m.group(0)[-4:]),
    "密钥": (r"(AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,})", lambda m: "***REDACTED***"),
}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input_file")
    ap.add_argument("--output", help="脱敏后输出文件")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        text = open(args.input_file, encoding="utf-8").read()
    except OSError as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    hits = {k: 0 for k in PATTERNS}
    blocked = False
    def repl(kind, fn):
        nonlocal blocked
        def _r(m):
            nonlocal blocked
            hits[kind] += 1
            if kind == "密钥":
                blocked = True
            return fn(m)
        return _r
    for kind, (pattern, fn) in PATTERNS.items():
        text = re.sub(pattern, repl(kind, fn), text)
    if args.output:
        open(args.output, "w", encoding="utf-8").write(text)
    report = {"hits": hits, "blocked": blocked}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    sys.exit(2 if blocked else 0)

if __name__ == "__main__":
    main()
