#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SDLC 度量看板生成器

读取 metrics-report.json，生成 Markdown 格式的可视化看板（dashboard.md）。
看板包含：指标表格、进度条、趋势图（ASCII 字符图）。

用法:
    python generate_dashboard.py --metrics .sdlc-demo/08-pm/metrics-report.json --output .sdlc-demo/08-pm/dashboard.md
    python generate_dashboard.py --metrics .sdlc-demo/08-pm/metrics-report.json --output .sdlc-demo/08-pm/dashboard.md --trend history.json

退出码: 0=成功, 1=失败
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

# Lead Time 目标（小时）
LEAD_TIME_TARGET_HOURS = 360

# 趋势图宽度（字符数）
TREND_CHART_WIDTH = 40


def log(msg):
    """输出日志到 stderr。"""
    print(f"[generate_dashboard] {msg}", file=sys.stderr)


def load_json_safe(filepath):
    """安全加载 JSON 文件，返回 dict/list 或 None。"""
    try:
        with open(filepath, "r", encoding="utf-8-sig") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        log(f"加载 JSON 失败: {filepath} — {e}")
        return None


# ═══════════════════════════════════════════════════════════════
# 格式化工具
# ═══════════════════════════════════════════════════════════════

def fmt_duration(hours_val):
    """格式化时长（小时 -> 可读字符串）。"""
    if hours_val is None:
        return "数据不足"
    if hours_val < 1:
        return f"{hours_val * 60:.0f} 分钟"
    if hours_val < 24:
        return f"{hours_val:.1f} 小时"
    days = hours_val / 24.0
    return f"{days:.1f} 天"


def fmt_status(met):
    """格式化达标状态为图标。"""
    if met is True:
        return "✅"
    if met is False:
        return "❌"
    return "⚠️"


def fmt_value(metric_obj, unit_suffix=""):
    """格式化指标值。"""
    if not isinstance(metric_obj, dict):
        return "数据不足"
    val = metric_obj.get("value")
    if val is None:
        return "数据不足"
    unit = metric_obj.get("unit", unit_suffix)
    if unit:
        return f"{val} {unit}"
    return str(val)


def progress_bar(ratio, width=20):
    """生成 ASCII 进度条。ratio: 0.0-1.0（可超出表示超额）。"""
    if ratio is None:
        return "[" + " " * width + "] 数据不足"
    ratio = max(0.0, min(1.0, ratio))
    filled = int(ratio * width)
    return "[" + "█" * filled + "░" * (width - filled) + "]"


def ratio_for_target(value, target, lower_is_better=True):
    """计算目标达成比例（用于进度条）。"""
    if value is None or target is None or target == 0:
        return None
    if lower_is_better:
        return 1.0 - (value / target) if value <= target else 0.0
    else:
        return value / target if value <= target else 1.0


# ═══════════════════════════════════════════════════════════════
# 看板各部分构建
# ═══════════════════════════════════════════════════════════════

def build_overview(metrics):
    """构建看板概览部分。"""
    summary = metrics.get("summary", {})
    overall = "✅ 全部门禁通过" if summary.get("all_gates_pass") else "❌ 存在门禁退回"
    completeness = summary.get("data_completeness_pct", 0)
    lead_hours = metrics.get("lead_time", {}).get("total_hours")

    lines = [
        f"> **需求ID**: {metrics.get('requirement_id', '未知')}  ",
        f"> **项目**: {metrics.get('project_name', '未知')}  ",
        f"> **采集时间**: {metrics.get('collected_at', '未知')}  ",
        f"> **总体状态**: {overall}  ",
        f"> **Lead Time**: {fmt_duration(lead_hours)}（目标 ≤ 15 天）  ",
        f"> **数据完整度**: {completeness}%  ",
        f"> **门禁退回**: {metrics.get('agent_efficiency', {}).get('rework_rate', {}).get('gate_returns', 0)} 个阶段  ",
        "",
    ]
    return "\n".join(lines)


