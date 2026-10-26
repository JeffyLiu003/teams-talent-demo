#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SDLC 度量数据采集器

从 context-bus.json 读取各阶段时间戳和状态，从各门禁结果 JSON 读取通过/失败信息，
计算全部度量指标（Lead Time / 门禁拦截率 / DORA / Agent 效能），输出 metrics-report.json。

兼容 context-bus.json 的两种结构：
  1. 文档示例结构：{ "phases": { "G1": { "started_at", "completed_at", "gate_result" } } }
  2. 实际实现结构：{ "requirement": { "completed", "data", "updated_at" }, "metadata": {...} }

用法:
    python collect_metrics.py --context .sdlc-demo/context-bus.json --output .sdlc-demo/08-pm/metrics-report.json

退出码: 0=成功, 1=数据不完整
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

# ═══════════════════════════════════════════════════════════════
# 阶段配置：G编号 -> (阶段中文名, 阶段目录名, 上下文键名)
# ═══════════════════════════════════════════════════════════════

STAGES = [
    ("G1", "需求", "01-requirement", "requirement"),
    ("G2", "设计", "02-design", "design"),
    ("G3", "开发", "03-development", "development"),
    ("G4", "测试", "04-test", "test"),
    ("G5", "安全", "05-security", "security"),
    ("G6", "发布", "06-release", "release"),
    ("G7", "变更", "07-change", "change"),
    ("G8", "管理", "08-pm", "management"),
]

# Lead Time 目标：≤ 15 天 = 360 小时
LEAD_TIME_TARGET_HOURS = 360

# DORA 目标值
DORA_TARGETS = {
    "deploy_frequency": 2,        # ≥ 2次/周
    "change_failure_rate": 10,    # ≤ 10%
    "mttr_hours": 2,              # ≤ 2小时
    "defect_escape_rate": 5,      # ≤ 5%
}

# Agent 效能目标值
AGENT_TARGETS = {
    "script_pass_rate": 95,       # ≥ 95%
    "human_intervention": 3,      # ≤ 3次/阶段
    "rework_rate": 10,            # ≤ 10%
    "agent_autonomy": 80,         # ≥ 80%
}

# 数值合理性上限（用于异常检测）
SANITY_LIMITS = {
    "stage_duration_hours": 720,   # 单阶段不超过 30 天
    "lead_time_hours": 1440,       # 全流程不超过 60 天
    "mttr_hours": 168,             # MTTR 不超过 7 天
}

ISO_FMT = "%Y-%m-%dT%H:%M:%S"


def log(msg):
    """输出日志到 stderr。"""
    print(f"[collect_metrics] {msg}", file=sys.stderr)


# ═══════════════════════════════════════════════════════════════
# 基础工具函数
# ═══════════════════════════════════════════════════════════════

