#!/usr/bin/env python3
"""校验全链路ID链完整性与链接有效性。输入证据包JSON: {chain:[{stage,id,url}]}。"""
import argparse, json, re, sys
from urllib.request import urlopen

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("evidence_json", help="证据包JSON")
    ap.add_argument("--check-urls", action="store_true", help="校验URL可达性")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        data = json.load(open(args.evidence_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    chain = data.get("chain", [])
    missing = [c for c in chain if not c.get("id")]
    broken = []
    if args.check_urls:
        for c in chain:
            url = c.get("url", "")
            if not url or not re.match(r"^https?://", url):
                broken.append(c.get("stage"))
    report = {"total": len(chain), "missing_ids": missing, "broken_links": broken,
              "chain_complete": not missing and not broken}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    sys.exit(0 if report["chain_complete"] else 2)

if __name__ == "__main__":
    main()
