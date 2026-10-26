#!/usr/bin/env python3
"""需求覆盖率计算：比对需求文档REQ与用例集中的REQ引用。"""
import argparse, json, re, sys

REQ = re.compile(r"\bREQ-\d{3}\b")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("req_doc")
    ap.add_argument("testcase_doc")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        reqs = sorted(set(REQ.findall(open(args.req_doc, encoding="utf-8").read())))
        covered = sorted(set(REQ.findall(open(args.testcase_doc, encoding="utf-8").read())))
    except OSError as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    missing = [r for r in reqs if r not in covered]
    rate = round(len(covered) / len(reqs), 4) if reqs else 0
    print(json.dumps({"total": len(reqs), "covered": len(covered), "rate": rate, "missing": missing}, ensure_ascii=False, indent=2))
    sys.exit(0 if not missing else 2)

if __name__ == "__main__":
    main()
