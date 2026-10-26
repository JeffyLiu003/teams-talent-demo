#!/usr/bin/env python3
"""扫描产出文本中的领域术语，与词汇表比对一致性并输出建议。

用法:
  term_check.py <目标文档.md> [--glossary 词汇表.md] [--json]

退出码:
  0 = 通过（无不一致别名）
  1 = 有告警（未收录术语）
  2 = 有不一致（命中禁用别名）
  3 = 参数错误 / 文件读取失败
"""
import argparse
import json
import re
import sys
from pathlib import Path

# ── 默认术语与别名（当未提供 --glossary 时使用） ──
DEFAULT_TERMS = [
    "转账", "日累计限额", "单笔限额", "年累计限额", "清算", "结算",
    "对账", "冲正", "记账", "交易号", "参考号", "风控",
    "批量代发", "批量代扣", "协议支付", "跨境汇款",
    "长款", "短款", "串户", "备付金",
]

# 禁用别名 -> 正确术语
DEFAULT_ALIASES = {
    "转帐": "转账",
    "划账": "转账",
    "日限额": "日累计限额",
    "笔限额": "单笔限额",
    "年限额": "年累计限额",
    "核账": "对账",
    "流水号": "交易号",
    "批量转账": "批量代发",
    "批量扣款": "批量代扣",
    "国际转账": "跨境汇款",
    "多记": "长款",
    "少记": "短款",
    "错账": "串户",
    "保证金": "备付金",
}


def parse_glossary(path: str):
    """从词汇表 Markdown 解析术语与别名映射。

    词汇表格式：Markdown 表格，含"术语"和"别名（禁用）"列。
    通过表头行定位列位置，避免依赖固定列号。
    """
    terms = set(DEFAULT_TERMS)
    aliases = dict(DEFAULT_ALIASES)
    try:
        text = Path(path).read_text(encoding="utf-8")
    except OSError:
        return terms, aliases

    lines = text.splitlines()
    term_col = None
    alias_col = None
    in_table = False

    for line in lines:
        if "|" not in line:
            in_table = False
            continue

        cells = [c.strip() for c in line.split("|")]
        if cells and cells[0] == "":
            cells = cells[1:]
        if cells and cells[-1] == "":
            cells = cells[:-1]

        if all(re.match(r"^[-:]+$", c) for c in cells if c):
            continue

        if term_col is None and any("术语" in c for c in cells):
            for i, c in enumerate(cells):
                if "术语" in c:
                    term_col = i
                if "别名" in c:
                    alias_col = i
            in_table = True
            continue

        if not in_table:
            if any("术语" in c for c in cells):
                term_col = alias_col = None
                for i, c in enumerate(cells):
                    if "术语" in c:
                        term_col = i
                    if "别名" in c:
                        alias_col = i
                in_table = True
            continue

        if term_col is not None and term_col < len(cells):
            term = cells[term_col]
            if term and term not in ("------", ""):
                terms.add(term)

        if alias_col is not None and alias_col < len(cells):
            alias_str = cells[alias_col]
            if alias_str and alias_str not in ("-", ""):
                for alias in re.split(r"[、,，/]", alias_str):
                    alias = re.sub(r"[（(].*?[）)]", "", alias).strip()
                    if alias and alias not in ("混用", "口语化", "泛化"):
                        correct = cells[term_col] if term_col is not None and term_col < len(cells) else alias
                        aliases[alias] = correct

    return terms, aliases


def find_alias_occurrences(text: str, alias: str, terms: set) -> list:
    """查找别名出现位置，排除作为合法术语子串的情况。

    如果别名是某个合法术语的子串，且该位置实际是合法术语的一部分，
    则不视为违规。
    """
    occurrences = []
    start = 0
    while True:
        idx = text.find(alias, start)
        if idx == -1:
            break
        # 检查此位置是否是某个合法术语的子串
        is_substring_of_term = False
        for term in terms:
            if alias in term and alias != term:
                # 检查 text[idx:idx+len(term)] 是否等于 term
                if text[idx:idx + len(term)] == term:
                    is_substring_of_term = True
                    break
                # 检查别名是否在合法术语中间
                term_idx = term.find(alias)
                if term_idx > 0:
                    # 检查别名前面是否有合法术语的前缀
                    prefix = term[:term_idx]
                    if text[idx - term_idx:idx - term_idx + len(term)] == term:
                        is_substring_of_term = True
                        break
        if not is_substring_of_term:
            occurrences.append(idx)
        start = idx + 1
    return occurrences


def main():
    ap = argparse.ArgumentParser(description="领域术语一致性校验")
    ap.add_argument("target_md", help="目标文档路径")
    ap.add_argument("--glossary", help="词汇表路径（可选，默认使用内置词表）")
    ap.add_argument("--json", action="store_true", help="JSON 输出")
    args = ap.parse_args()

    try:
        text = Path(args.target_md).read_text(encoding="utf-8")
    except OSError as e:
        result = {"error": str(e)}
        print(json.dumps(result, ensure_ascii=False, indent=2))
        sys.exit(3)

    if args.glossary:
        terms, aliases = parse_glossary(args.glossary)
    else:
        terms = set(DEFAULT_TERMS)
        aliases = dict(DEFAULT_ALIASES)

    terms_found = sorted(t for t in terms if t in text)

    inconsistent = []
    for alias, correct in aliases.items():
        occurrences = find_alias_occurrences(text, alias, terms)
        if occurrences:
            inconsistent.append({
                "alias": alias,
                "should_be": correct,
                "count": len(occurrences),
                "suggestion": f"将 '{alias}' 改为 '{correct}'",
            })

    suspected = set()
    for m in re.finditer(r"[\u4e00-\u9fff]{2,}(?:限额|额度|账[户单]|款)", text):
        word = m.group()
        if word not in terms and word not in aliases:
            suspected.add(word)

    exit_code = 0
    if inconsistent:
        exit_code = 2
    elif suspected:
        exit_code = 1

    result = {
        "terms_found": terms_found,
        "terms_count": len(terms_found),
        "inconsistent": inconsistent,
        "inconsistent_count": len(inconsistent),
        "suspected_uncataloged": sorted(suspected),
        "passed": exit_code == 0,
        "exit_code": exit_code,
    }

    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()