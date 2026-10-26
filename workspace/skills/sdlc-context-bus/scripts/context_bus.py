#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
上下文总线（Context Bus）- 管理 SDLC 各阶段结构化上下文。

功能：
    - init:     初始化 context-bus.json
    - write:    写入阶段产出（--phase --agent --outputs --status --context）
    - read:     读取阶段上下文（--phase）
    - status:   打印全局状态概览
    - validate: 校验上下文完整性（产出文件存在性 + ID链完整性）

数据文件：.sdlc-demo/context-bus.json
退出码：0=成功, 1=校验失败

用法示例：
    python context_bus.py init --requirement-id REQ-001 --name "示例项目" --title "需求标题"
    python context_bus.py write --phase G1 --agent requirement-analyst \\
        --outputs file1.md,file2.md --status completed --context '{"key":"value"}'
    python context_bus.py read --phase G1
    python context_bus.py status
    python context_bus.py validate
"""

import argparse
import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# ═══════════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════════

# 阶段代码 -> 中文名称
PHASES = ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"]

PHASE_NAMES = {
    "G1": "需求",
    "G2": "设计",
    "G3": "开发",
    "G4": "测试",
    "G5": "安全",
    "G6": "发布",
    "G7": "变更",
    "G8": "管理",
}

# 默认数据文件路径
DEFAULT_BASE_DIR = Path(".sdlc-demo")
DEFAULT_CONTEXT_FILE = DEFAULT_BASE_DIR / "context-bus.json"

# 时区（东八区）
CST = timezone(timedelta(hours=8))


def get_timestamp() -> str:
    """获取当前时间戳（ISO 8601 格式，东八区）。"""
    return datetime.now(CST).isoformat()


def get_context_path(base_dir: str | None = None) -> Path:
    """获取 context-bus.json 文件路径。"""
    if base_dir:
        return Path(base_dir) / "context-bus.json"
    return DEFAULT_CONTEXT_FILE


def load_context(file_path: Path) -> dict:
    """加载 context-bus.json。文件不存在时返回空字典。"""
    if not file_path.exists():
        return {}
    try:
        return json.loads(file_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"错误：context-bus.json 解析失败: {e}", file=sys.stderr)
        sys.exit(1)


def save_context(file_path: Path, data: dict) -> None:
    """保存上下文到 context-bus.json（UTF-8 无 BOM）。"""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def build_empty_context(name: str, requirement_id: str, title: str) -> dict:
    """构建初始化的空上下文结构。"""
    return {
        "project": {
            "name": name,
            "requirement_id": requirement_id,
            "requirement_title": title,
        },
        "phases": {},
        "callbacks": [],
        "parallel_groups": [],
        "branches": [],
    }


# ═══════════════════════════════════════════════════════════════
# 命令处理函数
# ═══════════════════════════════════════════════════════════════

def cmd_init(args) -> int:
    """初始化 context-bus.json。"""
    file_path = get_context_path(args.base_dir)

    if file_path.exists() and not args.force:
        print(f"警告：文件已存在: {file_path}（使用 --force 覆盖）", file=sys.stderr)
        return 1

    context = build_empty_context(args.name, args.requirement_id, args.title)
    save_context(file_path, context)
    print(f"已初始化上下文总线: {file_path}")
    print(f"  项目名称: {args.name}")
    print(f"  需求ID:   {args.requirement_id}")
    print(f"  需求标题: {args.title}")
    return 0


def cmd_write(args) -> int:
    """将阶段产出写入 context-bus.json。"""
    file_path = get_context_path(args.base_dir)
    context = load_context(file_path)

    if not context:
        print(f"错误：context-bus.json 不存在或为空，请先执行 init。路径: {file_path}", file=sys.stderr)
        return 1

    phase = args.phase.upper()
    if phase not in PHASES:
        print(f"错误：无效的阶段代码: {args.phase}（有效值: G1-G8）", file=sys.stderr)
        return 1

    # 解析产出文件列表
    outputs = [o.strip() for o in args.outputs.split(",") if o.strip()] if args.outputs else []

    # 解析 context JSON
    try:
        ctx = json.loads(args.context) if args.context else {}
    except json.JSONDecodeError as e:
        print(f"错误：--context 参数不是有效的 JSON: {e}", file=sys.stderr)
        return 1

    timestamp = get_timestamp()
    phases = context.setdefault("phases", {})
    existing = phases.get(phase, {})

    phase_data = {
        "agent": args.agent,
        "status": args.status,
        "started_at": existing.get("started_at", timestamp),
        "completed_at": timestamp if args.status == "completed" else existing.get("completed_at"),
        "outputs": outputs,
        "context": ctx,
    }
    # 保留已有的门禁结果
    if "gate_result" in existing:
        phase_data["gate_result"] = existing["gate_result"]
    if "gate_details" in existing:
        phase_data["gate_details"] = existing["gate_details"]

    phases[phase] = phase_data
    save_context(file_path, context)

    print(f"已写入 {phase}（{PHASE_NAMES[phase]}）阶段上下文")
    print(f"  Agent:     {args.agent}")
    print(f"  状态:      {args.status}")
    print(f"  产出文件:  {len(outputs)} 个")
    print(f"  时间:      {timestamp}")
    return 0


def cmd_read(args) -> int:
    """读取指定阶段的上下文。"""
    file_path = get_context_path(args.base_dir)
    context = load_context(file_path)

    if not context:
        print(f"错误：context-bus.json 不存在或为空。路径: {file_path}", file=sys.stderr)
        return 1

    phase = args.phase.upper()
    if phase not in PHASES:
        print(f"错误：无效的阶段代码: {args.phase}（有效值: G1-G8）", file=sys.stderr)
        return 1

    phase_data = context.get("phases", {}).get(phase)
    if not phase_data:
        print(f"阶段 {phase}（{PHASE_NAMES[phase]}）无上下文数据", file=sys.stderr)
        return 1

    print(json.dumps(phase_data, indent=2, ensure_ascii=False))
    return 0


def cmd_status(args) -> int:
    """打印全局状态概览。"""
    file_path = get_context_path(args.base_dir)
    context = load_context(file_path)

    if not context:
        print(f"错误：context-bus.json 不存在或为空。路径: {file_path}", file=sys.stderr)
        return 1

    project = context.get("project", {})
    phases = context.get("phases", {})
    callbacks = context.get("callbacks", [])
    parallel_groups = context.get("parallel_groups", [])
    branches = context.get("branches", [])

    print("=" * 70)
    print("SDLC 上下文总线 - 全局状态概览")
    print("=" * 70)
    print(f"项目名称:   {project.get('name', 'N/A')}")
    print(f"需求ID:     {project.get('requirement_id', 'N/A')}")
    print(f"需求标题:   {project.get('requirement_title', 'N/A')}")
    print("-" * 70)
    print("阶段状态:")
    print("-" * 70)

    completed_count = 0
    for phase in PHASES:
        info = phases.get(phase)
        if info:
            status = info.get("status", "unknown")
            agent = info.get("agent", "N/A")
            outputs = info.get("outputs", [])
            mark = "[完成]" if status == "completed" else f"[{status}]"
            if status == "completed":
                completed_count += 1
            print(f"  {phase} {PHASE_NAMES[phase]:>4s}  {mark:<12s}  Agent: {agent:<24s}  产出: {len(outputs)} 个")
        else:
            print(f"  {phase} {PHASE_NAMES[phase]:>4s}  [待办]")

    print("-" * 70)
    print(f"回调: {len(callbacks)} 条  |  并行组: {len(parallel_groups)} 个  |  分支: {len(branches)} 条")
    print(f"进度: {completed_count}/{len(PHASES)} 阶段已完成")
    print("=" * 70)
    return 0


def cmd_validate(args) -> int:
    """校验上下文完整性：产出文件存在性 + ID链完整性。"""
    file_path = get_context_path(args.base_dir)
    context = load_context(file_path)

    if not context:
        print(f"错误：context-bus.json 不存在或为空。路径: {file_path}", file=sys.stderr)
        return 1

    errors = []
    warnings = []

    # ── 1. 校验项目信息 ──
    project = context.get("project", {})
    req_id = project.get("requirement_id", "")
    if not req_id:
        errors.append("project.requirement_id 为空，ID链断裂")
    if not project.get("name"):
        warnings.append("project.name 为空")
    if not project.get("requirement_title"):
        warnings.append("project.requirement_title 为空")

    # ── 2. 校验各阶段产出文件存在性 ──
    phases = context.get("phases", {})
    for phase in PHASES:
        info = phases.get(phase)
        if not info:
            continue
        status = info.get("status", "")
        outputs = info.get("outputs", [])
        if status == "completed":
            for out_file in outputs:
                out_path = Path(out_file)
                if not out_path.is_absolute():
                    # 相对路径基于当前工作目录解析
                    out_path = Path.cwd() / out_file
                if not out_path.exists():
                    errors.append(f"{phase} 产出文件不存在: {out_file}")

        # ID链校验：已完成阶段的 context 中不应出现与 project 冲突的 requirement_id
        ctx = info.get("context", {})
        if isinstance(ctx, dict):
            ctx_req_id = ctx.get("requirement_id") or ctx.get("req_id")
            if ctx_req_id and req_id and ctx_req_id != req_id:
                errors.append(
                    f"{phase} context.requirement_id({ctx_req_id}) 与 "
                    f"project.requirement_id({req_id}) 不一致，ID链断裂"
                )

    # ── 3. 校验阶段顺序完整性（前置阶段应先完成）──
    phase_order = PHASES
    for i, phase in enumerate(phase_order):
        info = phases.get(phase)
        if not info or info.get("status") != "completed":
            continue
        # 检查是否有前置阶段未完成却跳到了当前阶段（仅警告）
        for prev_phase in phase_order[:i]:
            prev_info = phases.get(prev_phase)
            if not prev_info or prev_info.get("status") != "completed":
                # 允许并行阶段跳过前置检查（如G3+G4并行），仅告警
                warnings.append(f"{phase} 已完成但前置 {prev_phase} 尚未完成（可能是并行编排）")
                break

    # ── 4. 校验回调与并行组引用合法性 ──
    callbacks = context.get("callbacks", [])
    for cb in callbacks:
        from_phase = cb.get("from_phase", "")
        if from_phase and from_phase not in PHASES:
            errors.append(f"回调 {cb.get('callback_id', '?')} 的 from_phase 无效: {from_phase}")

    parallel_groups = context.get("parallel_groups", [])
    for pg in parallel_groups:
        for p in pg.get("phases", []):
            base = p.split("-")[0].upper()
            if base not in PHASES:
                errors.append(f"并行组 {pg.get('group_id', '?')} 包含无效阶段: {p}")

    # ── 输出结果 ──
    print("=" * 70)
    print("上下文完整性校验")
    print("=" * 70)

    if warnings:
        print(f"告警 ({len(warnings)} 项):")
        for w in warnings:
            print(f"  [!] {w}")
        print()

    if errors:
        print(f"错误 ({len(errors)} 项):")
        for e in errors:
            print(f"  [X] {e}")
        print()
        print(f"校验结果: 失败（{len(errors)} 项错误）")
        print("=" * 70)
        return 1

    print(f"校验结果: 通过（阶段={len(phases)}, 回调={len(callbacks)}, 并行组={len(parallel_groups)}）")
    if warnings:
        print(f"  （{len(warnings)} 项告警已忽略）")
    print("=" * 70)
    return 0


# ═══════════════════════════════════════════════════════════════
# 主入口
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="SDLC 上下文总线 - 管理各阶段结构化上下文",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
示例:
  python context_bus.py init --requirement-id REQ-001 --name "项目" --title "标题"
  python context_bus.py write --phase G1 --agent ba --outputs a.md,b.md --status completed
  python context_bus.py read --phase G1
  python context_bus.py status
  python context_bus.py validate
""",
    )
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    # init
    p_init = subparsers.add_parser("init", help="初始化 context-bus.json")
    p_init.add_argument("--requirement-id", required=True, help="需求ID")
    p_init.add_argument("--name", default="", help="项目名称")
    p_init.add_argument("--title", default="", help="需求标题")
    p_init.add_argument("--base-dir", default=None, help="自定义基目录路径")
    p_init.add_argument("--force", action="store_true", help="覆盖已存在的文件")

    # write
    p_write = subparsers.add_parser("write", help="写入阶段产出")
    p_write.add_argument("--phase", required=True, help="阶段代码 (G1-G8)")
    p_write.add_argument("--agent", required=True, help="执行 Agent 名称")
    p_write.add_argument("--outputs", default="", help="产出文件列表，逗号分隔")
    p_write.add_argument("--status", default="completed", help="阶段状态 (completed/in_progress)")
    p_write.add_argument("--context", default="", help="上下文数据 (JSON 字符串)")
    p_write.add_argument("--base-dir", default=None, help="自定义基目录路径")

    # read
    p_read = subparsers.add_parser("read", help="读取阶段上下文")
    p_read.add_argument("--phase", required=True, help="阶段代码 (G1-G8)")
    p_read.add_argument("--base-dir", default=None, help="自定义基目录路径")

    # status
    p_status = subparsers.add_parser("status", help="打印全局状态概览")
    p_status.add_argument("--base-dir", default=None, help="自定义基目录路径")

    # validate
    p_validate = subparsers.add_parser("validate", help="校验上下文完整性")
    p_validate.add_argument("--base-dir", default=None, help="自定义基目录路径")

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return 1

    command_handlers = {
        "init": cmd_init,
        "write": cmd_write,
        "read": cmd_read,
        "status": cmd_status,
        "validate": cmd_validate,
    }
    handler = command_handlers.get(args.command)
    if handler is None:
        parser.print_help()
        return 1

    try:
        return handler(args)
    except Exception as e:
        print(f"错误：{type(e).__name__}: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
