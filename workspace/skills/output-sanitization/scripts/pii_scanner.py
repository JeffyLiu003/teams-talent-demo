#!/usr/bin/env python3
"""PII识别：扫描文本中的个人敏感信息并统计。"""
import argparse, json, re, sys

PII = {
    "手机号": r"1[3-9]\d{9}",
    "身份证": r"\d{17}[\dXx]",
    "银行卡号": r"\d{16,19}",
    "邮箱": r"[\w.\-]+@[\w\-]+\.[\w.]+",
}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input_file")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        text = open(args.input_file, encoding="utf-8").read()
    except OSError as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    found = {k: len(re.findall(p, text)) for k, p in PII.items()}
    print(json.dumps({"pii_found": found, "total": sum(found.values())}, ensure_ascii=False, indent=2))
    sys.exit(1 if sum(found.values()) else 0)

if __name__ == "__main__":
    main()