def build_lead_time_section(metrics):
    """构建 Lead Time 部分表格和进度条。"""
    lt = metrics.get("lead_time", {})
    total_hours = lt.get("total_hours")
    met = lt.get("met")

    # Lead Time 进度条（越低越好，target=360h）
    lt_ratio = ratio_for_target(total_hours, LEAD_TIME_TARGET_HOURS, lower_is_better=True)
    # 达成度：未用时间 / 目标时间
    if total_hours is not None and total_hours <= LEAD_TIME_TARGET_HOURS:
        achievement = (LEAD_TIME_TARGET_HOURS - total_hours) / LEAD_TIME_TARGET_HOURS
    else:
        achievement = 0.0

    lines = [
        "## 1. Lead Time 交付速度\n",
        "| 指标 | 当前值 | 目标 | 达标 |",
        "|------|--------|------|------|",
        f"| 需求→上线 | {fmt_duration(total_hours)} | ≤ 15 天 | {fmt_status(met)} |",
        f"| G1 开始 | {lt.get('started_at', '数据不足')} | - | - |",
        f"| G8 完成 | {lt.get('completed_at', '数据不足')} | - | - |",
        "",
        f"**Lead Time 达成度**（剩余预算越多越好）:",
        f"  {progress_bar(achievement)} {achievement * 100:.0f}%",
        "",
        "### 各阶段耗时分布",
        "",
        "| 阶段 | 耗时 | 目标 | 达标 |",
        "|------|------|------|------|",
    ]

    stage_durations = lt.get("stage_durations_min", {})
    stage_met = lt.get("stage_met", {})
    stage_target_h = lt.get("stage_target_hours", 8)
    for gate_id in ("G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"):
        dur_min = stage_durations.get(gate_id)
        dur_h = dur_min / 60.0 if dur_min is not None else None
        sm = stage_met.get(gate_id)
        lines.append(
            f"| {gate_id} | {fmt_duration(dur_h)} | ≤ {stage_target_h} 小时 | {fmt_status(sm)} |"
        )

    # 门禁等待时间
    lines.append("")
    lines.append("### 门禁等待时间")
    lines.append("")
    lines.append("| 阶段 | 等待时长 | 目标 | 达标 |")
    lines.append("|------|---------|------|------|")
    gate_wait_met = lt.get("gate_wait_met", {})
    stages = metrics.get("stages", {})
    gate_wait_target = lt.get("gate_wait_target_hours", 4)
    for gate_id in ("G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"):
        wait_h = stages.get(gate_id, {}).get("gate_wait_hours")
        wm = gate_wait_met.get(gate_id)
        lines.append(
            f"| {gate_id} | {fmt_duration(wait_h)} | ≤ {gate_wait_target} 小时 | {fmt_status(wm)} |"
        )
    lines.append("")
    return "\n".join(lines)


def build_gate_interception_section(metrics):
    """构建门禁拦截率部分。"""
    gi = metrics.get("gate_interception", {})

    lines = [
        "## 2. 门禁拦截率\n",
        "| 门禁 | 退回率 | 目标 | 达标 |",
        "|------|--------|------|------|",
    ]

    for key, gate_id in (("g1_return_rate", "G1"), ("g3_return_rate", "G3"), ("g5_return_rate", "G5")):
        m = gi.get(key, {})
        val = m.get("value")
        val_str = f"{val}%" if val is not None else "数据不足"
        lines.append(
            f"| {gate_id} | {val_str} | {m.get('target', '-')} | {fmt_status(m.get('met'))} |"
        )

    # 退回原因 TOP3
    lines.append("")
    lines.append("### 退回原因 TOP3")
    lines.append("")
    lines.append("| 排名 | 原因 | 次数 |")
    lines.append("|------|------|------|")
    top3 = gi.get("return_reasons_top3", [])
    if top3:
        for i, item in enumerate(top3, 1):
            lines.append(f"| {i} | {item.get('reason', '-')} | {item.get('count', 0)} |")
    else:
        lines.append("| - | 无退回记录 | - |")
    lines.append("")
    return "\n".join(lines)


