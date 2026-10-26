#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Agent 推荐引擎 - 输入需求描述，基于关键词匹配推荐应调用的 Agent 和 Skill。

用法：
    python agent_recommender.py --requirement "日累计限额参数化与超额预警" \
        --output .sdlc-demo/agent-recommendation.json

关键词匹配规则（命中任一关键词即推荐对应 Agent 与 Skill）：
    - 需求/业务诉求/验收          -> requirement-analyst
       + ba-requirement-analysis, ba-acceptance-criteria
    - 设计/架构/方案              -> solution-architect
       + arch-solution-design, arch-adr-writing
    - 开发/编码/实现              -> developer
       + dev-backend-service, dev-data-sql
    - 测试/用例/回归              -> test-engineer
       + qa-test-strategy, qa-system-test-design
    - 安全/漏洞/威胁              -> security-engineer
       + sec-threat-model, sec-scan-review
    - 发布/部署/回滚              -> release-engineer
       + release-plan, rollback-runbook
    - 变更/RFC/窗口               -> change-manager
       + change-rfc, change-risk-assessment
    - 门禁/审计/报告              -> project-manager
       + pm-gate-checklist, sdlc-metrics

输出：stdout + 文件（JSON）
退出码：0=成功, 1=失败
"""

import argparse
import json
import sys
from pathlib import Path

# ═══════════════════════════════════════════════════════════════
# 关键词匹配规则
# 每条规则定义：阶段、Agent、推荐 Skill、关键词、默认产出文件
# ═══════════════════════════════════════════════════════════════

RULES = [
    {
        "phase": "G1",
        "phase_name": "需求",
        "agent": "requirement-analyst",
        "skills": ["ba-requirement-analysis", "ba-acceptance-criteria"],
        "keywords": ["需求", "业务诉求", "验收"],
        "order": 1,
        "outputs": ["需求说明书.md", "用户故事清单.md", "验收标准.md", "RTM矩阵.md"],
    },
    {
        "phase": "G2",
        "phase_name": "设计",
        "agent": "solution-architect",
        "skills": ["arch-solution-design", "arch-adr-writing"],
        "keywords": ["设计", "架构", "方案"],
        "order": 2,
        "outputs": ["方案设计.md", "ADR记录.md", "影响分析.md", "NFR规格.md"],
    },
    {
        "phase": "G3",
        "phase_name": "开发",
        "agent": "developer",
        "skills": ["dev-backend-service", "dev-data-sql"],
        "keywords": ["开发", "编码", "实现"],
        "order": 3,
        "outputs": ["后端服务代码", "DDL/迁移脚本", "单元测试", "覆盖率报告"],
    },
    {
        "phase": "G4",
        "phase_name": "测试",
        "agent": "test-engineer",
        "skills": ["qa-test-strategy", "qa-system-test-design"],
        "keywords": ["测试", "用例", "回归"],
        "order": 4,
        "outputs": ["测试策略.md", "系统测试用例.md", "回归测试范围.md"],
    },
    {
        "phase": "G5",
        "phase_name": "安全",
        "agent": "security-engineer",
        "skills": ["sec-threat-model", "sec-scan-review"],
        "keywords": ["安全", "漏洞", "威胁"],
        "order": 5,
        "outputs": ["威胁模型.md", "漏洞扫描报告.md", "安全审查结论.md"],
    },
    {
        "phase": "G6",
        "phase_name": "发布",
        "agent": "release-engineer",
        "skills": ["release-plan", "rollback-runbook"],
        "keywords": ["发布", "部署", "回滚"],
        "order": 6,
        "outputs": ["发布计划.md", "部署Runbook.md", "回滚Runbook.md"],
    },
    {
        "phase": "G7",
        "phase_name": "变更",
        "agent": "change-manager",
        "skills": ["change-rfc", "change-risk-assessment"],
        "keywords": ["变更", "RFC", "窗口"],
        "order": 7,
        "outputs": ["RFC变更单.md", "风险评估.md", "变更窗口排期.md"],
    },
    {
        "phase": "G8",
        "phase_name": "管理",
        "agent": "project-manager",
        "skills": ["pm-gate-checklist", "sdlc-metrics"],
        "keywords": ["门禁", "审计", "报告"],
        "order": 8,
        "outputs": ["门禁检查清单.md", "SDLC度量报告.md", "审计证据包.md"],
    },
]

# 默认推荐执行路径（含并行组）
DEFAULT_PATH = "G1->G2->G3(并行G4)->G5->G6(并行G7)->G8"

PARALLEL_GROUPS = [
    {"group": "P1", "stages": ["G3", "G4"]},
    {"group": "P2", "stages": ["G6", "G7"]},
]


def match_rules(requirement: str) -> list:
    """
    在需求描述中匹配关键词，返回命中的规则列表（按 order 排序）。
    若无任何命中，返回全部规则（兜底推荐完整流程）。
    """
    text = requirement.lower()
    matched = []
    for rule in RULES:
        if any(kw.lower() in text for kw in rule["keywords"]):
            matched.append(rule)

    if not matched:
        # 兜底：无关键词命中时推荐完整流程
        matched = list(RULES)

    matched.sort(key=lambda r: r["order"])
    return matched


def build_recommendation(requirement: str) -> dict:
    """生成推荐结果字典。"""
    matched = match_rules(requirement)

    agents = []
    skills = []
    stages = []
    expected_outputs = []
    notes = []

    for rule in matched:
        agents.append(rule["agent"])
        skills.extend(rule["skills"])
        stages.append({
            "phase": rule["phase"],
            "phase_name": rule["phase_name"],
            "agent": rule["agent"],
            "skills": rule["skills"],
            "order": rule["order"],
        })
        for out in rule["outputs"]:
            if out not in expected_outputs:
                expected_outputs.append(out)
        matched_kws = [kw for kw in rule["keywords"] if kw.lower() in requirement.lower()]
        if matched_kws:
            notes.append(f"{rule['phase']}（{rule['agent']}）：命中关键词 {matched_kws}")

    # 若是兜底推荐（无命中），加说明
    is_fallback = all(
        not any(kw.lower() in requirement.lower() for kw in rule["keywords"])
        for rule in matched
    )
    if is_fallback:
        notes.insert(0, "未匹配到明确关键词，默认推荐完整 G1-G8 流程")

    return {
        "requirement": requirement,
        "recommended_agents": agents,
        "recommended_skills": skills,
        "recommended_stages": stages,
        "recommended_path": DEFAULT_PATH,
        "parallel_groups": PARALLEL_GROUPS,
        "expected_outputs": expected_outputs,
        "notes": notes,
    }


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

    parser = argparse.ArgumentParser(
        description="Agent 推荐引擎 - 基于需求描述推荐应调用的 Agent 和 Skill"
    )
    parser.add_argument(
        "--requirement", required=True,
        help="需求描述文本（如 \"日累计限额参数化与超额预警\"）",
    )
    parser.add_argument(
        "--output", default=None,
        help="输出文件路径（默认 .sdlc-demo/agent-recommendation.json）",
    )

    args = parser.parse_args()

    try:
        result = build_recommendation(args.requirement)
        output_json = json.dumps(result, ensure_ascii=False, indent=2)

        print(output_json)

        output_path = (
            Path(args.output) if args.output
            else Path(".sdlc-demo") / "agent-recommendation.json"
        )
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(output_json, encoding="utf-8")

        print(f"\n推荐结果已保存: {output_path}", file=sys.stderr)
        sys.exit(0)

    except Exception as e:
        print(f"错误：生成推荐失败: {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
