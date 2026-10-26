#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
门禁旁路管理器 - 登记、查询、校验门禁旁路记录，形成完整审计链。

子命令：
    create      创建旁路记录
                --phase <G1-G8> --gate <门禁项> --reason <理由>
                --approver <审批人> --risk <低|中|高> --mitigation <缓解措施>
                [--record-file <path>]
    list        列出所有旁路记录 [--record-file <path>]
    validate    校验旁路记录完整性（理由、审批人、风险、缓解措施均必填）
                --bypass-file <path>
    check-limit 检查旁路次数是否超限（≤2 次/流程）
                [--record-file <path>] [--limit <N>]

旁路规则：
    - G1/G2/G8 不允许旁路（需求/设计/管理必须正式评审与全链路追溯）
    - G3-G7 允许有条件旁路（需审批人+理由+风险+缓解措施）
    - 单流程旁路次数上限默认 2 次，超限拒绝

记录文件默认路径：.sdlc-demo/08-pm/bypass-record.json
退出码：0=成功, 1=校验失败/参数错误, 2=超限
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

# ═══════════════════════════════════════════════════════════════
# 旁路规则配置
# ═══════════════════════════════════════════════════════════════

# 不允许旁路的阶段
BYPASS_BLOCKED = {"G1", "G2", "G8"}

# 允许有条件旁路的阶段
BYPASS_CONDITIONAL = {"G3", "G4", "G5", "G6", "G7"}

# 阶段中文名
STAGE_NAMES = {
    "G1": "需求", "G2": "设计", "G3": "开发", "G4": "测试",
    "G5": "安全", "G6": "发布", "G7": "变更", "G8": "管理",
}

# 允许的风险等级
VALID_RISK_LEVELS = {"低", "中", "高"}

# 单流程旁路次数上限
DEFAULT_BYPASS_LIMIT = 2

# 旁路记录默认文件
DEFAULT_RECORD_FILE = Path(".sdlc-demo") / "08-pm" / "bypass-record.json"

# 必填字段（用于 validate / create 校验）
REQUIRED_FIELDS = ["reason", "approver", "risk", "mitigation"]


# ═══════════════════════════════════════════════════════════════
# 工具函数
# ═══════════════════════════════════════════════════════════════

def normalize_phase(phase: str) -> str:
    """规范化阶段名（g1 -> G1, 1 -> G1）。"""
    phase = phase.strip().upper()
    if not phase.startswith("G"):
        phase = "G" + phase
    return phase


def is_bypass_allowed(phase: str) -> bool:
    """判断阶段是否允许旁路。"""
    return phase in BYPASS_CONDITIONAL


def default_record_file() -> Path:
    return DEFAULT_RECORD_FILE


def load_records(record_path: Path) -> list:
    """加载旁路记录列表。"""
    if not record_path.exists():
        return []
    try:
        # utf-8-sig 兼容带 BOM 的 Windows 文件
        data = json.loads(record_path.read_text(encoding="utf-8-sig"))
    except (json.JSONDecodeError, OSError):
        return []
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "records" in data:
        return data["records"]
    return []


