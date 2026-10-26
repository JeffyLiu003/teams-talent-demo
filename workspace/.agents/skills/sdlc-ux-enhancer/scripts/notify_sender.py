#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
通知发送器 - 读取门禁结果，发送通知到企业微信/钉钉/Slack Webhook。

用法：
    python notify_sender.py --message "G3门禁通过" \
        --webhook https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx \
        --channel wechat

支持的渠道（--channel）：
    wechat   企业微信（群机器人 Webhook）
    dingtalk 钉钉（自定义机器人 Webhook）
    slack    Slack（Incoming Webhook）

可选参数：
    --gate-result <path>  读取门禁结果 JSON，补充阶段/状态/关键指标/下一步行动
    --title <text>        通知标题（默认 "SDLC 门禁通知"）
    --dry-run             仅打印将要发送的载荷，不实际请求

说明：
    - 仅使用 Python 标准库（urllib），无需第三方依赖
    - Webhook URL 不会写入日志，仅在请求时使用
    - 网络/HTTP 错误返回退出码 1

退出码：0=成功, 1=发送失败
"""

import argparse
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

# 渠道白名单
VALID_CHANNELS = {"wechat", "dingtalk", "slack"}


def build_wechat_payload(title: str, content_text: str) -> dict:
    """构建企业微信 markdown 消息载荷。"""
    markdown_text = f"## {title}\n\n{content_text}"
    return {
        "msgtype": "markdown",
        "markdown": {"content": markdown_text},
    }


def build_dingtalk_payload(title: str, content_text: str) -> dict:
    """构建钉钉 markdown 消息载荷。"""
    return {
        "msgtype": "markdown",
        "markdown": {"title": title, "text": f"## {title}\n\n{content_text}"},
    }


def build_slack_payload(title: str, content_text: str) -> dict:
    """构建 Slack 消息载荷。"""
    return {
        "text": f"*{title}*\n{content_text}",
    }


def build_payload(channel: str, title: str, content_text: str) -> dict:
    """根据渠道构建请求载荷。"""
    if channel == "wechat":
        return build_wechat_payload(title, content_text)
    elif channel == "dingtalk":
        return build_dingtalk_payload(title, content_text)
    elif channel == "slack":
        return build_slack_payload(title, content_text)
    raise ValueError(f"不支持的渠道: {channel}")


def load_gate_result(path: Path) -> dict:
    """读取门禁结果 JSON，提取阶段/状态/关键指标/下一步行动。"""
    if not path.exists():
        return {}
    try:
        # utf-8-sig 兼容带 BOM 的 Windows 文件
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except (json.JSONDecodeError, OSError):
        return {}
    if not isinstance(data, dict):
        return {}
    return data


def compose_content(message: str, gate_result: dict) -> str:
    """组合通知正文：用户消息 + 门禁结果摘要。"""
    parts = [message]
    if gate_result:
        stage = gate_result.get("stage") or gate_result.get("phase") or ""
        status = gate_result.get("status") or gate_result.get("verdict") or ""
        metrics = gate_result.get("metrics") or gate_result.get("summary") or ""
        next_action = gate_result.get("next_action") or gate_result.get("next") or ""

        if stage:
            parts.append(f"\n**阶段：** {stage}")
        if status:
            parts.append(f"**状态：** {status}")
        if metrics:
            parts.append(f"**关键指标：** {metrics}")
        if next_action:
            parts.append(f"**下一步行动：** {next_action}")
    parts.append(f"\n_时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}_")
    return "\n".join(parts)


def send_webhook(webhook_url: str, payload: dict, channel: str) -> tuple:
    """
    发送 Webhook 请求。
    返回 (success: bool, detail: str)
    """
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "sdlc-ux-enhancer/1.0",
    }
    # Slack 要求 utf-8 字符不转义
    req = urllib.request.Request(webhook_url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            status = resp.getcode()
            if 200 <= status < 300:
                return True, f"HTTP {status} {body}"
            return False, f"HTTP {status} {body}"
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        return False, f"HTTPError {e.code} {body}"
    except urllib.error.URLError as e:
        return False, f"URLError {e.reason}"
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

    parser = argparse.ArgumentParser(
        description="通知发送器 - 发送门禁结果通知到企业微信/钉钉/Slack Webhook"
    )
    parser.add_argument(
        "--message", required=True,
        help="通知正文消息（如 \"G3门禁通过\"）",
    )
    parser.add_argument(
        "--webhook", required=True,
        help="Webhook URL",
    )
    parser.add_argument(
        "--channel", required=True, choices=sorted(VALID_CHANNELS),
        help="通知渠道：wechat / dingtalk / slack",
    )
    parser.add_argument(
        "--gate-result", default=None,
        help="门禁结果 JSON 文件路径（可选，用于补充阶段/状态/指标/下一步）",
    )
    parser.add_argument(
        "--title", default="SDLC 门禁通知",
        help="通知标题（默认 \"SDLC 门禁通知\"）",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="仅打印将要发送的载荷，不实际发送",
    )

    args = parser.parse_args()

    gate_result = {}
    if args.gate_result:
        gate_result = load_gate_result(Path(args.gate_result))

    content_text = compose_content(args.message, gate_result)

    try:
        payload = build_payload(args.channel, args.title, content_text)
    except ValueError as e:
        print(f"错误：{e}", file=sys.stderr)
        sys.exit(1)

    payload_json = json.dumps(payload, ensure_ascii=False, indent=2)

    if args.dry_run:
        print("[dry-run] 渠道:", args.channel)
        print("[dry-run] Webhook:", args.webhook)
        print("[dry-run] 载荷:")
        print(payload_json)
        sys.exit(0)

    print(f"发送通知到 {args.channel} ...", file=sys.stderr)
    success, detail = send_webhook(args.webhook, payload, args.channel)

    if success:
        print(f"通知发送成功: {detail}")
        sys.exit(0)
    else:
        print(f"错误：通知发送失败: {detail}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
