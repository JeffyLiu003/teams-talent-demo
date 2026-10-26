#!/usr/bin/env python3
"""
G8 门禁执行器 — 统一运行该阶段所有校验脚本，汇总结果。

输入：产出目录路径
输出：G8_gate_result.json + 控制台摘要
退出码：0=全部通过, 1=存在失败, 2=存在跳过

用法：
    python run_g8_gate.py <output_dir> [--skills-dir <path>] [--depth L1|L2|L3]
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

# ═══════════════════════════════════════════════════════════════
# 门禁脚本配置
# ═══════════════════════════════════════════════════════════════

GATE_SCRIPTS = [
    {
        "name": "gate_collect",
        "skill": "pm-gate-checklist",
        "script": "gate_collect.py",
        "args": ["{output_dir}/gates-input.json"],
        "desc": "门禁状态采集",
        "threshold": "G1-G8全通过",
    },
    {
        "name": "trace_check",
        "skill": "audit-evidence",
        "script": "trace_check.py",
        "args": ["{output_dir}/evidence-input.json"],
        "desc": "全链路追溯",
        "threshold": "零断链",
    },
    {
        "name": "sod_check",
        "skill": "sod-compliance-check",
        "script": "sod_check.py",
        "args": ["{output_dir}/sod-input.json"],
        "desc": "SoD合规检查",
        "threshold": "0冲突",
    },
    {
        "name": "sanitize",
        "skill": "output-sanitization",
        "script": "sanitize.py",
        "args": ["{output_dir}/evidence-input.json"],
        "desc": "输出脱敏检查",
        "threshold": "0命中",
    },
]

SCRIPT_TIMEOUT = 30  # 秒


def find_skills_dir(script_path: Path) -> Path:
    """自动定位 skills 基目录。"""
    # 脚本位于 skills/<this_skill>/scripts/run_gN_gate.py
    # skills 基目录 = script_path.parent.parent.parent
    return script_path.parent.parent.parent


def precheck_files(output_dir: Path) -> dict:
    """预检每个脚本的输入文件是否存在。"""
    status = {}
    for item in GATE_SCRIPTS:
        missing = []
        for arg_template in item["args"]:
            arg_path = arg_template.replace("{output_dir}", str(output_dir))
            # 只检查非 flag 参数（不以 - 开头）
            if not arg_path.startswith("-") and "{" not in arg_path:
                p = Path(arg_path)
                if not p.exists():
                    missing.append(str(p))
        status[item["name"]] = missing
    return status


def run_single_script(skill_dir: Path, item: dict, output_dir: Path) -> dict:
    """运行单个校验脚本。"""
    script_path = skill_dir / item["skill"] / "scripts" / item["script"]

    if not script_path.exists():
        return {
            "name": item["name"],
            "desc": item["desc"],
            "threshold": item["threshold"],
            "status": "skipped",
            "reason": f"脚本不存在: {script_path}",
            "exit_code": -1,
            "stdout": "",
            "stderr": "",
        }

    # 替换参数模板
    args = [a.replace("{output_dir}", str(output_dir)) for a in item["args"]]

    try:
        proc = subprocess.run(
            [sys.executable, str(script_path)] + args,
            capture_output=True,
            text=True,
            timeout=SCRIPT_TIMEOUT,
        )
        passed = proc.returncode == 0
        return {
            "name": item["name"],
            "desc": item["desc"],
            "threshold": item["threshold"],
            "status": "pass" if passed else "fail",
            "exit_code": proc.returncode,
            "stdout": proc.stdout[:1000] if proc.stdout else "",
            "stderr": proc.stderr[:500] if proc.stderr else "",
        }
    except subprocess.TimeoutExpired:
        return {
            "name": item["name"],
            "desc": item["desc"],
            "threshold": item["threshold"],
            "status": "skip",
            "reason": f"超时（{SCRIPT_TIMEOUT}秒）",
            "exit_code": -1,
            "stdout": "",
            "stderr": "",
        }
    except Exception as e:
        return {
            "name": item["name"],
            "desc": item["desc"],
            "threshold": item["threshold"],
            "status": "skip",
            "reason": f"异常: {type(e).__name__}: {e}",
            "exit_code": -1,
            "stdout": "",
            "stderr": "",
        }


def run_gate(output_dir: Path, skills_dir: Path, depth: str = "L2") -> dict:
    """执行G8门禁校验。"""
    results = []
    precheck = precheck_files(output_dir)

    for item in GATE_SCRIPTS:
        # 预检：如果有文件缺失，标记为 skipped
        missing_files = precheck.get(item["name"], [])
        if missing_files:
            results.append({
                "name": item["name"],
                "desc": item["desc"],
                "threshold": item["threshold"],
                "status": "skip",
                "reason": f"输入文件缺失: {', '.join(missing_files)}",
                "exit_code": -1,
                "stdout": "",
                "stderr": "",
            })
            continue

        result = run_single_script(skills_dir, item, output_dir)
        results.append(result)

    # 汇总
    passed = sum(1 for r in results if r["status"] == "pass")
    failed = sum(1 for r in results if r["status"] == "fail")
    skipped = sum(1 for r in results if r["status"] == "skip")

    all_pass = failed == 0 and skipped == 0
    has_skip = skipped > 0 and failed == 0

    summary = {
        "gate": "G8",
        "stage": "管理",
        "agent": "A-08-PM",
        "output_dir": str(output_dir),
        "depth": depth,
        "total_scripts": len(results),
        "passed": passed,
        "failed": failed,
        "skipped": skipped,
        "verdict": "PASS" if all_pass else ("WARN" if has_skip else "FAIL"),
        "results": results,
    }

    # L3 模式：添加逐项分析
    if depth == "L3":
        analysis = []
        for r in results:
            analysis.append({
                "name": r["name"],
                "desc": r["desc"],
                "threshold": r["threshold"],
                "actual_status": r["status"],
                "exit_code": r.get("exit_code", -1),
                "recommendation": "通过" if r["status"] == "pass" else (
                    f"失败，需修复后重跑。原因: {r.get('reason', r.get('stderr', '未知'))}"
                    if r["status"] == "fail" else
                    f"跳过，人工评估。原因: {r.get('reason', '未知')}"
                ),
            })
        summary["l3_analysis"] = analysis

    return summary


def main():
    parser = argparse.ArgumentParser(description="G8 门禁执行器")
    parser.add_argument("output_dir", help="产出目录路径（如 .sdlc-demo/08-pm/）")
    parser.add_argument("--skills-dir", default=None, help="skills 基目录路径（默认自动定位）")
    parser.add_argument("--depth", choices=["L1", "L2", "L3"], default="L2", help="深度档位")
    parser.add_argument("--output", default=None, help="结果输出文件路径（默认输出到 stdout）")
    args = parser.parse_args()

    output_dir = Path(args.output_dir).resolve()
    if not output_dir.exists():
        print(f"错误：产出目录不存在: {output_dir}", file=sys.stderr)
        sys.exit(1)

    # 定位 skills 基目录
    if args.skills_dir:
        skills_dir = Path(args.skills_dir).resolve()
    else:
        skills_dir = find_skills_dir(Path(__file__).resolve())

    # 执行门禁
    summary = run_gate(output_dir, skills_dir, args.depth)

    # 输出结果
    output_json = json.dumps(summary, indent=2, ensure_ascii=False)

    if args.output:
        Path(args.output).write_text(output_json, encoding="utf-8")
        print(f"结果已写入: {args.output}")
    else:
        print(output_json)

    # 控制台摘要
    print(f"\n============================================================")
    print(f"G8 门禁结果: {summary['verdict']}")
    print(f"  通过: {summary['passed']}/{summary['total_scripts']}")
    print(f"  失败: {summary['failed']}")
    print(f"  跳过: {summary['skipped']}")
    print(f"============================================================")

    # 退出码
    if summary["verdict"] == "PASS":
        sys.exit(0)
    elif summary["verdict"] == "WARN":
        sys.exit(2)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