def build_dora_section(metrics):
    """构建 DORA 指标部分。"""
    dora = metrics.get("dora", {})

    lines = [
        "## 3. DORA 指标\n",
        "| 指标 | 当前值 | 目标 | 达标 | 数据来源 |",
        "|------|--------|------|------|---------|",
    ]

    for key, label in (
        ("deploy_frequency", "部署频率"),
        ("change_failure_rate", "变更失败率"),
        ("mttr_hours", "MTTR"),
        ("defect_escape_rate", "缺陷逃逸率"),
    ):
        m = dora.get(key, {})
        val_str = fmt_value(m)
        source = m.get("data_source", "-")
        lines.append(
            f"| {label} | {val_str} | {m.get('target', '-')} | {fmt_status(m.get('met'))} | {source} |"
        )

    # DORA 达成度图
    dora_total = 4
    dora_complete = sum(1 for m in dora.values() if isinstance(m, dict) and m.get("value") is not None)
    dora_met = sum(1 for m in dora.values() if isinstance(m, dict) and m.get("met") is True)
    lines.append("")
    lines.append(f"**DORA 指标完整度**: {dora_complete}/{dora_total}")
    lines.append(f"  {progress_bar(dora_complete / dora_total)}")
    lines.append(f"**DORA 达标数**: {dora_met}/{dora_total}")
    lines.append(f"  {progress_bar(dora_met / dora_total)}")
    lines.append("")
    return "\n".join(lines)


def build_agent_efficiency_section(metrics):
    """构建 Agent 效能部分。"""
    ae = metrics.get("agent_efficiency", {})

    lines = [
        "## 4. Agent 效能\n",
        "| 指标 | 当前值 | 目标 | 达标 |",
        "|------|--------|------|------|",
    ]

    for key, label in (
        ("script_pass_rate", "脚本通过率"),
        ("human_intervention_count", "人工干预次数"),
        ("rework_rate", "返工率"),
        ("agent_autonomy_rate", "Agent 自主率"),
    ):
        m = ae.get(key, {})
        val_str = fmt_value(m)
        lines.append(
            f"| {label} | {val_str} | {m.get('target', '-')} | {fmt_status(m.get('met'))} |"
        )

    # 脚本通过率进度条
    sp = ae.get("script_pass_rate", {})
    sp_val = sp.get("value")
    if sp_val is not None:
        lines.append("")
        lines.append(f"**脚本通过率**: {progress_bar(sp_val / 100)} {sp_val}%")
    lines.append("")
    return "\n".join(lines)


def build_trend_section(metrics, history):
    """构建趋势分析部分（ASCII 趋势图）。"""
    if not history:
        return "## 6. 趋势分析\n\n> ⚠️ 未提供历史数据（--trend），无法生成趋势分析。\n"

    # history 可以是单条历史度量，也可以是历史度量列表
    history_list = history if isinstance(history, list) else [history]
    if not history_list:
        return "## 6. 趋势分析\n\n> ⚠️ 历史数据为空，无法生成趋势分析。\n"

    # 合并历史和当前数据
    curr_summary = metrics.get("summary", {})
    curr_lt = metrics.get("lead_time", {}).get("total_hours")
    curr_dora = metrics.get("dora", {})

    trend_points = []
    for h in history_list:
        if not isinstance(h, dict):
            continue
        h_summary = h.get("summary", {})
        trend_points.append({
            "label": h.get("collected_at", "历史")[:10],
            "lead_time_hours": h.get("lead_time", {}).get("total_hours"),
            "script_pass_rate": h.get("agent_efficiency", {}).get("script_pass_rate", {}).get("value"),
            "data_completeness": h_summary.get("data_completeness_pct"),
        })
    # 加入当前点
    trend_points.append({
        "label": metrics.get("collected_at", "本次")[:10],
        "lead_time_hours": curr_lt,
        "script_pass_rate": curr_dora and metrics.get("agent_efficiency", {}).get("script_pass_rate", {}).get("value"),
        "data_completeness": curr_summary.get("data_completeness_pct"),
    })

    lines = [
        "## 6. 趋势分析\n",
        f"> 历史数据点: {len(history_list)} 次，含本次共 {len(trend_points)} 个数据点\n",
        "### 指标对比表",
        "",
        "| 时间 | Lead Time(h) | 脚本通过率(%) | 数据完整度(%) |",
        "|------|-------------|--------------|--------------|",
    ]
    for p in trend_points:
        lt = p["lead_time_hours"] if p["lead_time_hours"] is not None else "-"
        sp = p["script_pass_rate"] if p["script_pass_rate"] is not None else "-"
        dc = p["data_completeness"] if p["data_completeness"] is not None else "-"
        lines.append(f"| {p['label']} | {lt} | {sp} | {dc} |")

    # ASCII 趋势图：Lead Time
    lines.append("")
    lines.append("### Lead Time 趋势图（小时）")
    lines.append("")
    lines.append(_ascii_trend_chart(
        [p["lead_time_hours"] for p in trend_points],
        [p["label"] for p in trend_points],
        target=LEAD_TIME_TARGET_HOURS,
        title="Lead Time (越低越好)",
    ))

    # ASCII 趋势图：脚本通过率
    lines.append("")
    lines.append("### 脚本通过率趋势图（%）")
    lines.append("")
    lines.append(_ascii_trend_chart(
        [p["script_pass_rate"] for p in trend_points],
        [p["label"] for p in trend_points],
        target=95,
        title="脚本通过率 (越高越好)",
        lower_is_better=False,
    ))
    lines.append("")
    return "\n".join(lines)