def save_records(record_path: Path, records: list):
    """保存旁路记录列表。"""
    record_path.parent.mkdir(parents=True, exist_ok=True)
    output = {
        "description": "门禁旁路审计记录",
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "limit_per_flow": DEFAULT_BYPASS_LIMIT,
        "total": len(records),
        "records": records,
    }
    record_path.write_text(
        json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def generate_bypass_id(records: list) -> str:
    """生成唯一旁路ID（BP-NNN）。"""
    existing = set()
    for r in records:
        bid = r.get("bypass_id", "")
        if bid.startswith("BP-"):
            try:
                existing.add(int(bid[3:]))
            except ValueError:
                pass
    n = 1
    while n in existing:
        n += 1
    return f"BP-{n:03d}"


def validate_record(record: dict) -> list:
    """校验单条记录的完整性，返回缺失字段列表。"""
    missing = []
    for field in REQUIRED_FIELDS:
        value = record.get(field, "")
        if value is None or str(value).strip() == "":
            missing.append(field)
    # phase / gate 也应存在
    if not record.get("phase"):
        missing.append("phase")
    if not record.get("gate"):
        missing.append("gate")
    return missing


# ═══════════════════════════════════════════════════════════════
# 子命令实现
# ═══════════════════════════════════════════════════════════════

def cmd_create(args) -> int:
    """创建旁路记录。"""
    phase = normalize_phase(args.phase)

    # 阶段是否允许旁路
    if not is_bypass_allowed(phase):
        print(
            f"错误：{phase}（{STAGE_NAMES.get(phase, '')}）不允许旁路。"
            f"仅 G3-G7 允许有条件旁路。",
            file=sys.stderr,
        )
        return 1

    # 必填参数校验
    missing = []
    if not args.reason:
        missing.append("--reason")
    if not args.approver:
        missing.append("--approver")
    if not args.risk:
        missing.append("--risk")
    if not args.mitigation:
        missing.append("--mitigation")
    if missing:
        print(f"错误：缺少必填参数: {', '.join(missing)}", file=sys.stderr)
        return 1

    # 风险等级校验
    risk = args.risk.strip()
    if risk not in VALID_RISK_LEVELS:
        print(
            f"错误：风险等级无效 '{risk}'，应为 {sorted(VALID_RISK_LEVELS)}",
            file=sys.stderr,
        )
        return 1

    record_path = Path(args.record_file) if args.record_file else default_record_file()
    records = load_records(record_path)

    # 次数上限校验（含本次将超限则拒绝）
    if len(records) >= DEFAULT_BYPASS_LIMIT:
        print(
            f"错误：旁路次数已达上限 {DEFAULT_BYPASS_LIMIT} 次/流程，"
            f"当前已有 {len(records)} 条记录，禁止再旁路，请升级处理。",
            file=sys.stderr,
        )
        return 2

    bypass_id = generate_bypass_id(records)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    record = {
        "bypass_id": bypass_id,
        "phase": phase,
        "phase_name": STAGE_NAMES.get(phase, ""),
        "gate": args.gate,
        "reason": args.reason,
        "approver": args.approver,
        "risk": risk,
        "mitigation": args.mitigation,
        "status": "bypassed",
        "bypass_time": now,
    }

    records.append(record)
    save_records(record_path, records)

    print("门禁旁路已创建:")
    print(f"  旁路ID:   {bypass_id}")
    print(f"  阶段:     {phase}（{STAGE_NAMES.get(phase, '')}）")
    print(f"  门禁项:   {args.gate}")
    print(f"  旁路理由: {args.reason}")
    print(f"  审批人:   {args.approver}")
    print(f"  风险等级: {risk}")
    print(f"  缓解措施: {args.mitigation}")
    print(f"  旁路时间: {now}")
    print(f"  记录文件: {record_path}")
    print(f"  当前旁路次数: {len(records)}/{DEFAULT_BYPASS_LIMIT}")
    return 0


def cmd_list(args) -> int:
    """列出所有旁路记录。"""
    record_path = Path(args.record_file) if args.record_file else default_record_file()
    records = load_records(record_path)

    if not records:
        print(f"暂无旁路记录（已查询: {record_path}）")
        return 0

    print(f"旁路记录（共 {len(records)} 条，来源: {record_path}）:")
    for r in records:
        print("  ---")
        print(f"  旁路ID:   {r.get('bypass_id', 'N/A')}")
        print(f"  阶段:     {r.get('phase', 'N/A')}（{r.get('phase_name', '')}）")
        print(f"  门禁项:   {r.get('gate', 'N/A')}")
        print(f"  旁路理由: {r.get('reason', 'N/A')}")
        print(f"  审批人:   {r.get('approver', 'N/A')}")
        print(f"  风险等级: {r.get('risk', 'N/A')}")
        print(f"  缓解措施: {r.get('mitigation', 'N/A')}")
        print(f"  旁路时间: {r.get('bypass_time', 'N/A')}")
    return 0


def cmd_validate(args) -> int:
    """校验旁路记录文件完整性。"""
    bypass_file = Path(args.bypass_file)
    if not bypass_file.exists():
        print(f"错误：旁路记录文件不存在: {bypass_file}", file=sys.stderr)
        return 1

    records = load_records(bypass_file)
    if not records:
        print(f"警告：旁路记录文件无有效记录: {bypass_file}", file=sys.stderr)
        return 1

    all_ok = True
    invalid_count = 0
    for r in records:
        bid = r.get("bypass_id", "N/A")
        missing = validate_record(r)
        if missing:
            all_ok = False
            invalid_count += 1
            print(f"[FAIL] {bid} 缺失字段: {', '.join(missing)}")
        else:
            print(f"[OK]   {bid} 完整")

    total = len(records)
    print(f"\n校验结果: {total - invalid_count}/{total} 条完整")
    if all_ok:
        print("结论: PASS - 所有旁路记录均完整")
        return 0
    else:
        print("结论: FAIL - 存在不完整记录（理由/审批人/风险/缓解措施必填）")
        return 1


def cmd_check_limit(args) -> int:
    """检查旁路次数是否超限。"""
    limit = args.limit if args.limit is not None else DEFAULT_BYPASS_LIMIT
    record_path = Path(args.record_file) if args.record_file else default_record_file()
    records = load_records(record_path)

    current = len(records)
    print(f"当前旁路次数: {current}")
    print(f"次数上限:     {limit}")
    if current <= limit:
        remaining = limit - current
        print(f"结论: OK - 未超限，剩余额度 {remaining} 次")
        return 0
    else:
        print(f"结论: OVER_LIMIT - 已超限 {current - limit} 次，禁止再旁路")
        return 2


# ═══════════════════════════════════════════════════════════════
# 主入口
# ═══════════════════════════════════════════════════════════════

def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

    parser = argparse.ArgumentParser(
        description="门禁旁路管理器 - 创建/查询/校验/限额 门禁旁路记录"
    )
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    # create
    p_create = subparsers.add_parser("create", help="创建旁路记录")
    p_create.add_argument("--phase", required=True, help="阶段（G1-G8）")
    p_create.add_argument("--gate", required=True, help="门禁项名称（如 用例执行率）")
    p_create.add_argument("--reason", required=True, help="旁路理由（必填）")
    p_create.add_argument("--approver", required=True, help="审批人（必填）")
    p_create.add_argument("--risk", required=True, help="风险等级：低/中/高（必填）")
    p_create.add_argument("--mitigation", required=True, help="缓解措施（必填）")
    p_create.add_argument("--record-file", default=None, help="旁路记录文件路径")

    # list
    p_list = subparsers.add_parser("list", help="列出所有旁路记录")
    p_list.add_argument("--record-file", default=None, help="旁路记录文件路径")

    # validate
    p_val = subparsers.add_parser("validate", help="校验旁路记录完整性")
    p_val.add_argument("--bypass-file", required=True, help="旁路记录文件路径")

    # check-limit
    p_lim = subparsers.add_parser("check-limit", help="检查旁路次数是否超限")
    p_lim.add_argument("--record-file", default=None, help="旁路记录文件路径")
    p_lim.add_argument("--limit", type=int, default=None, help="次数上限（默认 2）")

    args = parser.parse_args()

    if args.command == "create":
        sys.exit(cmd_create(args))
    elif args.command == "list":
        sys.exit(cmd_list(args))
    elif args.command == "validate":
        sys.exit(cmd_validate(args))
    elif args.command == "check-limit":
        sys.exit(cmd_check_limit(args))
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
