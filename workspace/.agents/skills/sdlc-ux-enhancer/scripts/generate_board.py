#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
进度看板生成器 - 从 context-bus.json 读取各阶段状态，生成 Markdown 格式的进度看板。

功能：
    --context <path>   : 指定 context-bus.json 路径
    --output <path>    : 输出到文件（默认同时输出到 stdout 与文件）
    --watch            : 持续监控模式，每 30 秒刷新一次看板
    --interval <sec>   : 刷新间隔（秒，默认 30，仅 --watch 时生效）

context-bus.json 期望结构（字段宽容，缺失则用默认值/推导）：
    {
      "project": "EPS-demo-project",
      "requirement": "REQ-2026-0003 日累计限额参数化",
      "stages": {
        "G1": {
          "name": "需求",
          "status": "passed",          // passed|in_progress|pending|failed
          "gate": "PASS",              // PASS|FAIL|PENDING|BYPASS
          "duration": "30min",         // 可选，缺失时由 start/end 推导
          "artifacts": 5,              // 可选，产出数
          "start": "2026-08-11 09:00:00",
          "end": "2026-08-11 09:30:00"
        },
        ...
      }
    }

输出：Markdown 文件（含 ASCII 看板 + Markdown 表格）
退出码：0=成功, 1=失败
"""

import argparse
import json
import sys
import time
import unicodedata
from datetime import datetime
from pathlib import Path

# ═══════════════════════════════════════════════════════════════
# 阶段配置：G1-G8
# ═══════════════════════════════════════════════════════════════

STAGES = [
    {"id": "G1", "name": "需求"},
    {"id": "G2", "name": "设计"},
    {"id": "G3", "name": "开发"},
    {"id": "G4", "name": "测试"},
    {"id": "G5", "name": "安全"},
    {"id": "G6", "name": "发布"},
    {"id": "G7", "name": "变更"},
    {"id": "G8", "name": "管理"},
]

# 状态展示映射
STATUS_DISPLAY = {
    "passed": "✅完成",
    "in_progress": "🔄进行中",
    "pending": "⏳等待",
    "failed": "❌失败",
}

# 门禁展示映射
GATE_DISPLAY = {
    "PASS": "✅ PASS",
    "FAIL": "❌ FAIL",
    "PENDING": "⏳ 待执行",
    "BYPASS": "⏸ 旁路",
}

# 规范化状态输入别名
STATUS_ALIASES = {
    "passed": "passed",
    "pass": "passed",
    "done": "passed",
    "completed": "passed",
    "完成": "passed",
    "通过": "passed",
    "in_progress": "in_progress",
    "in-progress": "in_progress",
    "running": "in_progress",
    "进行中": "in_progress",
    "进行": "in_progress",
    "pending": "pending",
    "waiting": "pending",
    "wait": "pending",
    "等待": "pending",
    "未开始": "pending",
    "failed": "failed",
    "fail": "failed",
    "失败": "failed",
}

GATE_ALIASES = {
    "pass": "PASS",
    "passed": "PASS",
    "fail": "FAIL",
    "failed": "FAIL",
    "pending": "PENDING",
    "wait": "PENDING",
    "bypass": "BYPASS",
    "bypassed": "BYPASS",
}


# ═══════════════════════════════════════════════════════════════
# 显示宽度工具（处理 CJK 全角字符）
# ═══════════════════════════════════════════════════════════════

def display_width(text: str) -> int:
    """计算字符串在等宽终端中的显示宽度（CJK 字符算 2）。"""
    width = 0
    for ch in text:
        ea = unicodedata.east_asian_width(ch)
        width += 2 if ea in ("W", "F") else 1
    return width


def pad_to_width(text: str, target_width: int) -> str:
    """按显示宽度右补空格对齐。"""
    dw = display_width(text)
    if dw >= target_width:
        return text
    return text + " " * (target_width - dw)


# ═══════════════════════════════════════════════════════════════
# context-bus.json 读取与解析
# ═══════════════════════════════════════════════════════════════

def load_context_bus(context_path: Path) -> dict:
    """读取并解析 context-bus.json，返回规范化后的数据结构。"""
    if not context_path.exists():
        raise FileNotFoundError(f"context-bus.json 不存在: {context_path}")

    try:
        # utf-8-sig 兼容带 BOM 的 Windows 文件
        data = json.loads(context_path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as e:
        raise ValueError(f"context-bus.json 解析失败: {e}")

    if not isinstance(data, dict):
        raise ValueError("context-bus.json 顶层必须是对象")

    project = data.get("project") or data.get("project_name") or "未命名项目"
    requirement = (
        data.get("requirement")
        or data.get("requirement_id")
        or data.get("req_id")
        or "未指定需求"
    )

    # 兼容 stages 嵌套 或 顶层直接是 G1/G2...
    raw_stages = data.get("stages")
    if not isinstance(raw_stages, dict):
        raw_stages = {
            s["id"]: data.get(s["id"], {})
            for s in STAGES
            if isinstance(data.get(s["id"]), dict)
        }
    if not isinstance(raw_stages, dict):
        raw_stages = {}

    stages = {}
    for stage in STAGES:
        sid = stage["id"]
        entry = raw_stages.get(sid, {})
        if not isinstance(entry, dict):
            entry = {}
        stages[sid] = normalize_stage_entry(sid, stage["name"], entry)

    return {
        "project": project,
        "requirement": requirement,
        "stages": stages,
        "updated_at": data.get("updated_at") or data.get("timestamp"),
    }


def normalize_stage_entry(sid: str, default_name: str, entry: dict) -> dict:
    """规范化单个阶段条目。"""
    name = entry.get("name") or default_name

    # 状态
    raw_status = str(entry.get("status", "pending")).strip().lower()
    status = STATUS_ALIASES.get(raw_status, "pending")

    # 门禁
    raw_gate = str(entry.get("gate", "")).strip()
    gate_key = raw_gate.lower() if raw_gate else ""
    if not gate_key:
        # 由状态推导门禁展示
        if status == "passed":
            gate = "PASS"
        elif status == "failed":
            gate = "FAIL"
        elif status == "in_progress":
            gate = "PENDING"
        else:
            gate = ""
    else:
        gate = GATE_ALIASES.get(gate_key, raw_gate.upper())

    # 产出数
    artifacts = entry.get("artifacts", entry.get("artifact_count", 0))
    try:
        artifacts = int(artifacts)
    except (TypeError, ValueError):
        artifacts = 0

    # 耗时：优先使用显式 duration，否则由 start/end 推导
    duration = entry.get("duration") or ""
    if not duration:
        duration = calc_duration(entry.get("start"), entry.get("end"))

    return {
        "id": sid,
        "name": name,
        "status": status,
        "gate": gate,
        "duration": duration,
        "artifacts": artifacts,
    }


def calc_duration(start_str, end_str) -> str:
    """由 start/end 时间字符串计算耗时，返回人类可读格式。"""
    if not start_str or not end_str:
        return ""

    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M",
    ]
    start_dt = parse_time(start_str, formats)
    end_dt = parse_time(end_str, formats)
    if start_dt is None or end_dt is None:
        return ""

    delta = end_dt - start_dt
    total_minutes = int(delta.total_seconds() / 60)
    if total_minutes < 0:
        return ""
    hours = total_minutes // 60
    minutes = total_minutes % 60
    if hours > 0 and minutes > 0:
        return f"{hours}h{minutes}m"
    elif hours > 0:
        return f"{hours}h"
    else:
        return f"{minutes}min"


def parse_time(time_str, formats):
    for fmt in formats:
        try:
            return datetime.strptime(str(time_str).strip(), fmt)
        except (ValueError, TypeError):
            continue
    return None


# ═══════════════════════════════════════════════════════════════
# 看板渲染
# ═══════════════════════════════════════════════════════════════

def render_board(context: dict) -> str:
    """生成包含 ASCII 看板与 Markdown 表格的完整内容。"""
    project = context["project"]
    requirement = context["requirement"]
    stages = context["stages"]
    updated_at = context.get("updated_at") or datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 构造各阶段展示行
    rows = []
    started_count = 0  # 已启动阶段（passed + in_progress + failed），用于总进度
    total_minutes = 0
    for stage in STAGES:
        s = stages[stage["id"]]
        status_label = STATUS_DISPLAY.get(s["status"], "⏳等待")
        gate_label = GATE_DISPLAY.get(s["gate"], "—") if s["gate"] else "—"
        duration = s["duration"] or "—"
        artifacts = str(s["artifacts"]) if s["artifacts"] > 0 else "0"
        stage_label = f"{stage['id']} {s['name']}"

        rows.append({
            "stage": stage_label,
            "status": status_label,
            "duration": duration,
            "gate": gate_label,
            "artifacts": artifacts,
        })

        if s["status"] != "pending":
            started_count += 1
        total_minutes += parse_duration_minutes(s["duration"])

    # 总进度按"已启动阶段"计算（与看板示例 3/8=37.5% 语义一致）
    progress_pct = started_count / len(STAGES) * 100
    total_elapsed = format_total_elapsed(total_minutes)

    ascii_block = render_ascii_board(
        project, requirement, rows, started_count, progress_pct, total_elapsed
    )
    md_table = render_markdown_table(project, requirement, rows, updated_at)

    parts = [
        f"# SDLC 进度看板",
        "",
        f"**项目：** {project}  ",
        f"**需求：** {requirement}  ",
        f"**更新时间：** {updated_at}",
        "",
        "## 可视化看板",
        "",
        "```",
        ascii_block,
        "```",
        "",
        "## 明细表",
        "",
        md_table,
        "",
        f"> 总进度：**{started_count}/{len(STAGES)} ({progress_pct:.1f}%)**  ",
        f"> 总耗时：**{total_elapsed}**",
        "",
    ]
    return "\n".join(parts)


def parse_duration_minutes(duration: str) -> int:
    """把 '1h20m' / '30min' / '45m' 解析为分钟数。"""
    if not duration or duration == "—":
        return 0
    minutes = 0
    import re
    m = re.search(r"(\d+)\s*h", duration)
    if m:
        minutes += int(m.group(1)) * 60
    m = re.search(r"(\d+)\s*(?:m|min)", duration)
    if m:
        minutes += int(m.group(1))
    return minutes


def format_total_elapsed(total_minutes: int) -> str:
    if total_minutes <= 0:
        return "—"
    hours = total_minutes // 60
    minutes = total_minutes % 60
    if hours > 0 and minutes > 0:
        return f"{hours}h{minutes}m"
    elif hours > 0:
        return f"{hours}h"
    else:
        return f"{minutes}min"


def render_ascii_board(project, requirement, rows, progress_count,
                       progress_pct, total_elapsed) -> str:
    """渲染对齐的 ASCII 看板。"""
    # 列定义：(键, 标题, 最小宽度)
    columns = [
        ("stage", "阶段", 8),
        ("status", "状态", 8),
        ("duration", "耗时", 7),
        ("gate", "门禁", 9),
        ("artifacts", "产出数", 6),
    ]

    # 计算每列宽度（取标题与各行最大显示宽度，加左右各 1 空格内边距）
    col_widths = []
    for key, title, min_w in columns:
        max_cell = display_width(title)
        for r in rows:
            max_cell = max(max_cell, display_width(r[key]))
        col_widths.append(max(min_w, max_cell))

    inner_width = sum(col_widths) + (len(columns) - 1) * 3  # 各列间 " │ " 分隔
    # 顶部项目信息行宽度，与边框对齐
    title_line = f"  {project} SDLC 进度看板"
    req_line = f"  需求：{requirement}"
    box_width = max(inner_width + 4, display_width(title_line), display_width(req_line))
    # inner_width 至少要容纳标题行
    inner_width = max(inner_width, box_width - 4)

    def top_border():
        return "┌" + "─" * (inner_width + 2) + "┐"

    def mid_border():
        return "├" + "─" * (inner_width + 2) + "┤"

    def bottom_border():
        return "└" + "─" * (inner_width + 2) + "┘"

    def sep_border():
        # 列分隔的横线
        parts = []
        for w in col_widths:
            parts.append("─" * (w + 2))
        return "├" + "┬".join(parts) + "┤"

    def sep_border_bottom():
        parts = []
        for w in col_widths:
            parts.append("─" * (w + 2))
        return "├" + "┴".join(parts) + "┤"

    def info_line(text):
        dw = display_width(text)
        pad = inner_width + 2 - dw
        if pad < 0:
            pad = 0
        return "│" + text + " " * pad + "│"

    def row_line(cells):
        # cells: list of strings aligned to col_widths
        parts = []
        for i, cell in enumerate(cells):
            parts.append(" " + pad_to_width(cell, col_widths[i]) + " ")
        return "│" + "│".join(parts) + "│"

    lines = []
    lines.append(top_border())
    lines.append(info_line(title_line))
    lines.append(info_line(req_line))
    lines.append(sep_border())
    # 表头
    header_cells = [title for _, title, _ in columns]
    lines.append(row_line(header_cells))
    lines.append(sep_border())
    # 数据行
    for r in rows:
        lines.append(row_line([r[key] for key, _, _ in columns]))
    lines.append(sep_border_bottom())
    # 汇总行
    summary = f"  总进度：{progress_count}/{len(STAGES)} ({progress_pct:.1f}%)  总耗时：{total_elapsed}"
    lines.append(info_line(summary))
    lines.append(bottom_border())

    return "\n".join(lines)


def render_markdown_table(project, requirement, rows, updated_at) -> str:
    """渲染 Markdown 表格。"""
    lines = [
        "| 阶段 | 状态 | 耗时 | 门禁 | 产出数 |",
        "|------|------|------|------|--------|",
    ]
    for r in rows:
        lines.append(
            f"| {r['stage']} | {r['status']} | {r['duration']} | {r['gate']} | {r['artifacts']} |"
        )
    lines.append("")
    lines.append(f"- 更新时间：{updated_at}")
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════════════════════

def generate_once(context_path: Path, output_path) -> int:
    """生成一次看板并输出。"""
    try:
        context = load_context_bus(context_path)
    except (FileNotFoundError, ValueError) as e:
        print(f"错误：{e}", file=sys.stderr)
        return 1

    content = render_board(context)

    # 输出到文件
    if output_path:
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(content, encoding="utf-8")
        print(f"进度看板已生成: {out}", file=sys.stderr)

    # 同时输出到 stdout
    print(content)
    return 0


def main():
    # Windows 控制台默认 GBK，切换为 UTF-8 以支持中文/emoji 输出
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

    parser = argparse.ArgumentParser(
        description="SDLC 进度看板生成器 - 从 context-bus.json 生成 Markdown 进度看板"
    )
    parser.add_argument(
        "--context", required=True,
        help="context-bus.json 路径（如 .sdlc-demo/context-bus.json）",
    )
    parser.add_argument(
        "--output", default=None,
        help="输出文件路径（如 .sdlc-demo/progress-board.md）",
    )
    parser.add_argument(
        "--watch", action="store_true",
        help="持续监控模式，定时刷新看板",
    )
    parser.add_argument(
        "--interval", type=int, default=30,
        help="刷新间隔（秒，默认 30，仅 --watch 时生效）",
    )

    args = parser.parse_args()

    context_path = Path(args.context).resolve()
    if not context_path.exists():
        print(f"错误：context-bus.json 不存在: {context_path}", file=sys.stderr)
        sys.exit(1)

    if args.interval < 1:
        print("错误：--interval 必须 ≥1 秒", file=sys.stderr)
        sys.exit(1)

    if not args.watch:
        sys.exit(generate_once(context_path, args.output))

    # watch 模式：循环刷新
    print(f"_watch 模式已启动，每 {args.interval} 秒刷新一次（Ctrl+C 退出）", file=sys.stderr)
    try:
        while True:
            # 清屏（ANSI），便于观察最新看板
            print("\033[2J\033[H", end="")
            generate_once(context_path, args.output)
            print(f"\n[watch] 下次刷新在 {args.interval} 秒后...", file=sys.stderr)
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\n_watch 模式已停止", file=sys.stderr)
        sys.exit(0)


if __name__ == "__main__":
    main()
