#!/usr/bin/env python3
"""
用户故事-需求关联（RTM）校验脚本

校验用户故事与需求ID的关联完整性，并检查每条故事是否包含
Given/When/Then（前置/操作/预期）验收结构。
遵循技能脚本接口规范：CLI调用，JSON输出，退出码表示结果。

用法:
    python rtm_check.py <requirement_doc.md> <stories_doc.md> [--json]

退出码:
    0 - 全部通过
    1 - 有警告（故事缺少验收结构）
    2 - 失败（存在未关联故事或孤儿需求）
    3 - 参数错误
"""

import argparse
import json
import re
import sys
from pathlib import Path

# 只匹配三位功能需求编号（REQ-001），避免误匹配文档编号 REQ-2026-xxxx
REQ_PATTERN = re.compile(r"\bREQ-\d{3}\b")
STORY_HEADING_PATTERN = re.compile(r"^#{2,4}\s*(US-\d+)\b[^\n]*", re.MULTILINE)

ACCEPTANCE_MARKERS = {
    "given": [r"前置条件", r"\bGiven\b"],
    "when": [r"操作", r"\bWhen\b"],
    "then": [r"预期结果", r"\bThen\b"],
}


def read_file(filepath: str) -> str:
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()


def extract_req_ids(content: str) -> list[str]:
    """提取文档中出现的功能需求编号（保持出现顺序）。"""
    return list(dict.fromkeys(REQ_PATTERN.findall(content)))


def split_stories(content: str) -> dict[str, str]:
    """按 US-xxx 标题切分故事区块，返回 {story_id: section_text}。"""
    matches = list(STORY_HEADING_PATTERN.finditer(content))
    stories = {}
    for idx, match in enumerate(matches):
        story_id = match.group(1)
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(content)
        stories[story_id] = content[match.start():end]
    return stories


def check_acceptance_structure(section: str) -> dict[str, bool]:
    result = {}
    for key, patterns in ACCEPTANCE_MARKERS.items():
        result[key] = any(re.search(p, section, re.MULTILINE) for p in patterns)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="RTM校验：故事↔需求关联")
    parser.add_argument("requirement_doc", help="需求说明书路径(.md)")
    parser.add_argument("stories_doc", help="用户故事文档路径(.md)")
    parser.add_argument("--json", action="store_true", help="输出JSON格式（默认）")
    args = parser.parse_args()

    try:
        req_text = read_file(args.requirement_doc)
        story_text = read_file(args.stories_doc)
    except OSError as exc:
        print(json.dumps({"error": f"读取文件失败: {exc}"}, ensure_ascii=False))
        sys.exit(3)

    req_ids = extract_req_ids(req_text)
    stories = split_stories(story_text)

    if not req_ids:
        print(json.dumps({"error": "需求文档中未找到REQ-xxx功能需求编号"}, ensure_ascii=False))
        sys.exit(3)
    if not stories:
        print(json.dumps({"error": "用户故事文档中未找到US-xxx故事"}, ensure_ascii=False))
        sys.exit(3)

    linked_stories = []
    unlinked_stories = []
    stories_without_acceptance = []

    for story_id, section in stories.items():
        found = extract_req_ids(section)
        valid = [r for r in found if r in req_ids]
        if valid:
            linked_stories.append({"story_id": story_id, "req_ids": valid})
        else:
            unlinked_stories.append(
                {
                    "story_id": story_id,
                    "found_reqs": found,
                    "reason": "未关联到需求文档中的有效REQ编号",
                }
            )
        structure = check_acceptance_structure(section)
        missing = [k for k, present in structure.items() if not present]
        if missing:
            stories_without_acceptance.append(
                {"story_id": story_id, "missing": missing}
            )

    linked_req_ids = {
        req_id for story in linked_stories for req_id in story["req_ids"]
    }
    orphan_stories = [req_id for req_id in req_ids if req_id not in linked_req_ids]

    report = {
        "total_stories": len(stories),
        "linked": len(linked_stories),
        "unlinked": unlinked_stories,
        "orphan_stories": orphan_stories,
        "stories_without_acceptance": stories_without_acceptance,
        "requirement_ids": req_ids,
    }

    if unlinked_stories or orphan_stories:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        sys.exit(2)
    if stories_without_acceptance:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        sys.exit(1)

    print(json.dumps(report, ensure_ascii=False, indent=2))
    sys.exit(0)


if __name__ == "__main__":
    main()
