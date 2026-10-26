#!/usr/bin/env python3
"""
需求说明书完整性检查脚本

检查需求说明书是否包含所有必需章节，字段是否为空。
遵循技能脚本接口规范：CLI调用，JSON输出，退出码表示结果。

用法:
    python spec_completeness.py <requirement_doc.md> [--json] [--strict]

退出码:
    0 - 全部通过
    1 - 有警告（可选字段缺失）
    2 - 失败（必填字段缺失）
    3 - 参数错误
"""

import sys
import json
import argparse
import re
from pathlib import Path


# Required sections and their header patterns
REQUIRED_SECTIONS = [
    ("文档信息", r"##.*文档信息"),
    ("修订记录", r"##.*修订记录"),
    ("背景与目标", r"## 1\..*背景"),
    ("用户角色", r"## 2\..*用户角色"),
    ("范围定义", r"## 3\..*范围"),
    ("功能需求", r"## 4\..*功能需求"),
    ("业务规则", r"## 5\..*业务规则"),
    ("非功能需求", r"## 6\..*非功能"),
    ("安全需求", r"### 6\.2.*安全"),
    ("数据需求", r"## 8\..*数据"),
    ("数据安全", r"### 8\.2.*数据安全"),
    ("风险与应对", r"## 10\..*风险"),
    ("合规标注", r"## 11\..*合规"),
]

# Ambiguous words that should be flagged
AMBIGUOUS_WORDS = [
    "大概", "可能", "尽量", "尽快", "等等", "之类",
    "适当", "相应", "相关", "有关", "等",
]

# Evidence markers
EVIDENCE_PATTERN = r"\[需证据\]"
EVIDENCE_FILLED = r"证据链接|链接|文号|编号"


def read_file(filepath: str) -> str:
    """Read markdown file."""
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()


def check_sections(content: str) -> dict:
    """Check required sections exist."""
    results = []
    missing_required = []
    missing_optional = []

    for name, pattern in REQUIRED_SECTIONS:
        if re.search(pattern, content, re.MULTILINE):
            results.append({"section": name, "status": "present"})
        else:
            results.append({"section": name, "status": "missing"})
            missing_required.append(name)

    return {
        "sections": results,
        "missing_required": missing_required,
        "missing_count": len(missing_required),
    }


def check_empty_fields(content: str) -> dict:
    """Check for empty placeholder patterns."""
    empty_patterns = [
        (r"\{\{[^}]+\}\}", "占位符未替换"),
        (r"_待回复_", "待回复内容"),
        (r"\[待确认\]", "待确认内容"),
        (r"TODO|FIXME", "待办事项"),
    ]

    findings = []
    for pattern, desc in empty_patterns:
        matches = re.findall(pattern, content)
        if matches:
            findings.append({
                "type": desc,
                "pattern": pattern,
                "count": len(matches),
                "samples": matches[:5]
            })

    return {"empty_fields": findings, "total_empty": sum(f["count"] for f in findings)}


def check_ambiguity(content: str) -> dict:
    """Check for ambiguous words."""
    findings = []
    for word in AMBIGUOUS_WORDS:
        # Skip if marked with [待确认] nearby
        pattern = re.escape(word)
        matches = re.findall(pattern, content)
        if matches:
            findings.append({"word": word, "count": len(matches)})

    return {"ambiguous_words": findings, "total_ambiguous": sum(f["count"] for f in findings)}


def check_business_rules(content: str) -> dict:
    """Check business rules have sources."""
    # Find BR-xxx entries
    br_pattern = r"\|\s*(BR-\d+)\s*\|([^|]*)\|([^|]*)\|"
    rules = re.findall(br_pattern, content)

    rules_without_source = []
    for rule_id, desc, source in rules:
        source = source.strip()
        if not source or source in ["", "待补充", "待定", "未知"]:
            rules_without_source.append(rule_id)

    return {
        "total_rules": len(rules),
        "rules_without_source": rules_without_source,
        "missing_source_count": len(rules_without_source),
    }


def check_requirement_ids(content: str) -> dict:
    """Check for REQ-xxx IDs and uniqueness."""
    req_ids = re.findall(r"\[REQ-(\d+)\]", content)
    unique_ids = set(req_ids)

    duplicates = []
    for rid in unique_ids:
        count = req_ids.count(rid)
        if count > 1:
            duplicates.append({"id": f"REQ-{rid}", "count": count})

    return {
        "total_requirements": len(unique_ids),
        "duplicates": duplicates,
        "has_duplicates": len(duplicates) > 0,
    }


def main():
    parser = argparse.ArgumentParser(description="需求说明书完整性检查")
    parser.add_argument("filepath", help="需求文档路径 (.md)")
    parser.add_argument("--json", action="store_true", help="输出JSON格式")
    parser.add_argument("--strict", action="store_true", help="严格模式（模糊词也算失败）")
    args = parser.parse_args()

    if not Path(args.filepath).exists():
        print(f"错误: 文件不存在: {args.filepath}", file=sys.stderr)
        sys.exit(3)

    content = read_file(args.filepath)

    # Run all checks
    section_result = check_sections(content)
    empty_result = check_empty_fields(content)
    ambiguity_result = check_ambiguity(content)
    br_result = check_business_rules(content)
    req_result = check_requirement_ids(content)

    # Calculate score
    total_req = max(req_result["total_requirements"], 1)
    score = 100

    # Deduct for missing required sections (5 points each)
    score -= section_result["missing_count"] * 5

    # Deduct for missing rule sources (2 points each)
    score -= br_result["missing_source_count"] * 2

    # Deduct for empty fields (1 point each, max 20)
    score -= min(empty_result["total_empty"] * 1, 20)

    # Deduct for duplicate IDs (10 points each)
    score -= len(req_result["duplicates"]) * 10

    score = max(0, score)

    # Determine exit code
    has_critical = (
        section_result["missing_count"] > 0
        or br_result["missing_source_count"] > 0
        or req_result["has_duplicates"]
    )
    has_warnings = (
        empty_result["total_empty"] > 0
        or ambiguity_result["total_ambiguous"] > 0
    )

    result = {
        "filepath": args.filepath,
        "score": score,
        "section_check": section_result,
        "empty_fields": empty_result,
        "ambiguity": ambiguity_result,
        "business_rules": br_result,
        "requirement_ids": req_result,
        "verdict": "PASS" if not has_critical and not has_warnings else
                   "WARNING" if not has_critical and has_warnings else
                   "FAIL",
    }

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"=== 需求说明书完整性检查 ===")
        print(f"文件: {args.filepath}")
        print(f"质量得分: {score}/100")
        print(f"结论: {result['verdict']}")
        print()
        print(f"章节完整性: "
              f"缺失 {section_result['missing_count']} 个必选章节")
        if section_result["missing_count"] > 0:
            for s in section_result["missing_required"]:
                print(f"  - 缺失: {s}")
        print()
        print(f"业务规则: 共 {br_result['total_rules']} 条, "
              f"{br_result['missing_source_count']} 条缺少来源")
        print(f"需求条目: 共 {req_result['total_requirements']} 条, "
              f"{len(req_result['duplicates'])} 条重复编号")
        print(f"空字段/占位符: {empty_result['total_empty']} 处")
        print(f"模糊词: {ambiguity_result['total_ambiguous']} 处")

    # Exit code
    if has_critical:
        sys.exit(2)
    elif has_warnings and args.strict:
        sys.exit(2)
    elif has_warnings:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