def _ascii_trend_chart(values, labels, target=None, title="", lower_is_better=True):
    """生成 ASCII 趋势图。"""
    if not values:
        return "```\n(无数据)\n```"

    # 过滤 None 值用于计算范围
    valid_vals = [v for v in values if v is not None]
    if not valid_vals:
        return "```\n(无有效数据)\n```"

    max_val = max(valid_vals)
    min_val = min(valid_vals)
    if target is not None:
        max_val = max(max_val, target)
        min_val = min(min_val, target, 0)

    val_range = max_val - min_val if max_val != min_val else 1
    chart_width = TREND_CHART_WIDTH

    lines = ["```", f"# {title}"]
    # 目标线
    if target is not None:
        target_pos = int((max_val - target) / val_range * chart_width) if val_range else chart_width // 2
        target_pos = max(0, min(chart_width, target_pos))
        target_line = "目标 " + "─" * target_pos + "★" + "─" * (chart_width - target_pos) + f"  ({target})"
        lines.append(target_line)

    # 各数据点
    for i, v in enumerate(values):
        label = labels[i] if i < len(labels) else str(i)
        if v is None:
            lines.append(f"{label:12s} | {'?' * 3}")
            continue
        pos = int((max_val - v) / val_range * chart_width) if val_range else chart_width // 2
        pos = max(0, min(chart_width, pos))
        bar = " " * pos + "●" + " " * (chart_width - pos)
        lines.append(f"{label:12s} |{bar}|  {v}")

    lines.append("```")
    return "\n".join(lines)


def build_stage_detail_section(metrics):
    """构建各阶段明细表格。"""
    stages = metrics.get("stages", {})

    lines = [
        "## 5. 各阶段明细\n",
        "| 阶段 | 门禁 | 脚本通过 | 脚本失败 | 脚本跳过 | 耗时 | 人工干预 | 状态 |",
        "|------|------|---------|---------|---------|------|---------|------|",
    ]

    for gate_id in ("G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"):
        s = stages.get(gate_id, {})
        name = s.get("name", "")
        gate = s.get("gate_result", "unknown")
        gate_icon = {"pass": "✅", "fail": "❌", "warn": "⚠️"}.get(gate, "—")
        scripts = s.get("scripts", {})
        dur_min = s.get("duration_min")
        dur_h = dur_min / 60.0 if dur_min is not None else None
        hi = s.get("human_interventions", 0)
        status = s.get("status", "unknown")
        status_icon = {"pass": "✅", "fail": "❌", "pending": "⏳"}.get(status, "—")
        lines.append(
            f"| {gate_id} ({name}) | {gate_icon} | {scripts.get('pass', 0)} | "
            f"{scripts.get('fail', 0)} | {scripts.get('skip', 0)} | "
            f"{fmt_duration(dur_h)} | {hi} | {status_icon} |"
        )
    lines.append("")
    return "\n".join(lines)


