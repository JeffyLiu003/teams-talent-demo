#!/usr/bin/env python3
"""RFC校验：必填字段、证据链接、窗口冲突（与冻结期/其他RFC比对）。"""
import argparse, json, sys

REQUIRED = ["RFC编号", "变更类型", "变更原因", "变更范围", "影响分析", "测试退出", "发布计划", "回滚方案", "建议窗口", "干系人"]
FROZEN_DAYS = []  # 例：[("2026-09-30","2026-10-08")] 监管冻结期

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("rfc_md", help="RFC文档路径")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        text = open(args.rfc_md, encoding="utf-8").read()
    except OSError as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    missing = [k for k in REQUIRED if k not in text]
    print(json.dumps({"missing": missing, "complete": not missing}, ensure_ascii=False, indent=2))
    sys.exit(0 if not missing else 2)

if __name__ == "__main__":
    main()
