#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
回调管理器（Callback Manager）- 管理阶段间缺陷回调与修复闭环。

功能：
    - create:  创建回调（--from-phase --to-agent --reason --defect-file）
    - resolve: 解决回调（--callback-id --resolution --commit）
    - list:    列出所有未解决的回调
    - check:   检查超时回调（>3次或>2小时）

数据文件：.sdlc-demo/context-bus.json（callbacks 数组）
回调ID格式：CB-NNN（自动递增）
退出码：0=成功, 1=失败/存在超时回调

用法示例：
    python callback_manager.py create --from-phase G4 --to-agent developer \\
        --reason "缺陷#001: 边界值遗漏" --defect-file .sdlc-demo/04-test/defect-001.json
    python callback_manager.py resolve --callback-id CB-001 \\
        --resolution "已补全边界值校验" --commit abc123
    python callback_manager.py list
    python callback_manager.py check
"""

import argparse
import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# ═══════════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════════

VALID_PHASES = {"G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"}

DEFAULT_BASE_DIR = Path(".sdlc-demo")
DEFAULT_CONTEXT_FILE = DEFAULT_BASE_DIR / "context-bus.json"

CST = timezone(timedelta(hours=8))

# 回调状态
STATUS_OPEN = "open"
STATUS_RESOLVED = "resolved"

# 超时阈值
MAX_RETRY_COUNT = 3
TIMEOUT_HOURS = 2


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


def parse_timestamp(ts: str) -> datetime | None:
    """解析 ISO 8601 时间戳，失败时返回 None。"""
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts)
    except (ValueError, TypeError):
        return None


def generate_callback_id(existing: list) -> str:
    """根据已有回调列表生成下一个回调ID（CB-NNN）。"""
    max_num = 0
    for cb in existing:
        cb_id = cb.get("callback_id", "")
        if cb_id.startswith("CB-"):
            try:
                num = int(cb_id[3:])
                if num > max_num:
                    max_num = num
            except ValueError:
                pass
    return f"CB-{max_num + 1:03d}"


def find_callback(callbacks: list, callback_id: str) -> dict | None:
    """根据回调ID查找回调记录。"""
    for cb in callbacks:
        if cb.get("callback_id") == callback_id:
            return cb
    return None


def count_retries(callbacks: list, from_phase: str, to_agent: str, reason: str) -> int:
    """统计同一发起阶段+目标Agent+原因的回调次数（含已解决）。"""
    count = 0
    for cb in callbacks:
        if (
            cb.get("from_phase") == from_phase
            and cb.get("to_agent") == to_agent
            and cb.get("reason") == reason
        ):
            count += 1
    return count


# ═══════════════════════════════════════════════════════════════
# 命令处理函数
# ═══════════════════════════════════════════════════════════════

def cmd_create(args) -> int:
    """创建回调。"""
    file_path = get_context_path(args.base_dir)
    context = load_context(file_path)

    if not context:
        print(f"错误：context-bus.json 不存在，请先执行 context_bus.py init。路径: {file_path}", file=sys.stderr)
        return 1

    from_phase = args.from_phase.upper()
    if from_phase not in VALID_PHASES:
        print(f"错误：无效的发起阶段: {args.from_phase}（有效值: G1-G8）", file=sys.stderr)
        return 1

    callbacks = context.setdefault("callbacks", [])
    callback_id = generate_callback_id(callbacks)
    timestamp = get_timestamp()

    # 统计同一问题的重试次数（含本次）
    retry_count = count_retries(callbacks, from_phase, args.to_agent, args.reason) + 1

    record = {
        "callback_id": callback_id,
        "from_phase": from_phase,
        "to_agent": args.to_agent,
        "reason": args.reason,
        "defect_file": args.defect_file,
        "status": STATUS_OPEN,
        "retry_count": retry_count,
        "created_at": timestamp,
        "resolved_at": None,
        "resolution": None,
        "commit": None,
    }

    callbacks.append(record)
    save_context(file_path, context)

    print(f"已创建回调: {callback_id}")
    print(f"  发起阶段:   {from_phase}")
    print(f"  目标Agent:  {args.to_agent}")
    print(f"  原因:       {args.reason}")
    print(f"  缺陷文件:   {args.defect_file or 'N/A'}")
    print(f"  时间:       {timestamp}")
    print(f"  状态:       {STATUS_OPEN}")
    print(f"  重试次数:   {retry_count}/{MAX_RETRY_COUNT}")
    if retry_count > MAX_RETRY_COUNT:
        print(f"  [!] 警告: 重试次数超限（>{MAX_RETRY_COUNT}），建议升级人工处理")
    return 0


def cmd_resolve(args) -> int:
    """解决回调。"""
    file_path = get_context_path(args.base_dir)
    context = load_context(file_path)

    if not context:
        print(f"错误：context-bus.json 不存在。路径: {file_path}", file=sys.stderr)
        return 1

    callbacks = context.get("callbacks", [])
    record = find_callback(callbacks, args.callback_id)
    if record is None:
        print(f"错误：回调ID不存在: {args.callback_id}", file=sys.stderr)
        return 1

    if record["status"] != STATUS_OPEN:
        print(f"错误：回调 {args.callback_id} 当前状态为 {record['status']}，无法重复解决", file=sys.stderr)
        return 1

    timestamp = get_timestamp()
    record["status"] = STATUS_RESOLVED
    record["resolved_at"] = timestamp
    record["resolution"] = args.resolution
    record["commit"] = args.commit

    save_context(file_path, context)
    print(f"回调 {args.callback_id} 已解决")
    print(f"  解决时间:   {timestamp}")
    print(f"  修复说明:   {args.resolution}")
    print(f"  提交SHA:    {args.commit or 'N/A'}")
    print(f"  提示: 阶段 {record['from_phase']} 可恢复执行")
    return 0


def cmd_list(args) -> int:
    """列出所有未解决的回调。"""
    file_path = get_context_path(args.base_dir)
    context = load_context(file_path)

    if not context:
        print(f"错误：context-bus.json 不存在。路径: {file_path}", file=sys.stderr)
        return 1

    callbacks = context.get("callbacks", [])
    open_callbacks = [cb for cb in callbacks if cb.get("status") == STATUS_OPEN]

    print("=" * 70)
    print("未解决的回调列表")
    print("=" * 70)

    if not open_callbacks:
        print("无未解决的回调（全部已闭环）")
        print("=" * 70)
        return 0

    print(f"共 {len(open_callbacks)} 条未解决回调:")
    print("-" * 70)
    for cb in open_callbacks:
        retry = cb.get("retry_count", 1)
        retry_warn = f" [!]超限({retry}/{MAX_RETRY_COUNT})" if retry > MAX_RETRY_COUNT else f" ({retry}/{MAX_RETRY_COUNT})"
        print(f"  ID: {cb['callback_id']}  状态: {cb['status']}{retry_warn}")
        print(f"  发起: {cb.get('from_phase', '?')} → {cb.get('to_agent', '?')}")
        print(f"  原因: {cb.get('reason', 'N/A')}")
        print(f"  时间: {cb.get('created_at', 'N/A')}")
        if cb.get("defect_file"):
            print(f"  缺陷: {cb['defect_file']}")
        print()

    print("=" * 70)
    return 0


def cmd_check(args) -> int:
    """检查超时回调（>3次或>2小时）。"""
    file_path = get_context_path(args.base_dir)
    context = load_context(file_path)

    if not context:
        print(f"错误：context-bus.json 不存在。路径: {file_path}", file=sys.stderr)
        return 1

    callbacks = context.get("callbacks", [])
    open_callbacks = [cb for cb in callbacks if cb.get("status") == STATUS_OPEN]

    print("=" * 70)
    print("超时回调检查")
    print("=" * 70)

    if not open_callbacks:
        print("无未解决回调，无需检查")
        print("=" * 70)
        return 0

    now = datetime.now(CST)
    timeout_items = []

    for cb in open_callbacks:
        issues = []
        # 检查重试次数
        retry = cb.get("retry_count", 1)
        if retry > MAX_RETRY_COUNT:
            issues.append(f"重试次数超限 ({retry}>{MAX_RETRY_COUNT})")

        # 检查时间超时
        created = parse_timestamp(cb.get("created_at", ""))
        if created:
            elapsed = now - created
            if elapsed > timedelta(hours=TIMEOUT_HOURS):
                hours = elapsed.total_seconds() / 3600
                issues.append(f"超时 ({hours:.1f}h > {TIMEOUT_HOURS}h)")

        if issues:
            timeout_items.append((cb, issues))

    if not timeout_items:
        print(f"检查通过：{len(open_callbacks)} 条未解决回调均在正常范围内")
        print(f"  阈值: 重试≤{MAX_RETRY_COUNT}次, 时间≤{TIMEOUT_HOURS}小时")
        print("=" * 70)
        return 0

    print(f"发现 {len(timeout_items)} 条超时回调:")
    print("-" * 70)
    for cb, issues in timeout_items:
        print(f"  ID: {cb.get('callback_id', '?')}  发起: {cb.get('from_phase', '?')} → {cb.get('to_agent', '?')}")
        print(f"  原因: {cb.get('reason', 'N/A')}")
        for issue in issues:
            print(f"  [X] {issue}")
        print(f"  建议: 升级人工处理")
        print()

    print("=" * 70)
    print(f"检查结果: 存在 {len(timeout_items)} 条超时回调，需人工介入")
    return 1


# ═══════════════════════════════════════════════════════════════
# 主入口
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="SDLC 回调管理器 - 管理阶段间缺陷回调与修复闭环",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
示例:
  python callback_manager.py create --from-phase G4 --to-agent developer --reason "缺陷#001"
  python callback_manager.py resolve --callback-id CB-001 --resolution "已修复" --commit abc123
  python callback_manager.py list
  python callback_manager.py check
""",
    )
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    # create
    p_create = subparsers.add_parser("create", help="创建回调")
    p_create.add_argument("--from-phase", required=True, help="发起阶段 (G1-G8)")
    p_create.add_argument("--to-agent", required=True, help="目标 Agent 名称（如 developer）")
    p_create.add_argument("--reason", required=True, help="回调原因描述")
    p_create.add_argument("--defect-file", default="", help="缺陷文件路径")
    p_create.add_argument("--base-dir", default=None, help="自定义基目录路径")

    # resolve
    p_resolve = subparsers.add_parser("resolve", help="解决回调")
    p_resolve.add_argument("--callback-id", required=True, help="回调ID (如 CB-001)")
    p_resolve.add_argument("--resolution", required=True, help="修复说明")
    p_resolve.add_argument("--commit", default="", help="修复提交的 Git commit SHA")
    p_resolve.add_argument("--base-dir", default=None, help="自定义基目录路径")

    # list
    p_list = subparsers.add_parser("list", help="列出所有未解决的回调")
    p_list.add_argument("--base-dir", default=None, help="自定义基目录路径")

    # check
    p_check = subparsers.add_parser("check", help="检查超时回调（>3次或>2小时）")
    p_check.add_argument("--base-dir", default=None, help="自定义基目录路径")

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return 1

    command_handlers = {
        "create": cmd_create,
        "resolve": cmd_resolve,
        "list": cmd_list,
        "check": cmd_check,
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
