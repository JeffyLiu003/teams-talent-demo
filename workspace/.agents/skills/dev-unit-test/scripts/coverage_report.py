#!/usr/bin/env python3
"""解析覆盖率报告（JSON/文本/JaCoCo XML）并对比阈值。"""
import argparse, json, re, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("report", help="覆盖率报告文件")
    ap.add_argument("--threshold", type=float, default=80.0)
    ap.add_argument("--jacoco", action="store_true", help="解析JaCoCo XML（LINE计数器）")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        text = open(args.report, encoding="utf-8").read()
    except OSError as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    if args.jacoco:
        matches = re.findall(r'<counter type="LINE" missed="(\d+)" covered="(\d+)"', text)
        if matches:
            # JaCoCo XML 的报告级汇总在文件末尾，取最后一个 LINE 计数器
            missed, covered = float(matches[-1][0]), float(matches[-1][1])
            coverage = covered / (missed + covered) * 100 if (missed + covered) else 0.0
        else:
            coverage = 0.0
    else:
        try:
            data = json.loads(text)
            coverage = float(data.get("overall_coverage", data.get("coverage", 0)))
        except (json.JSONDecodeError, TypeError):
            m = re.search(r"(\d+(?:\.\d+)?)%", text)
            coverage = float(m.group(1)) if m else 0.0
    ok = coverage >= args.threshold
    print(json.dumps({"overall_coverage": coverage, "threshold": args.threshold, "pass": ok}, ensure_ascii=False, indent=2))
    sys.exit(0 if ok else 2)

if __name__ == "__main__":
    main()
