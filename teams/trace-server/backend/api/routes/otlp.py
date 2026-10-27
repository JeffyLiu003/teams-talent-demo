"""OTLP/HTTP 接收端点（默认 `POST /v1/traces`）。

刻意不挂在 `/api/v1` 前缀下：OTLP 客户端的 endpoint 配置习惯是
`http://host:4318/v1/traces`，保持标准路径便于直接对接。

处理顺序见 docs/OTLP端点接收实现方案.md §5.1：
读 body → gunzip → content-type 分流解码 → mapper 转换 → sink 投递 → 立即响应。
"""
from __future__ import annotations

import gzip
import logging
from typing import Any

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

from config import (
    OTLP_AUTH_TOKEN,
    OTLP_MAX_BODY_BYTES,
    OTLP_PATH,
)
from otlp import (
    OtlpDecodeError,
    build_json_response,
    build_protobuf_response,
    decode_body,
    map_resource_spans,
)

logger = logging.getLogger("trace_server.otlp")

router = APIRouter()


def _unauthorized() -> Response:
    return JSONResponse(
        status_code=401,
        content={"error": "Unauthorized"},
    )


def _check_auth(request: Request) -> bool:
    """OTLP_AUTH_TOKEN 非空时校验 Authorization: Bearer <token>。"""
    if not OTLP_AUTH_TOKEN:
        return True
    header = request.headers.get("authorization") or ""
    token = header[7:].strip() if header.lower().startswith("bearer ") else ""
    return token == OTLP_AUTH_TOKEN


async def _read_body(request: Request) -> bytes:
    """读取原始 body（受 OTLP_MAX_BODY_BYTES 限制）。"""
    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > OTLP_MAX_BODY_BYTES:
            raise ValueError("body too large")
        chunks.append(chunk)
    return b"".join(chunks)


def _respond(request: Request, rejected: int, message: str | None) -> Response:
    """按请求的 content-type 返回对应格式的 ExportTraceServiceResponse。"""
    content_type = (request.headers.get("content-type") or "").lower()
    if "application/x-protobuf" in content_type:
        body = build_protobuf_response(rejected, message)
        if body is not None:
            return Response(content=body, media_type="application/x-protobuf")
        return Response(content=b"", media_type="application/x-protobuf")
    return JSONResponse(content=build_json_response(rejected, message))


async def _handle(request: Request) -> Response:
    if not _check_auth(request):
        return _unauthorized()

    try:
        body = await _read_body(request)
    except ValueError:
        logger.warning("OTLP 请求体超过上限 %d 字节", OTLP_MAX_BODY_BYTES)
        return JSONResponse(status_code=413, content={"error": "body too large"})
    except Exception:
        logger.exception("OTLP 读取请求体失败")
        return JSONResponse(status_code=400, content={"error": "read body failed"})

    if (request.headers.get("content-encoding") or "").lower().find("gzip") >= 0:
        try:
            body = gzip.decompress(body)
        except OSError:
            logger.warning("OTLP gzip 解压失败")
            return JSONResponse(
                status_code=400, content={"error": "decompress failed"}
            )

    if not body:
        return _respond(request, 0, None)

    try:
        resource_spans = decode_body(body, request.headers.get("content-type") or "")
    except OtlpDecodeError as exc:
        logger.warning("OTLP 请求解析失败: %s", exc)
        return JSONResponse(status_code=400, content={"error": str(exc)})

    if not resource_spans:
        return _respond(request, 0, None)

    events, rejected = map_resource_spans(resource_spans)

    sink = getattr(request.app.state, "otlp_sink", None)
    if sink is None:
        logger.error("OTLP sink 未初始化，丢弃 %d 条事件", len(events))
        return JSONResponse(
            status_code=503, content={"error": "otlp sink not ready"}
        )

    if not sink.offer(events):
        # 队列满 → 让客户端按自己的退避策略重试（绝不静默丢）
        return JSONResponse(
            status_code=503, content={"error": "otlp queue full, retry later"}
        )

    message = f"rejected {rejected} span(s)" if rejected else None
    if rejected:
        logger.warning("OTLP 部分 span 解析失败: %d 条", rejected)
    return _respond(request, rejected, message)


@router.post(OTLP_PATH, include_in_schema=False)
async def ingest_traces(request: Request) -> Response:
    return await _handle(request)


# OTel 客户端可能同时导出 metrics / logs，这里给 200 空响应避免刷错误日志
@router.post("/v1/metrics", include_in_schema=False)
async def ingest_metrics() -> Any:
    return {}


@router.post("/v1/logs", include_in_schema=False)
async def ingest_logs() -> Any:
    return {}
