#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SDLC 度量数据完整性校验器

检查 metrics-report.json 的数据完整性：
  1. 所有阶段时间戳是否完整（8/8 阶段有 started_at 和 completed_at）
  2. DORA 四指标是否都有值（4/4）
  3. 数值合理性（耗时 > 0 且 < 合理上限）

用法:
    python validate_metrics.py --metrics .sdlc-demo/08-pm/metrics-report.json

退出码: 0=完整, 1=缺失/异常
"""

import argparse
import json
import sys
from pathlib import Path

# ═══════════════════════════════════════════════════════════════
# 校验配置
# ═══════════════════════════════════════════════════════════════

# 阶段总数
STAGES_TOTAL = 8

# DORA 指标总数
DORA_TOTAL = 4

# 数值合理性上限
SANITY_LIMITS = {
    "stage_duration_hours": 720,    # 单阶段不超过 30 天
    "lead_time_hours": 1440,        # 全流程不超过 60 天
    "gate_wait_hours": 168,         # 门禁等待不超过 7 天
    "mttr_hours": 168,              # MTTR 不超过 7 天
    "rate_pct": 100,                # 百分比不超过 100
}

# DORA 四指标的 key
DORA_KEYS = ("deploy_frequency", "change_failure_rate", "mttr_hours", "defect_escape_rate")

# 需校验时间戳的阶段
STAGE_IDS = ("G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8")


def log(msg):
    """输出日志到 stderr。"""
    print(f"[validate_metrics] {msg}", file=sys.stderr)


def load_json_safe(filepath):
    """安全加载 JSON 文件，返回 dict 或 None。"""
    try:
        with open(filepath, "r", encoding="utf-8-sig") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        log(f"加载 JSON 失败: {filepath} — {e}")
        return None


# ═══════════════════════════════════════════════════════════════
# 校验函数
# ═══════════════════════════════════════════════════════════════

def check_timestamps(metrics):
    """
    检查所有阶段时间戳是否完整。

    返回: (通过数, 总数, 问题列表)
    """
    issues = []
    passed = 0
    stages = metrics.get("stages", {})

    for gate_id in STAGE_IDS:
        stage = stages.get(gate_id, {})
        if not stage:
            issues.append(f"{gate_id}: 阶段数据缺失")
            continue
        started = stage.get("started_at")
        completed = stage.get("completed_at")
        if not started:
            issues.append(f"{gate_id}: 缺少 started_at")
        if not completed:
            issues.append(f"{gate_id}: 缺少 completed_at")
        if started and completed:
            passed += 1

    return passed, STAGES_TOTAL, issues


def check_dora(metrics):
    """
    检查 DORA 四指标是否都有值。

    返回: (有值数, 总数, 问题列表)
    """
    issues = []
    passed = 0
    dora = metrics.get("dora", {})

    for key in DORA_KEYS:
        m = dora.get(key, {})
        if not isinstance(m, dict):
            issues.append(f"DORA.{key}: 指标对象缺失")
            continue
        val = m.get("value")
        if val is None:
            issues.append(f"DORA.{key}: value 为空（{m.get('data_source', '无数据源')}）")
        else:
            passed += 1

    return passed, DORA_TOTAL, issues


def check_sanity(metrics):
    """
    检查数值合理性（耗时 > 0 且 < 合理上限）。

    返回: (问题列表)
    """
    issues = []
    stages = metrics.get("stages", {})

    # 单阶段耗时合理性
    for gate_id in STAGE_IDS:
        stage = stages.get(gate_id, {})
        dur_min = stage.get("duration_min")
        if dur_min is not None:
            dur_h = dur_min / 60.0
            if dur_h < 0:
                issues.append(f"{gate_id}: 阶段耗时为负值 ({dur_h}h)")
            elif dur_h > SANITY_LIMITS["stage_duration_hours"]:
                issues.append(
                    f"{gate_id}: 阶段耗时 {dur_h}h 超出合理上限 "
                    f"{SANITY_LIMITS['stage_duration_hours']}h"
                )

        # 门禁等待时间合理性
        wait_h = stage.get("gate_wait_hours")
        if wait_h is not None:
            if wait_h < 0:
                issues.append(f"{gate_id}: 门禁等待时间为负值 ({wait_h}h)")
            elif wait_h > SANITY_LIMITS["gate_wait_hours"]:
                issues.append(
                    f"{gate_id}: 门禁等待 {wait_h}h 超出合理上限 "
                    f"{SANITY_LIMITS['gate_wait_hours']}h"
                )

    # Lead Time 合理性
    lt = metrics.get("lead_time", {})
    lt_hours = lt.get("total_hours")
    if lt_hours is not None:
        if lt_hours < 0:
            issues.append(f"Lead Time: 总耗时为负值 ({lt_hours}h)")
        elif lt_hours > SANITY_LIMITS["lead_time_hours"]:
            issues.append(
                f"Lead Time: 总耗时 {lt_hours}h 超出合理上限 "
                f"{SANITY_LIMITS['lead_time_hours']}h"
            )

    # DORA 数值合理性
    dora = metrics.get("dora", {})
    mttr = dora.get("mttr_hours", {})
    mttr_val = mttr.get("value")
    if mttr_val is not None:
        if mttr_val < 0:
            issues.append(f"DORA.mttr: MTTR 为负值 ({mttr_val}h)")
        elif mttr_val > SANITY_LIMITS["mttr_hours"]:
            issues.append(
                f"DORA.mttr: MTTR {mttr_val}h 超出合理上限 "
                f"{SANITY_LIMITS['mttr_hours']}h"
            )

    # 百分比指标合理性
    for key in ("change_failure_rate", "defect_escape_rate"):
        m = dora.get(key, {})
        val = m.get("value")
        if val is not None:
            if val < 0:
                issues.append(f"DORA.{key}: 比率为负值 ({val}%)")
            elif val > SANITY_LIMITS["rate_pct"]:
                issues.append(
                    f"DORA.{key}: 比率 {val}% 超出合理上限 "
                    f"{SANITY_LIMITS['rate_pct']}%"
                )

    # Agent 效能百分比合理性
    ae = metrics.get("agent_efficiency", {})
    for key in ("script_pass_rate", "rework_rate", "agent_autonomy_rate"):
        m = ae.get(key, {})
        val = m.get("value")
        if val is not None:
            if val < 0 or val > SANITY_LIMITS["rate_pct"]:
                issues.append(f"Agent.{key}: 比率 {val}% 超出合理范围 [0, 100]")

    # 门禁拦截率合理性
    gi = metrics.get("gate_interception", {})
    for key in ("g1_return_rate", "g3_return_rate", "g5_return_rate"):
        m = gi.get(key, {})
        val = m.get("value")
        if val is not None:
            if val < 0 or val > SANITY_LIMITS["rate_pct"]:
                issues.append(f"Gate.{key}: 退回率 {val}% 超出合理范围 [0, 100]")

    return issues


# ═══════════════════════════════════════════════════════════════
# 主校验逻辑
# ═══════════════════════════════════════════════════════════════

def validate_metrics(metrics):
    """
    执行完整度量校验。

    返回: {
        "passed": bool,
        "checks": {
            "timestamp": {"passed": N, "total": N, "issues": [...]},
            "dora": {"passed": N, "total": N, "issues": [...]},
            "sanity": {"issues": [...]}
        },
        "verdict": "PASS"|"FAIL"
    }
    """
    ts_passed, ts_total, ts_issues = check_timestamps(metrics)
    dora_passed, dora_total, dora_issues = check_dora(metrics)
    sanity_issues = check_sanity(metrics)

    # 判定：时间戳完整 + DORA 完整 + 无合理性异常
    timestamp_ok = ts_passed == ts_total
    dora_ok = dora_passed == dora_total
    sanity_ok = len(sanity_issues) == 0

    overall_passed = timestamp_ok and dora_ok and sanity_ok

    return {
        "passed": overall_passed,
        "checks": {
            "timestamp": {
                "passed": ts_passed,
                "total": ts_total,
                "ok": timestamp_ok,
                "issues": ts_issues,
            },
            "dora": {
                "passed": dora_passed,
                "total": dora_total,
                "ok": dora_ok,
                "issues": dora_issues,
            },
            "sanity": {
                "issues_count": len(sanity_issues),
                "ok": sanity_ok,
                "issues": sanity_issues,
            },
        },
        "verdict": "PASS" if overall_passed else "FAIL",
    }


def main():
    parser = argparse.ArgumentParser(
        description="SDLC 度量数据完整性校验器 — 检查时间戳/DORA/数值合理性",
    )
    parser.add_argument(
        "--metrics", required=True,
        help="metrics-report.json 文件路径",
    )
    parser.add_argument(
        "--output", default=None,
        help="校验报告输出路径（可选，默认输出到 stdout）",
    )
    args = parser.parse_args()

    # 加载度量数据
    metrics = load_json_safe(args.metrics)
    if metrics is None or not isinstance(metrics, dict):
        print(json.dumps({"error": f"无法加载度量数据: {args.metrics}"}, ensure_ascii=False))
        sys.exit(1)

    # 执行校验
    result = validate_metrics(metrics)

    # 输出结果
    output_json = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        output_path = Path(args.output).resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(output_json, encoding="utf-8")
        log(f"校验报告已输出: {output_path}")

    # 控制台摘要
    print(output_json)

    checks = result["checks"]
    print(f"\n{'=' * 60}", file=sys.stderr)
    print(f"SDLC 度量数据完整性校验", file=sys.stderr)
    print(f"  校验结论: {result['verdict']}", file=sys.stderr)
    print(f"  时间戳完整: {checks['timestamp']['passed']}/{checks['timestamp']['total']}", file=sys.stderr)
    print(f"  DORA 完整: {checks['dora']['passed']}/{checks['dora']['total']}", file=sys.stderr)
    print(f"  合理性异常: {checks['sanity']['issues_count']} 项", file=sys.stderr)

    # 输出问题清单
    all_issues = []
    all_issues.extend(checks["timestamp"]["issues"])
    all_issues.extend(checks["dora"]["issues"])
    all_issues.extend(checks["sanity"]["issues"])
    if all_issues:
        print(f"\n  问题清单:", file=sys.stderr)
        for issue in all_issues:
            print(f"    - {issue}", file=sys.stderr)
    print(f"{'=' * 60}", file=sys.stderr)

    # 退出码：完整=0，缺失/异常=1
    sys.exit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()
