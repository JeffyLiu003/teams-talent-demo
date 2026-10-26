#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
并行调度器（Parallel Scheduler）- 识别可并行阶段并管理并行组。

功能：
    - plan:     根据当前阶段生成并行计划（哪些阶段可以并行）
    - start:    启动并行组（--group-id --phases）
    - sync:     检查并行组是否全部完成（--group-id）
    - conflict: 检测文件级冲突（两个并行Agent是否修改同一文件）

并行规则：
    - P1 组：G3（开发）+ G4-design（测试设计），前置条件 G2 完成
    - P2 组：G6（发布准备）+ G7（变更申请），前置条件 G5 完成
    - 其他阶段串行执行

数据文件：.sdlc-demo/context-bus.json（parallel_groups 数组）
退出码：0=成功, 1=失败/存在冲突

用法示例：
    python parallel_scheduler.py plan
    python parallel_scheduler.py start --group-id P1 --phases G3,G4-design
    python parallel_scheduler.py sync --group-id P1
    python parallel_scheduler.py conflict --group-id P1
"""

import argparse
import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# ═══════════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════════

DEFAULT_BASE_DIR = Path(".sdlc-demo")
DEFAULT_CONTEXT_FILE = DEFAULT_BASE_DIR / "context-bus.json"

CST = timezone(timedelta(hours=8))

VALID_PHASES = {"G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"}

PHASE_NAMES = {
    "G1": "需求", "G2": "设计", "G3": "开发", "G4": "测试",
    "G5": "安全", "G6": "发布", "G7": "变更", "G8": "管理",
}

# 并行组定义
PARALLEL_GROUP_DEFS = [
    {
        "group_id": "P1",
        "phases": ["G3", "G4-design"],
        "prerequisite": "G2",
        "sync_point": "G5",
        "desc": "G3 开发 + G4 测试设计",
    },
    {
        "group_id": "P2",
        "phases": ["G6", "G7"],
        "prerequisite": "G5",
        "sync_point": "G8",
        "desc": "G6 发布准备 + G7 变更申请",
    },
]


def get_timestamp() -> str:
    """获取当前时间戳（ISO 8601 格式，东八区）。"""
    return datetime.now(CST).isoformat()


def get_context_path(base_dir: str | None = None) -> Path:
    """获取 context-bus.json 文件路径。"""
    if base_dir:
        return Path(base_dir) / "context-bus.json"
    return DEFAULT_CONTEXT_FILE


def load_context(file_path: Path) -> dict:
    """加载 context-bus.json。"""
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


def get_base_phase(phase_label: str) -> str:
    """从阶段标签提取基础阶段代码（如 G4-design -> G4）。"""
    return phase_label.split("-")[0].upper()


def is_phase_completed(context: dict, phase_label: str) -> bool:
    """检查指定阶段是否已完成。

    对于带子标签的阶段（如 G4-design），检查其基础阶段（G4）的完成状态。
    """
    base = get_base_phase(phase_label)
    phases = context.get("phases", {})
    info = phases.get(base)
    if not info:
        return False
    return info.get("status") == "completed"


def get_phase_outputs(context: dict, phase_label: str) -> list[str]:
    """获取指定阶段的产出文件列表。"""
    base = get_base_phase(phase_label)
    phases = context.get("phases", {})
    info = phases.get(base, {})
    return info.get("outputs", [])


def find_parallel_group(context: dict, group_id: str) -> dict | None:
    """在 context-bus.json 的 parallel_groups 中查找指定 group_id 的并行组。"""
    for pg in context.get("parallel_groups", []):
        if pg.get("group_id") == group_id:
            return pg
    return None


# ═══════════════════════════════════════════════════════════════
# 命令处理函数
# ═══════════════════════════════════════════════════════════════

def cmd_plan(args) -> int:
    """根据当前阶段生成并行计划。"""
    file_path = get_context_path(args.base_dir)
    context = load_context(file_path)

    if not context:
        print(f"错误：context-bus.json 不存在，请先执行 context_bus.py init。路径: {file_path}", file=sys.stderr)
        return 1

    print("=" * 70)
    print("SDLC 并行计划")
    print("=" * 70)

    project = context.get("project", {})
    print(f"项目: {project.get('name', 'N/A')}  需求ID: {project.get('requirement_id', 'N/A')}")
    print("-" * 70)

    for gdef in PARALLEL_GROUP_DEFS:
        prereq_met = is_phase_completed(context, gdef["prerequisite"])
        all_done = all(is_phase_completed(context, p) for p in gdef["phases"])

        if all_done:
            status = "completed"
        elif prereq_met:
            status = "ready"
        else:
            status = "waiting"

        # 检查是否已在 parallel_groups 中启动
        existing = find_parallel_group(context, gdef["group_id"])
        if existing:
            status = existing.get("status", status)

        phases_str = " + ".join(gdef["phases"])
        prereq_str = "已满足" if prereq_met else "未满足"
        print(f"  {gdef['group_id']}: {phases_str}")
        print(f"    说明:     {gdef['desc']}")
        print(f"    前置:     {gdef['prerequisite']}({prereq_str})")
        print(f"    同步点:   {gdef['sync_point']}")
        print(f"    状态:     {status}")
        print()

    print("-" * 70)
    ready = [
        gdef for gdef in PARALLEL_GROUP_DEFS
        if is_phase_completed(context, gdef["prerequisite"])
        and not all(is_phase_completed(context, p) for p in gdef["phases"])
    ]
    if ready:
        print(f"可启动的并行组: {', '.join(g['group_id'] for g in ready)}")
        for g in ready:
            phases_str = ",".join(g["phases"])
            print(f"  启动命令: python parallel_scheduler.py start --group-id {g['group_id']} --phases {phases_str}")
    else:
        # 检查是否全部完成
        all_done = all(
            all(is_phase_completed(context, p) for p in gdef["phases"])
            for gdef in PARALLEL_GROUP_DEFS
        )
        if all_done:
            print("所有并行组已完成")
        else:
            print("当前无可启动的并行组（等待前置条件完成）")
    print("=" * 70)
    return 0


def cmd_start(args) -> int:
    """启动并行组。"""
    file_path = get_context_path(args.base_dir)
    context = load_context(file_path)

    if not context:
        print(f"错误：context-bus.json 不存在，请先执行 context_bus.py init。路径: {file_path}", file=sys.stderr)
        return 1

    group_id = args.group_id.upper()
    phases = [p.strip() for p in args.phases.split(",") if p.strip()]

    if len(phases) < 2:
        print("错误：至少需要指定 2 个阶段进行并行", file=sys.stderr)
        return 1

    # 校验阶段代码
    for p in phases:
        base = get_base_phase(p)
        if base not in VALID_PHASES:
            print(f"错误：无效的阶段代码: {p}（基础阶段有效值: G1-G8）", file=sys.stderr)
            return 1

    # 检查是否已存在同 group_id 的并行组
    existing = find_parallel_group(context, group_id)
    if existing:
        print(f"错误：并行组 {group_id} 已存在（状态: {existing.get('status', 'unknown')}）", file=sys.stderr)
        return 1

    timestamp = get_timestamp()
    group_record = {
        "group_id": group_id,
        "phases": phases,
        "status": "running",
        "started_at": timestamp,
        "completed_at": None,
        "phase_status": {p: "pending" for p in phases},
    }

    # 查找匹配的并行组定义以记录前置和同步点
    for gdef in PARALLEL_GROUP_DEFS:
        if gdef["group_id"] == group_id:
            group_record["prerequisite"] = gdef["prerequisite"]
            group_record["sync_point"] = gdef["sync_point"]
            group_record["desc"] = gdef["desc"]
            break

    context.setdefault("parallel_groups", []).append(group_record)
    save_context(file_path, context)

    print(f"已启动并行组: {group_id}")
    print(f"  阶段:       {', '.join(phases)}")
    print(f"  状态:       running")
    print(f"  启动时间:   {timestamp}")
    print(f"  提示: 各阶段完成后执行 sync 检查同步状态")
    return 0


def cmd_sync(args) -> int:
    """检查并行组是否全部完成。"""
    file_path = get_context_path(args.base_dir)
    context = load_context(file_path)

    if not context:
        print(f"错误：context-bus.json 不存在。路径: {file_path}", file=sys.stderr)
        return 1

    group_id = args.group_id.upper()
    group = find_parallel_group(context, group_id)
    if group is None:
        print(f"错误：并行组 {group_id} 不存在", file=sys.stderr)
        return 1

    phases = group.get("phases", [])
    phase_status = group.get("phase_status", {})

    # 更新各阶段状态
    print("=" * 70)
    print(f"并行组 {group_id} 同步检查")
    print("=" * 70)
    print(f"启动时间: {group.get('started_at', 'N/A')}")
    print("-" * 70)

    all_done = True
    for p in phases:
        completed = is_phase_completed(context, p)
        phase_status[p] = "completed" if completed else "pending"
        mark = "[完成]" if completed else "[进行中]"
        print(f"  {p:<12s}  {mark}")
        if not completed:
            all_done = False

    group["phase_status"] = phase_status

    if all_done:
        group["status"] = "completed"
        group["completed_at"] = get_timestamp()
        save_context(file_path, context)
        print("-" * 70)
        print(f"结果: 全部完成，并行组 {group_id} 已同步")
        print(f"完成时间: {group['completed_at']}")
        sync_point = group.get("sync_point")
        if sync_point:
            print(f"提示: 可进入下一阶段 {sync_point}")
        print("=" * 70)
        return 0
    else:
        group["status"] = "running"
        save_context(file_path, context)
        pending = [p for p in phases if phase_status.get(p) != "completed"]
        print("-" * 70)
        print(f"结果: 未全部完成，等待 {', '.join(pending)}")
        print("=" * 70)
        return 0


def cmd_conflict(args) -> int:
    """检测文件级冲突（两个并行Agent是否修改同一文件）。"""
    file_path = get_context_path(args.base_dir)
    context = load_context(file_path)

    if not context:
        print(f"错误：context-bus.json 不存在。路径: {file_path}", file=sys.stderr)
        return 1

    # 确定要检查的阶段列表
    if args.group_id:
        group_id = args.group_id.upper()
        group = find_parallel_group(context, group_id)
        if group is None:
            print(f"错误：并行组 {group_id} 不存在", file=sys.stderr)
            return 1
        phases = group.get("phases", [])
        print(f"检查并行组 {group_id} 的文件冲突")
    elif args.phases:
        phases = [p.strip() for p in args.phases.split(",") if p.strip()]
        print(f"检查指定阶段的文件冲突: {', '.join(phases)}")
    else:
        # 默认检查所有 running 状态的并行组
        running_groups = [
            pg for pg in context.get("parallel_groups", [])
            if pg.get("status") == "running"
        ]
        if not running_groups:
            print("无运行中的并行组，无需冲突检查")
            print("提示: 使用 --group-id 或 --phases 指定检查范围")
            return 0
        phases = []
        for pg in running_groups:
            phases.extend(pg.get("phases", []))
        print(f"检查所有运行中并行组的文件冲突: {', '.join(phases)}")

    print("=" * 70)
    print("文件级冲突检测")
    print("=" * 70)

    # 收集每个阶段的产出文件
    phase_files: dict[str, list[str]] = {}
    for p in phases:
        files = get_phase_outputs(context, p)
        phase_files[p] = files
        print(f"  {p:<12s}  产出文件 ({len(files)} 个): {', '.join(files) if files else '无'}")

    print("-" * 70)

    # 检测文件交集
    conflicts = []
    checked_pairs = set()
    phase_list = list(phase_files.keys())
    for i in range(len(phase_list)):
        for j in range(i + 1, len(phase_list)):
            p1, p2 = phase_list[i], phase_list[j]
            pair_key = tuple(sorted([p1, p2]))
            if pair_key in checked_pairs:
                continue
            checked_pairs.add(pair_key)
            set1 = set(phase_files[p1])
            set2 = set(phase_files[p2])
            overlap = set1 & set2
            if overlap:
                conflicts.append((p1, p2, sorted(overlap)))

    if conflicts:
        print(f"发现 {len(conflicts)} 项文件冲突:")
        for p1, p2, files in conflicts:
            print(f"  [X] {p1} <-> {p2}: {', '.join(files)}")
        print()
        print("建议: 对冲突文件加文件级锁，或串行化执行冲突阶段")
        print("=" * 70)
        return 1
    else:
        print("结果: 无文件冲突，各并行阶段产出文件无重叠")
        print("=" * 70)
        return 0


# ═══════════════════════════════════════════════════════════════
# 主入口
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="SDLC 并行调度器 - 识别可并行阶段并管理并行组",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
示例:
  python parallel_scheduler.py plan
  python parallel_scheduler.py start --group-id P1 --phases G3,G4-design
  python parallel_scheduler.py sync --group-id P1
  python parallel_scheduler.py conflict --group-id P1
  python parallel_scheduler.py conflict --phases G3,G4-design
""",
    )
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    # plan
    p_plan = subparsers.add_parser("plan", help="根据当前阶段生成并行计划")
    p_plan.add_argument("--base-dir", default=None, help="自定义基目录路径")

    # start
    p_start = subparsers.add_parser("start", help="启动并行组")
    p_start.add_argument("--group-id", required=True, help="并行组ID (如 P1)")
    p_start.add_argument("--phases", required=True, help="阶段列表，逗号分隔（如 G3,G4-design）")
    p_start.add_argument("--base-dir", default=None, help="自定义基目录路径")

    # sync
    p_sync = subparsers.add_parser("sync", help="检查并行组是否全部完成")
    p_sync.add_argument("--group-id", required=True, help="并行组ID (如 P1)")
    p_sync.add_argument("--base-dir", default=None, help="自定义基目录路径")

    # conflict
    p_conflict = subparsers.add_parser("conflict", help="检测文件级冲突")
    p_conflict.add_argument("--group-id", default=None, help="并行组ID（与 --phases 二选一）")
    p_conflict.add_argument("--phases", default=None, help="阶段列表，逗号分隔（与 --group-id 二选一）")
    p_conflict.add_argument("--base-dir", default=None, help="自定义基目录路径")

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return 1

    command_handlers = {
        "plan": cmd_plan,
        "start": cmd_start,
        "sync": cmd_sync,
        "conflict": cmd_conflict,
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
