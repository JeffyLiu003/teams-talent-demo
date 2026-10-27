"""OTLP 端点接收：把标准 OTLP/HTTP 上报转换成 trace2 内部事件。

模块划分：
- `decode`  —— 请求体解码（protobuf / JSON）与 ID 归一
- `semconv` —— OTel 语义约定常量 + span_type 推断
- `mapper`  —— resourceSpans → 内部事件 dict
- `sinks`   —— 事件落地通道（kafka / redis / file / none）

设计文档：docs/OTLP端点接收实现方案.md
"""
from __future__ import annotations

from .decode import (
    OtlpDecodeError,
    build_json_response,
    build_protobuf_response,
    decode_body,
    parse_otel_id,
)
from .mapper import flatten_attributes, hex_to_uuid, map_resource_spans
from .sinks import (
    BaseSink,
    FileSink,
    KafkaSink,
    NilSink,
    RedisSink,
    build_sink,
)

__all__ = [
    "OtlpDecodeError",
    "build_json_response",
    "build_protobuf_response",
    "decode_body",
    "parse_otel_id",
    "flatten_attributes",
    "hex_to_uuid",
    "map_resource_spans",
    "BaseSink",
    "FileSink",
    "KafkaSink",
    "RedisSink",
    "NilSink",
    "build_sink",
]