def build_data_completeness_section(metrics):
    """构建数据完整度部分。"""
    summary = metrics.get("summary", {})
    sc = summary.get("stages_complete", 0)
    st = summary.get("stages_total", 8)
    tc = summary.get("timestamp_complete", 0)
    tt = summary.get("timestamp_total", 8)
    dc = summary.get("dora_complete", 0)
    dt = summary.get("dora_total", 4)

    lines = [
        "## 7. 数据完整度\n",
        "| 检查项 | 完成 | 总数 | 完整度 |",
        "|--------|------|------|--------|",
        f"| 阶段完成 | {sc} | {st} | {progress_bar(sc / st if st else 0)} {sc / st * 100:.0f}% |",
        f"| 时间戳完整 | {tc} | {tt} | {progress_bar(tc / tt if tt else 0)} {tc / tt * 100:.0f}% |",
        f"| DORA 指标 | {dc} | {dt} | {progress_bar(dc / dt if dt else 0)} {dc / dt * 100:.0f}% |",
        "",
    ]
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════
# 看板生成主逻辑
# ═══════════════════════════════════════════════════════════════

def generate_dashboard(metrics, history=None):
    """生成完整的度量看板 Markdown 文本。"""
    dashboard_lines = [
        "# SDLC 交付效能度量看板\n",
        f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n",
        "---\n",
        build_overview(metrics),
        "---\n",
        build_lead_time_section(metrics),
        build_gate_interception_section(metrics),
        build_dora_section(metrics),
        build_agent_efficiency_section(metrics),
        build_stage_detail_section(metrics),
        build_trend_section(metrics, history),
        build_data_completeness_section(metrics),
        "---\n",
        f"*本看板由 sdlc-metrics skill 自动生成 | 需求ID: {metrics.get('requirement_id', '未知')}*\n",
    ]
    return "\n".join(dashboard_lines)


def main():
    parser = argparse.ArgumentParser(
        description="SDLC 度量看板生成器 — 读取 metrics-report.json 生成 Markdown 可视化看板",
    )
    parser.add_argument(
        "--metrics", required=True,
        help="metrics-report.json 文件路径",
    )
    parser.add_argument(
        "--output", required=True,
        help="看板输出路径（如 dashboard.md）",
    )
    parser.add_argument(
        "--trend", default=None,
        help="历史数据 JSON 路径（单条度量或度量列表），用于趋势对比",
    )
    args = parser.parse_args()

    # 加载度量数据
    metrics = load_json_safe(args.metrics)
    if metrics is None or not isinstance(metrics, dict):
        print(json.dumps({"error": f"无法加载度量数据: {args.metrics}"}, ensure_ascii=False))
        sys.exit(1)

    # 加载历史数据（可选）
    history = None
    if args.trend:
        history = load_json_safe(args.trend)
        if history is None:
            log(f"警告: 无法加载历史数据 {args.trend}，将跳过趋势分析")
        else:
            log(f"已加载历史数据: {args.trend}")

    # 生成看板
    dashboard_text = generate_dashboard(metrics, history)

    # 写入输出文件
    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(dashboard_text, encoding="utf-8")
    log(f"看板已生成: {output_path}")

    # 控制台摘要
    print(json.dumps({
        "status": "success",
        "output": str(output_path),
        "metrics_source": args.metrics,
        "trend_enabled": history is not None,
    }, ensure_ascii=False, indent=2))

    print(f"\n{'=' * 60}", file=sys.stderr)
    print(f"SDLC 度量看板已生成", file=sys.stderr)
    print(f"  看板路径: {output_path}", file=sys.stderr)
    print(f"  趋势分析: {'已启用' if history else '未启用（无 --trend）'}", file=sys.stderr)
    print(f"{'=' * 60}", file=sys.stderr)
    sys.exit(0)


if __name__ == "__main__":
    main()
