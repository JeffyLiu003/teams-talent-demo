#!/usr/bin/env python3
"""
模糊词扫描脚本

扫描文档中的模糊表述词汇，标注位置和上下文。
遵循技能脚本接口规范。

用法:
    python ambiguity_check.py <document.md> [--json]

退出码:
    0 - 无模糊词
    1 - 有少量模糊词（警告）
    2 - 大量模糊词（失败）
    3 - 参数错误
"""

import sys
import json
import argparse
import re
from pathlib import Path


# Ambiguous word list for requirement documents
# Format: (word, severity, category, suggestion)
AMBIGUOUS_WORDS = [
    # 程度模糊
    ("大概", "high", "程度", "请给出具体数值或范围"),
    ("大约", "high", "程度", "请给出具体数值或范围"),
    ("左右", "medium", "程度", "请确认是否为精确值，或给出误差范围"),
    ("差不多", "high", "程度", "请给出具体标准"),
    ("尽量", "high", "程度", "请给出明确目标值和最低要求"),
    ("尽可能", "high", "程度", "请给出明确目标值和最低要求"),
    ("适当", "high", "程度", "请说明什么是'适当'，标准是什么"),
    ("相应", "medium", "程度", "请明确对应什么，如何对应"),

    # 时间模糊
    ("尽快", "high", "时间", "请给出明确的时间要求或SLA"),
    ("及时", "high", "时间", "请给出明确的时间要求或SLA"),
    ("定期", "high", "时间", "请明确周期：每天/每周/每月？"),
    ("不定期", "medium", "时间", "请说明触发条件或频率范围"),
    ("暂时", "medium", "时间", "请说明预计持续时间或切换条件"),

    # 范围模糊
    ("等", "medium", "范围", "请明确列出全部项"),
    ("等等", "high", "范围", "请明确列出全部项，不要用'等等'"),
    ("之类", "medium", "范围", "请明确列出全部类别"),
    ("相关", "high", "范围", "请明确具体是哪些相关方/相关内容"),
    ("有关", "medium", "范围", "请明确具体关系和内容"),
    ("其他", "medium", "范围", "请列出'其他'包含的具体内容"),

    # 可能性模糊
    ("可能", "high", "可能性", "请说明概率或触发条件"),
    ("也许", "high", "可能性", "请说明概率或触发条件"),
    ("或许", "high", "可能性", "请说明概率或触发条件"),

    # 数量模糊
    ("一些", "high", "数量", "请给出具体数量或范围"),
    ("若干", "high", "数量", "请给出具体数量或范围"),
    ("多数", "medium", "数量", "请明确比例（如80%）"),
    ("少数", "medium", "数量", "请明确比例（如20%）"),
    ("大量", "medium", "数量", "请给出估算量级（如万级/十万级）"),
    ("少量", "medium", "数量", "请给出估算量级"),

    # 质量模糊
    ("比较好", "high", "质量", "请给出明确的标准和指标"),
    ("较好", "high", "质量", "请给出明确的标准和指标"),
    ("良好", "medium", "质量", "请给出量化指标"),
    ("正常", "medium", "质量", "请说明什么是'正常'状态"),
    ("合理", "high", "质量", "请说明判断标准"),
]


def read_file(filepath: str) -> str:
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()


def scan_ambiguity(content: str) -> dict:
    """Scan document for ambiguous words."""
    lines = content.split("\n")
    findings = []

    for word, severity, category, suggestion in AMBIGUOUS_WORDS:
        for line_num, line in enumerate(lines, 1):
            # Skip code blocks and frontmatter
            # Simple heuristic: skip lines starting with ``` or inside code blocks
            # (not perfect but good enough for a linter)
            if line.strip().startswith("```"):
                continue

            # Find all occurrences
            start = 0
            while True:
                idx = line.find(word, start)
                if idx == -1:
                    break

                # Get context (20 chars before and after)
                ctx_start = max(0, idx - 20)
                ctx_end = min(len(line), idx + len(word) + 20)
                context = line[ctx_start:ctx_end].strip()

                # Check if already marked with [待确认]
                rest_of_line = line[idx:]
                if "[待确认]" in rest_of_line[:50]:
                    start = idx + len(word)
                    continue

                findings.append({
                    "word": word,
                    "severity": severity,
                    "category": category,
                    "line": line_num,
                    "column": idx + 1,
                    "context": context,
                    "suggestion": suggestion,
                })
                start = idx + len(word)

    # Group by word
    by_word = {}
    for f in findings:
        w = f["word"]
        if w not in by_word:
            by_word[w] = {"count": 0, "severity": f["severity"], "category": f["category"]}
        by_word[w]["count"] += 1

    high_count = sum(1 for f in findings if f["severity"] == "high")
    medium_count = sum(1 for f in findings if f["severity"] == "medium")

    return {
        "total_findings": len(findings),
        "high_severity": high_count,
        "medium_severity": medium_count,
        "by_word": by_word,
        "findings": findings[:50],  # Top 50 findings
    }


def main():
    parser = argparse.ArgumentParser(description="模糊词扫描")
    parser.add_argument("filepath", help="文档路径 (.md)")
    parser.add_argument("--json", action="store_true", help="输出JSON格式")
    parser.add_argument("--threshold", type=int, default=10,
                        help="高严重度模糊词阈值，超过则失败（默认10）")
    args = parser.parse_args()

    if not Path(args.filepath).exists():
        print(f"错误: 文件不存在: {args.filepath}", file=sys.stderr)
        sys.exit(3)

    content = read_file(args.filepath)
    result = scan_ambiguity(content)
    result["filepath"] = args.filepath

    if result["high_severity"] >= args.threshold:
        exit_code = 2
        verdict = "FAIL"
    elif result["total_findings"] > 0:
        exit_code = 1
        verdict = "WARNING"
    else:
        exit_code = 0
        verdict = "PASS"

    result["verdict"] = verdict

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"=== 模糊词扫描结果 ===")
        print(f"文件: {args.filepath}")
        print(f"结论: {verdict}")
        print(f"模糊词总数: {result['total_findings']}")
        print(f"  高严重度: {result['high_severity']}")
        print(f"  中严重度: {result['medium_severity']}")
        print()
        print("按词汇统计:")
        for word, info in sorted(result["by_word"].items(),
                                  key=lambda x: -x[1]["count"]):
            flag = "!" if info["severity"] == "high" else " "
            print(f"  {flag} {word}: {info['count']}次 ({info['category']})")
        print()
        if result["findings"]:
            print("前20处详情:")
            for f in result["findings"][:20]:
                print(f"  第{f['line']}行: '{f['context']}'")
                print(f"         → {f['suggestion']}")

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
