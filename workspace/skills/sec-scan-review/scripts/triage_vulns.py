#!/usr/bin/env python3
"""漏洞分级聚合：读取扫描结果JSON，按CVSS分级，输出处置建议与豁免到期提醒。"""
import argparse, json, sys
from datetime import date

def level(cvss):
    if cvss >= 9.0: return "严重"
    if cvss >= 7.0: return "高"
    if cvss >= 4.0: return "中"
    return "低"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scan_json", help="扫描结果JSON（list of {id,title,cvss,false_positive,waiver_until}）")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        data = json.load(open(args.scan_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    today = date.today()
    report = {"by_level": {}, "open_high": [], "waivers_expiring": [], "false_positives": []}
    for v in data:
        lv = level(float(v.get("cvss", 0)))
        report["by_level"][lv] = report["by_level"].get(lv, 0) + 1
        if v.get("false_positive"):
            report["false_positives"].append(v.get("id"))
            continue
        if lv in ("严重", "高"):
            report["open_high"].append({"id": v.get("id"), "cvss": v.get("cvss"), "waiver_until": v.get("waiver_until")})
            if v.get("waiver_until"):
                try:
                    if date.fromisoformat(v["waiver_until"]) <= today:
                        report["waivers_expiring"].append(v.get("id"))
                except ValueError:
                    pass
    verdict = "PASS" if not report["open_high"] else "BLOCK"
    report["verdict"] = verdict
    print(json.dumps(report, ensure_ascii=False, indent=2))
    sys.exit(0 if verdict == "PASS" else 2)

if __name__ == "__main__":
    main()
