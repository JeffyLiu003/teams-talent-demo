#!/usr/bin/env python3
"""
需求-设计覆盖矩阵校验脚本

校验设计文档是否覆盖需求说明书中的全部功能需求（REQ编号）。
遵循技能脚本接口规范：CLI调用，JSON输出，退出码表示结果。

用法:
    python design_coverage.py <requirement_doc.md> <design_doc.md> [--json]

退出码:
    0 - 全部覆盖
    2 - 存在未覆盖需求
    3 - 参数错误
"""

import argparse
import json
import re
import sys

REQ_PATTERN = re.compile(r"\bREQ-\d{3}\b")


def read_file(filepath: str) -> str:
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()


def extract_req_ids(content: str) -> list[str]:
    return list(dict.fromkeys(REQ_PATTERN.findall(content)))


def main() -> None:
    parser = argparse.ArgumentParser(description="需求-设计覆盖矩阵校验")
    parser.add_argument("requirement_doc", help="需求说明书路径(.md)")
    parser.add_argument("design_doc", help="设计文档路径(.md)")
    parser.add_argument("--json", action="store_true", help="输出JSON格式（默认）")
    args = parser.parse_args()

    try:
        req_text = read_file(args.requirement_doc)
        design_text = read_file(args.design_doc)
    except OSError as exc:
        print(json.dumps({"error": f"读取文件失败: {exc}"}, ensure_ascii=False))
        sys.exit(3)

    req_ids = extract_req_ids(req_text)
    design_ids = extract_req_ids(design_text)

    if not req_ids:
        print(json.dumps({"error": "需求文档中未找到REQ-xxx功能需求编号"}, ensure_ascii=False))
        sys.exit(3)

    covered = [r for r in req_ids if r in design_ids]
    uncovered = [r for r in req_ids if r not in design_ids]
    extra = [r for r in design_ids if r not in req_ids]

    report = {
        "total": len(req_ids),
        "covered": covered,
        "uncovered": uncovered,
        "extra_refs_in_design": extra,
        "covered_rate": round(len(covered) / len(req_ids), 4),
    }

    print(json.dumps(report, ensure_ascii=False, indent=2))
    if uncovered:
        sys.exit(2)
    sys.exit(0)


if __name__ == "__main__":
    main()