def parse_iso(ts_str):
    """解析 ISO 时间字符串，返回 datetime 对象；失败返回 None。"""
    if not ts_str:
        return None
    s = str(ts_str).strip()
    if not s or s.lower() in ("null", "none"):
        return None
    # 优先用 fromisoformat（兼容带时区后缀 Z 转 +00:00）
    try:
        # 兼容末尾的 Z
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s)
    except (ValueError, TypeError):
        pass
    # 退化到多种格式
    for fmt in (ISO_FMT, "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S%z",
                "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s[:19] if len(s) >= 19 else s, fmt)
        except (ValueError, TypeError):
            continue
    return None


def load_json_safe(filepath):
    """安全加载 JSON 文件，返回 dict/list 或 None。"""
    try:
        # 用 utf-8-sig 兼容带 BOM 的文件
        with open(filepath, "r", encoding="utf-8-sig") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        log(f"加载 JSON 失败: {filepath} — {e}")
        return None


def hours_between(start, end):
    """计算两个 datetime 之间的时长（小时），保留 1 位小数；异常返回 None。"""
    if not start or not end:
        return None
    delta = (end - start).total_seconds() / 3600.0
    if delta < 0:
        return None
    return round(delta, 1)


def minutes_between(start, end):
    """计算两个 datetime 之间的时长（分钟），保留 1 位小数；异常返回 None。"""
    if not start or not end:
        return None
    delta = (end - start).total_seconds() / 60.0
    if delta < 0:
        return None
    return round(delta, 1)


# ═══════════════════════════════════════════════════════════════
# context-bus.json 解析（兼容两种结构）
# ═══════════════════════════════════════════════════════════════

def extract_stage_from_context(context_bus, gate_id, ctx_key):
    """
    从 context-bus.json 中提取单个阶段的信息。

    兼容结构：
      1. context_bus["phases"]["G1"] = { started_at, completed_at, gate_result, ... }
      2. context_bus["requirement"] = { completed, updated_at, data: {...}, ... }
      3. context_bus["stages"]["G1"] = { started_at, completed_at, ... }

    返回字典: { started_at, completed_at, status, gate_result, updated_at, data }
    """
    result = {
        "started_at": None,
        "completed_at": None,
        "status": "unknown",
        "gate_result": "unknown",
        "updated_at": None,
        "data": {},
    }

    if not isinstance(context_bus, dict):
        return result

    # 结构1：phases.G1
    phase = None
    if "phases" in context_bus and isinstance(context_bus["phases"], dict):
        phase = context_bus["phases"].get(gate_id) or context_bus["phases"].get(gate_id.lower())
    # 结构3：stages.G1
    if phase is None and "stages" in context_bus and isinstance(context_bus["stages"], dict):
        phase = context_bus["stages"].get(gate_id) or context_bus["stages"].get(gate_id.lower())
    # 结构2：requirement / design / ...
    if phase is None:
        phase = context_bus.get(ctx_key)

    if not isinstance(phase, dict):
        return result

    # started_at / completed_at
    for s_key in ("started_at", "start_time", "begin_at", "created_at"):
        val = phase.get(s_key)
        if val:
            result["started_at"] = str(val)
            break
    for c_key in ("completed_at", "end_time", "ended_at", "finished_at", "updated_at"):
        val = phase.get(c_key)
        if val:
            result["completed_at"] = str(val)
            break

    # status
    status = str(phase.get("status", "")).lower()
    if status in ("completed", "pass", "passed", "通过", "done"):
        result["status"] = "pass"
    elif status in ("failed", "fail", "失败", "rejected", "退回"):
        result["status"] = "fail"
    elif phase.get("completed") is True:
        result["status"] = "pass"
    elif phase.get("completed") is False:
        result["status"] = "pending"

    # gate_result
    gate = phase.get("gate_result") or phase.get("gate")
    if gate:
        gate_lower = str(gate).lower()
        if gate_lower in ("pass", "passed", "通过", "ok"):
            result["gate_result"] = "pass"
        elif gate_lower in ("fail", "failed", "失败", "reject", "退回"):
            result["gate_result"] = "fail"
        elif gate_lower in ("warn", "warning", "skip", "跳过"):
            result["gate_result"] = "warn"

    # updated_at 兜底
    if not result["completed_at"] and phase.get("updated_at"):
        result["updated_at"] = str(phase.get("updated_at"))

    # data 透传
    if isinstance(phase.get("data"), dict):
        result["data"] = phase["data"]

    return result


def extract_project_info(context_bus):
    """从 context-bus.json 提取项目信息（需求ID等）。"""
    info = {"requirement_id": "REQ-UNKNOWN", "project_name": None, "requirement_title": None}

    if not isinstance(context_bus, dict):
        return info

    # 结构1：project 字段
    project = context_bus.get("project")
    if isinstance(project, dict):
        info["requirement_id"] = project.get("requirement_id", info["requirement_id"])
        info["project_name"] = project.get("name")
        info["requirement_title"] = project.get("requirement_title")

    # 结构2：metadata 字段
    metadata = context_bus.get("metadata")
    if isinstance(metadata, dict):
        if info["requirement_id"] == "REQ-UNKNOWN":
            info["requirement_id"] = metadata.get("requirement_id", info["requirement_id"])
        if info["project_name"] is None:
            info["project_name"] = metadata.get("project_name")

    # 顶层字段兜底
    if info["requirement_id"] == "REQ-UNKNOWN":
        info["requirement_id"] = context_bus.get("requirement_id", info["requirement_id"])

    return info


def extract_callbacks(context_bus):
    """从 context-bus.json 提取回调记录（用于人工干预统计）。"""
    if not isinstance(context_bus, dict):
        return []
    callbacks = context_bus.get("callbacks")
    if isinstance(callbacks, list):
        return callbacks
    # 也可能放在 stages 里
    for key in ("callbacks", "callback_records"):
        val = context_bus.get(key)
        if isinstance(val, list):
            return val
    return []


# ═══════════════════════════════════════════════════════════════
# 门禁结果 JSON 解析
# ═══════════════════════════════════════════════════════════════

def find_gate_result_files(base_dir, stage_dir_name):
    """在阶段目录下查找门禁结果 JSON 文件。"""
    stage_dir = Path(base_dir) / stage_dir_name
    if not stage_dir.exists():
        return []
    # 匹配 G*_gate_result.json, *_gate_result.json, gate_result*.json 等
    candidates = []
    for jf in sorted(stage_dir.rglob("*.json")):
        name_lower = jf.name.lower()
        if "gate_result" in name_lower or "gate-result" in name_lower:
            candidates.append(jf)
    return candidates


def extract_gate_stats(gate_data):
    """
    从门禁结果 JSON 中提取脚本统计和门禁状态。

    返回: {
        "scripts": {"pass": N, "fail": N, "skip": N},
        "gate": "pass"|"fail"|"warn"|"unknown",
        "verdict": "...",
        "fail_reasons": [str],
        "executed_at": "...",
        "approved_at": "..."
    }
    """
    stats = {
        "scripts": {"pass": 0, "fail": 0, "skip": 0},
        "gate": "unknown",
        "verdict": None,
        "fail_reasons": [],
        "executed_at": None,
        "approved_at": None,
    }

    if not isinstance(gate_data, dict):
        return stats

    # 顶层 verdict / gate 字段
    verdict = str(gate_data.get("verdict", gate_data.get("gate", ""))).upper()
    stats["verdict"] = verdict if verdict else None
    if verdict in ("PASS", "通过"):
        stats["gate"] = "pass"
    elif verdict in ("FAIL", "FAILED", "失败"):
        stats["gate"] = "fail"
    elif verdict in ("WARN", "WARNING", "退回"):
        stats["gate"] = "warn"

    # 脚本结果列表
    for list_key in ("results", "scripts", "checks", "items"):
        items = gate_data.get(list_key)
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            status = str(item.get("status", "")).lower()
            if status in ("pass", "passed", "通过"):
                stats["scripts"]["pass"] += 1
            elif status in ("fail", "failed", "失败"):
                stats["scripts"]["fail"] += 1
                # 收集失败原因
                reason = item.get("reason") or item.get("desc") or item.get("name")
                if reason:
                    stats["fail_reasons"].append(str(reason))
            elif status in ("skip", "skipped", "跳过"):
                stats["scripts"]["skip"] += 1

    # 汇总字段（passed/failed/skipped 为整数）
    if isinstance(gate_data.get("passed"), int):
        stats["scripts"]["pass"] = max(stats["scripts"]["pass"], gate_data["passed"])
    if isinstance(gate_data.get("failed"), int):
        stats["scripts"]["fail"] = max(stats["scripts"]["fail"], gate_data["failed"])
    if isinstance(gate_data.get("skipped"), int):
        stats["scripts"]["skip"] = max(stats["scripts"]["skip"], gate_data["skipped"])

    # 如果列表为空但 verdict 存在，用 verdict 作为一次执行
    if (stats["scripts"]["pass"] == 0 and stats["scripts"]["fail"] == 0
            and stats["scripts"]["skip"] == 0 and stats["gate"] != "unknown"):
        if stats["gate"] == "pass":
            stats["scripts"]["pass"] = 1
        elif stats["gate"] == "fail":
            stats["scripts"]["fail"] = 1
        elif stats["gate"] == "warn":
            stats["scripts"]["skip"] = 1

    # 时间戳
    for e_key in ("executed_at", "gate_executed_at", "created_at", "collected_at"):
        val = gate_data.get(e_key)
        if val:
            stats["executed_at"] = str(val)
            break
    for a_key in ("approved_at", "gate_approved_at", "completed_at", "finished_at"):
        val = gate_data.get(a_key)
        if val:
            stats["approved_at"] = str(val)
            break

    return stats


# ═══════════════════════════════════════════════════════════════
# 单阶段度量采集
# ═══════════════════════════════════════════════════════════════

def collect_stage(context_bus, base_dir, gate_id, stage_name, stage_dir_name, ctx_key):
    """采集单个阶段的完整度量数据。"""
    # 1. 从 context-bus 提取阶段基础信息
    ctx_stage = extract_stage_from_context(context_bus, gate_id, ctx_key)

    started_at_str = ctx_stage["started_at"]
    completed_at_str = ctx_stage["completed_at"] or ctx_stage["updated_at"]

    # 2. 从门禁结果 JSON 提取脚本统计和门禁状态
    gate_files = find_gate_result_files(base_dir, stage_dir_name)
    scripts = {"pass": 0, "fail": 0, "skip": 0}
    gate_status = ctx_stage["gate_result"]
    fail_reasons = []
    executed_at_str = None
    approved_at_str = None
    gate_result_files = []

    for gf in gate_files:
        gate_result_files.append(str(gf))
        data = load_json_safe(gf)
        if data is None:
            continue
        gstats = extract_gate_stats(data)
        scripts["pass"] += gstats["scripts"]["pass"]
        scripts["fail"] += gstats["scripts"]["fail"]
        scripts["skip"] += gstats["scripts"]["skip"]
        fail_reasons.extend(gstats["fail_reasons"])
        # 门禁状态：优先取 fail，其次 warn，再次 pass
        if gstats["gate"] == "fail":
            gate_status = "fail"
        elif gstats["gate"] == "warn" and gate_status != "fail":
            gate_status = "warn"
        elif gstats["gate"] == "pass" and gate_status not in ("fail", "warn"):
            gate_status = "pass"
        # 时间戳
        if gstats["executed_at"] and not executed_at_str:
            executed_at_str = gstats["executed_at"]
        if gstats["approved_at"] and not approved_at_str:
            approved_at_str = gstats["approved_at"]

    # 3. 计算阶段耗时
    started_dt = parse_iso(started_at_str)
    completed_dt = parse_iso(completed_at_str)
    duration_min = minutes_between(started_dt, completed_dt)

    # 4. 门禁等待时间（executed_at -> approved_at）
    gate_exec_dt = parse_iso(executed_at_str)
    gate_appr_dt = parse_iso(approved_at_str)
    gate_wait_hours = hours_between(gate_exec_dt, gate_appr_dt)

    # 5. 人工干预次数：从 context data 中提取，或用回调数估算
    human_interventions = 0
    stage_data = ctx_stage.get("data", {})
    if isinstance(stage_data, dict):
        for h_key in ("human_interventions", "manual_interventions", "intervention_count"):
            val = stage_data.get(h_key)
            if isinstance(val, int):
                human_interventions = val
                break

    # 6. 阶段整体状态
    if gate_status == "fail":
        status = "fail"
    elif gate_status == "pass":
        status = "pass"
    elif scripts["fail"] > 0:
        status = "fail"
    elif scripts["pass"] > 0 or ctx_stage["status"] == "pass":
        status = "pass"
    elif ctx_stage["status"] == "pending":
        status = "pending"
    else:
        status = "unknown"

    return {
        "name": stage_name,
        "started_at": started_at_str,
        "completed_at": completed_at_str,
        "duration_min": duration_min,
        "status": status,
        "gate_result": gate_status,
        "gate_executed_at": executed_at_str,
        "approved_at": approved_at_str,
        "gate_wait_hours": gate_wait_hours,
        "scripts": scripts,
        "human_interventions": human_interventions,
        "fail_reasons": fail_reasons,
        "gate_result_files": gate_result_files,
    }


# ═══════════════════════════════════════════════════════════════
# 指标计算
# ═══════════════════════════════════════════════════════════════

def calc_lead_time(stages):
    """计算 Lead Time 指标。"""
    # 找到最早的 started_at 和最晚的 completed_at
    earliest_start = None
    latest_complete = None
    stage_durations = {}

    for gate_id in ("G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"):
        s = stages.get(gate_id, {})
        s_dt = parse_iso(s.get("started_at"))
        c_dt = parse_iso(s.get("completed_at"))
        if s_dt and (earliest_start is None or s_dt < earliest_start):
            earliest_start = s_dt
        if c_dt and (latest_complete is None or c_dt > latest_complete):
            latest_complete = c_dt
        if s.get("duration_min") is not None:
            stage_durations[gate_id] = s["duration_min"]

    total_hours = hours_between(earliest_start, latest_complete)
    met = None
    if total_hours is not None:
        met = total_hours <= LEAD_TIME_TARGET_HOURS
        # 合理性校验
        if total_hours > SANITY_LIMITS["lead_time_hours"]:
            log(f"警告: Lead Time {total_hours}h 超出合理上限 {SANITY_LIMITS['lead_time_hours']}h")

    # 各阶段耗时是否都 ≤ 8 小时（Agent 目标）
    agent_stage_target = 8  # 小时
    stage_met = {}
    for gate_id, dur_min in stage_durations.items():
        dur_h = dur_min / 60.0
        stage_met[gate_id] = dur_h <= agent_stage_target

    # 门禁等待时间是否都 ≤ 4 小时
    gate_wait_target = 4
    gate_wait_met = {}
    for gate_id in ("G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"):
        wait = stages.get(gate_id, {}).get("gate_wait_hours")
        if wait is not None:
            gate_wait_met[gate_id] = wait <= gate_wait_target

    return {
        "total_hours": total_hours,
        "started_at": earliest_start.strftime(ISO_FMT) if earliest_start else None,
        "completed_at": latest_complete.strftime(ISO_FMT) if latest_complete else None,
        "target_hours": LEAD_TIME_TARGET_HOURS,
        "met": met,
        "stage_durations_min": stage_durations,
        "stage_target_hours": agent_stage_target,
        "stage_met": stage_met,
        "gate_wait_target_hours": gate_wait_target,
        "gate_wait_met": gate_wait_met,
    }


def calc_gate_interception(stages):
    """计算门禁拦截率指标。"""
    # 单次交付场景：退回率 = 该门禁是否退回（0% 或 100%）
    def return_rate(gate_id):
        s = stages.get(gate_id, {})
        gate = s.get("gate_result", "unknown")
        if gate == "fail":
            return 100.0
        elif gate in ("pass", "warn"):
            return 0.0
        return None

    g1_rate = return_rate("G1")
    g3_rate = return_rate("G3")
    g5_rate = return_rate("G5")

    # 退回原因 TOP3
    reason_counter = {}
    for gate_id in ("G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"):
        s = stages.get(gate_id, {})
        if s.get("gate_result") == "fail":
            reasons = s.get("fail_reasons", [])
            if reasons:
                for r in reasons:
                    reason_counter[r] = reason_counter.get(r, 0) + 1
            else:
                key = f"{gate_id} 门禁未通过"
                reason_counter[key] = reason_counter.get(key, 0) + 1
        if s.get("scripts", {}).get("fail", 0) > 0:
            key = f"{gate_id} 脚本执行失败"
            reason_counter[key] = reason_counter.get(key, 0) + s["scripts"]["fail"]

    top3 = sorted(reason_counter.items(), key=lambda x: -x[1])[:3]
    top3_list = [{"reason": r, "count": c} for r, c in top3]

    def met_helper(rate, max_target):
        if rate is None:
            return None
        return rate <= max_target

    return {
        "g1_return_rate": {
            "value": g1_rate, "unit": "%", "target": "越早发现越好",
            "met": None,  # G1 不设硬性阈值
        },
        "g3_return_rate": {
            "value": g3_rate, "unit": "%", "target": "≤15%",
            "met": met_helper(g3_rate, 15),
        },
        "g5_return_rate": {
            "value": g5_rate, "unit": "%", "target": "≤10%",
            "met": met_helper(g5_rate, 10),
        },
        "return_reasons_top3": top3_list,
    }


def calc_dora(stages, context_bus, base_dir):
    """计算 DORA 四项指标。"""
    # ── 部署频率：从 G6 发布阶段提取部署记录 ──
    deploy_records = _extract_deploy_records(base_dir)
    if deploy_records:
        times = [parse_iso(r.get("deploy_time")) for r in deploy_records if r.get("deploy_time")]
        times = [t for t in times if t]
        total = len(deploy_records)
        if times:
            span_days = max((max(times) - min(times)).total_seconds() / 86400.0, 1.0)
            freq = round(total / (span_days / 7.0), 1)
        else:
            freq = float(total)
        df_met = freq >= DORA_TARGETS["deploy_frequency"]
        df = {"value": freq, "unit": "次/周", "target": "≥2次/周", "met": df_met,
              "data_source": f"G6发布记录({total}条)"}
    else:
        df = {"value": None, "unit": "次/周", "target": "≥2次/周", "met": None,
              "data_source": "未找到发布记录"}

    # ── 变更失败率：回滚记录 / 总发布数 ──
    rollback_count = _count_rollbacks(base_dir, context_bus)
    total_deploys = len(deploy_records) if deploy_records else 0
    if total_deploys > 0:
        cfr = round(rollback_count / total_deploys * 100, 1)
        cfr_met = cfr <= DORA_TARGETS["change_failure_rate"]
        cfr_obj = {"value": cfr, "unit": "%", "target": "≤10%", "met": cfr_met,
                   "data_source": f"回滚{rollback_count}/{total_deploys}次"}
    else:
        cfr_obj = {"value": None, "unit": "%", "target": "≤10%", "met": None,
                   "data_source": "无发布记录"}

    # ── MTTR：从 PIR/故障记录提取 ──
    mttr_val, mttr_source = _calc_mttr(base_dir, context_bus)
    if mttr_val is not None:
        mttr_met = mttr_val <= DORA_TARGETS["mttr_hours"]
        if mttr_val > SANITY_LIMITS["mttr_hours"]:
            log(f"警告: MTTR {mttr_val}h 超出合理上限 {SANITY_LIMITS['mttr_hours']}h")
    else:
        mttr_met = None
    mttr_obj = {"value": mttr_val, "unit": "小时", "target": "≤2小时", "met": mttr_met,
                "data_source": mttr_source}

    # ── 缺陷逃逸率：生产缺陷 / 总缺陷 ──
    escape_val, escape_source = _calc_defect_escape_rate(base_dir, context_bus)
    if escape_val is not None:
        escape_met = escape_val <= DORA_TARGETS["defect_escape_rate"]
    else:
        escape_met = None
    escape_obj = {"value": escape_val, "unit": "%", "target": "≤5%", "met": escape_met,
                  "data_source": escape_source}

    return {
        "deploy_frequency": df,
        "change_failure_rate": cfr_obj,
        "mttr_hours": mttr_obj,
        "defect_escape_rate": escape_obj,
    }


def _extract_deploy_records(base_dir):
    """从 G6 发布目录提取部署记录。"""
    release_dir = Path(base_dir) / "06-release"
    records = []
    if not release_dir.exists():
        return records
    for jf in sorted(release_dir.rglob("*.json")):
        data = load_json_safe(jf)
        if data is None:
            continue
        items = None
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            for k in ("releases", "deploys", "deployments", "records", "items"):
                if isinstance(data.get(k), list):
                    items = data[k]
                    break
            if items is None and any(k in data for k in ("release_id", "deploy_id", "version", "deployed_at")):
                items = [data]
        if not items:
            continue
        for rec in items:
            if not isinstance(rec, dict):
                continue
            deploy_time = None
            for t_key in ("deployed_at", "release_at", "released_at", "created_at", "timestamp"):
                if rec.get(t_key):
                    deploy_time = str(rec[t_key])
                    break
            records.append({
                "source": jf.name,
                "deploy_time": deploy_time,
                "version": rec.get("version", rec.get("release_id", "unknown")),
            })
    return records


def _count_rollbacks(base_dir, context_bus):
    """统计回滚/失败变更次数。"""
    count = 0
    # 从 G6/G7/G8 目录的 JSON 中查找回滚标记
    for dir_name in ("06-release", "07-change", "08-pm"):
        check_dir = Path(base_dir) / dir_name
        if not check_dir.exists():
            continue
        for jf in sorted(check_dir.rglob("*.json")):
            data = load_json_safe(jf)
            if not isinstance(data, dict):
                continue
            for rb_key in ("rollback", "rolled_back", "is_rollback"):
                val = data.get(rb_key)
                if val is True or str(val).lower() in ("true", "yes", "1"):
                    count += 1
                    break
            for rb_list_key in ("rollbacks", "rollback_records", "failed_deploys"):
                rb_list = data.get(rb_list_key)
                if isinstance(rb_list, list):
                    count += len(rb_list)
    # 从 context_bus 的 callbacks 中查找回滚
    callbacks = extract_callbacks(context_bus)
    for cb in callbacks:
        if isinstance(cb, dict) and (cb.get("caused_rollback") or cb.get("resulted_in_rollback")):
            count += 1
    return count


def _calc_mttr(base_dir, context_bus):
    """计算 MTTR（平均恢复时间），返回 (hours, data_source)。"""
    incidents = []
    # 从各阶段目录 JSON 提取故障记录
    for gate_id, _, dir_name, _ in STAGES:
        stage_dir = Path(base_dir) / dir_name
        if not stage_dir.exists():
            continue
        for jf in sorted(stage_dir.rglob("*.json")):
            data = load_json_safe(jf)
            if not isinstance(data, dict):
                continue
            inc_list = None
            for k in ("incidents", "pir_records", "pir", "faults", "failures"):
                val = data.get(k)
                if isinstance(val, list):
                    inc_list = val
                    break
                elif isinstance(val, dict):
                    inc_list = [val]
                    break
            if not inc_list:
                continue
            for inc in inc_list:
                if not isinstance(inc, dict):
                    continue
                # 直接给出 MTTR
                mttr_val = inc.get("mttr_hours") or inc.get("recovery_time_hours")
                if isinstance(mttr_val, (int, float)):
                    incidents.append(float(mttr_val))
                    continue
                # 通过时间戳计算
                detected = parse_iso(str(inc.get("detected_at") or inc.get("found_at") or inc.get("incident_at") or ""))
                recovered = parse_iso(str(inc.get("recovered_at") or inc.get("resolved_at") or inc.get("closed_at") or ""))
                if detected and recovered:
                    incidents.append(round((recovered - detected).total_seconds() / 3600.0, 1))

    # 从 context_bus callbacks 提取
    callbacks = extract_callbacks(context_bus)
    for cb in callbacks:
        if not isinstance(cb, dict):
            continue
        ch = cb.get("closure_hours") or cb.get("resolution_hours")
        if isinstance(ch, (int, float)):
            incidents.append(float(ch))

    if not incidents:
        return None, "未找到 PIR/故障记录"
    avg = round(sum(incidents) / len(incidents), 1)
    return avg, f"故障记录{len(incidents)}条"


def _calc_defect_escape_rate(base_dir, context_bus):
    """计算缺陷逃逸率，返回 (rate, data_source)。"""
    prod_defects = 0
    total_defects = 0
    # 从 G4 测试目录和 G8 管理目录统计缺陷
    for dir_name in ("04-test", "08-pm"):
        check_dir = Path(base_dir) / dir_name
        if not check_dir.exists():
            continue
        for jf in sorted(check_dir.rglob("*.json")):
            data = load_json_safe(jf)
            if not isinstance(data, dict):
                continue
            for dk in ("defects", "bugs", "issues"):
                dlist = data.get(dk)
                if not isinstance(dlist, list):
                    continue
                for d in dlist:
                    if not isinstance(d, dict):
                        continue
                    total_defects += 1
                    # 生产发现的缺陷：found_in=production 或 severity=production
                    found_in = str(d.get("found_in", d.get("found_at_stage", ""))).lower()
                    if "prod" in found_in or "escape" in found_in:
                        prod_defects += 1
            # 汇总字段
            if isinstance(data.get("total_defects"), int):
                total_defects = max(total_defects, data["total_defects"])
            if isinstance(data.get("production_defects"), int):
                prod_defects = max(prod_defects, data["production_defects"])

    if total_defects == 0:
        return None, "未找到缺陷记录"
    rate = round(prod_defects / total_defects * 100, 1)
    return rate, f"生产缺陷{prod_defects}/总缺陷{total_defects}"


def calc_agent_efficiency(stages, context_bus):
    """计算 Agent 效能指标。"""
    # ── 脚本通过率 ──
    total_pass = sum(s.get("scripts", {}).get("pass", 0) for s in stages.values())
    total_fail = sum(s.get("scripts", {}).get("fail", 0) for s in stages.values())
    total_skip = sum(s.get("scripts", {}).get("skip", 0) for s in stages.values())
    total_scripts = total_pass + total_fail + total_skip
    if total_scripts > 0:
        pass_rate = round(total_pass / total_scripts * 100, 1)
        pass_met = pass_rate >= AGENT_TARGETS["script_pass_rate"]
    else:
        pass_rate = None
        pass_met = None

    # ── 人工干预次数（每阶段平均） ──
    total_interventions = sum(s.get("human_interventions", 0) for s in stages.values())
    # 回调也计入人工干预
    callbacks = extract_callbacks(context_bus)
    total_interventions += len(callbacks)
    num_stages = len(stages)
    avg_intervention = round(total_interventions / num_stages, 1) if num_stages > 0 else None
    if avg_intervention is not None:
        intervention_met = avg_intervention <= AGENT_TARGETS["human_intervention"]
    else:
        intervention_met = None

    # ── 返工率：门禁退回阶段数 / 总阶段数 ──
    gate_returns = sum(1 for s in stages.values() if s.get("gate_result") == "fail")
    rework_rate = round(gate_returns / num_stages * 100, 1) if num_stages > 0 else None
    if rework_rate is not None:
        rework_met = rework_rate <= AGENT_TARGETS["rework_rate"]
    else:
        rework_met = None

    # ── Agent 自主率：无需人工干预的阶段比例 ──
    autonomous_stages = sum(
        1 for s in stages.values() if s.get("human_interventions", 0) == 0
    )
    autonomy_rate = round(autonomous_stages / num_stages * 100, 1) if num_stages > 0 else None
    if autonomy_rate is not None:
        autonomy_met = autonomy_rate >= AGENT_TARGETS["agent_autonomy"]
    else:
        autonomy_met = None

    return {
        "script_pass_rate": {
            "value": pass_rate, "unit": "%", "target": "≥95%", "met": pass_met,
            "total_scripts": total_scripts,
        },
        "human_intervention_count": {
            "value": avg_intervention, "unit": "次/阶段", "target": "≤3次", "met": intervention_met,
            "total_interventions": total_interventions,
        },
        "rework_rate": {
            "value": rework_rate, "unit": "%", "target": "≤10%", "met": rework_met,
            "gate_returns": gate_returns,
        },
        "agent_autonomy_rate": {
            "value": autonomy_rate, "unit": "%", "target": "≥80%", "met": autonomy_met,
            "autonomous_stages": autonomous_stages,
        },
    }


# ═══════════════════════════════════════════════════════════════
# 主采集逻辑
# ═══════════════════════════════════════════════════════════════

def collect_metrics(context_path):
    """采集全量度量数据，返回 metrics dict。"""
    context_path = Path(context_path).resolve()
    if not context_path.exists():
        log(f"context-bus.json 不存在: {context_path}")
        return None

    context_bus = load_json_safe(context_path)
    if context_bus is None:
        return None

    # 基目录（.sdlc-demo/）
    base_dir = context_path.parent

    # 项目信息
    project_info = extract_project_info(context_bus)

    # 采集各阶段度量
    stages = {}
    for gate_id, stage_name, dir_name, ctx_key in STAGES:
        log(f"采集 {gate_id} ({stage_name}) ...")
        stages[gate_id] = collect_stage(context_bus, base_dir, gate_id, stage_name, dir_name, ctx_key)

    # 计算各类指标
    log("计算 Lead Time ...")
    lead_time = calc_lead_time(stages)

    log("计算门禁拦截率 ...")
    gate_interception = calc_gate_interception(stages)

    log("计算 DORA 指标 ...")
    dora = calc_dora(stages, context_bus, base_dir)

    log("计算 Agent 效能 ...")
    agent_efficiency = calc_agent_efficiency(stages, context_bus)

    # 数据完整性汇总
    stages_complete = sum(1 for s in stages.values() if s.get("status") in ("pass", "fail"))
    timestamp_complete = sum(
        1 for s in stages.values() if s.get("started_at") and s.get("completed_at")
    )
    dora_complete = sum(1 for m in dora.values() if m.get("value") is not None)

    metrics = {
        "collected_at": datetime.now().strftime(ISO_FMT),
        "context_bus_path": str(context_path),
        "requirement_id": project_info["requirement_id"],
        "project_name": project_info["project_name"],
        "stages": stages,
        "lead_time": lead_time,
        "gate_interception": gate_interception,
        "dora": dora,
        "agent_efficiency": agent_efficiency,
        "summary": {
            "stages_complete": stages_complete,
            "stages_total": 8,
            "data_completeness_pct": round(stages_complete / 8 * 100, 1),
            "timestamp_complete": timestamp_complete,
            "timestamp_total": 8,
            "dora_complete": dora_complete,
            "dora_total": 4,
            "all_gates_pass": all(
                s.get("gate_result") != "fail" for s in stages.values()
            ),
        },
    }

    return metrics


def main():
    parser = argparse.ArgumentParser(
        description="SDLC 度量数据采集器 — 从 context-bus.json 和门禁结果采集度量数据",
    )
    parser.add_argument(
        "--context", required=True,
        help="context-bus.json 文件路径（如 .sdlc-demo/context-bus.json）",
    )
    parser.add_argument(
        "--output", required=True,
        help="度量报告输出路径（如 .sdlc-demo/08-pm/metrics-report.json）",
    )
    args = parser.parse_args()

    # 采集度量
    metrics = collect_metrics(args.context)
    if metrics is None:
        print(json.dumps({"error": "采集失败：无法加载 context-bus.json"}, ensure_ascii=False))
        sys.exit(1)

    # 写入输出文件
    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(metrics, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    log(f"度量报告已输出: {output_path}")

    # 控制台摘要
    summary = metrics["summary"]
    print(json.dumps({
        "status": "success",
        "output": str(output_path),
        "requirement_id": metrics["requirement_id"],
        "stages_complete": f"{summary['stages_complete']}/{summary['stages_total']}",
        "data_completeness_pct": summary["data_completeness_pct"],
        "timestamp_complete": f"{summary['timestamp_complete']}/{summary['timestamp_total']}",
        "dora_complete": f"{summary['dora_complete']}/{summary['dora_total']}",
        "lead_time_hours": metrics["lead_time"]["total_hours"],
        "all_gates_pass": summary["all_gates_pass"],
    }, ensure_ascii=False, indent=2))

    print(f"\n{'=' * 60}", file=sys.stderr)
    print(f"SDLC 度量采集完成", file=sys.stderr)
    print(f"  需求ID: {metrics['requirement_id']}", file=sys.stderr)
    print(f"  阶段完整: {summary['stages_complete']}/{summary['stages_total']}", file=sys.stderr)
    print(f"  时间戳完整: {summary['timestamp_complete']}/{summary['timestamp_total']}", file=sys.stderr)
    print(f"  DORA 指标: {summary['dora_complete']}/{summary['dora_total']}", file=sys.stderr)
    print(f"  Lead Time: {metrics['lead_time']['total_hours']} 小时", file=sys.stderr)
    print(f"  门禁全通过: {summary['all_gates_pass']}", file=sys.stderr)
    print(f"{'=' * 60}", file=sys.stderr)

    # 退出码：数据不完整时返回 1
    if (summary["stages_complete"] < summary["stages_total"]
            or summary["timestamp_complete"] < summary["timestamp_total"]
            or summary["dora_complete"] < summary["dora_total"]):
        log("警告：度量数据不完整（部分阶段/DORA 指标缺失）")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
