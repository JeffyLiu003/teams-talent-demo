"""ORM 模型：与 db/schema.sql 的 trace 数据表一一对应（Repository Pattern 的领域模型层）。

字段类型采用跨方言通用类型：
- UUID 语义列用 UUID36（PG 下为原生 UUID 列，绑定参数自动转 uuid；
  MySQL 下为 VARCHAR(36) 存带连字符 UUID 字符串，与 schema_mysql.sql 的 CHAR(36) 一致）
- JSON 列用 JSON（PG 下为 JSONB，MySQL 下为 JSON）

注：项目管理功能已移除，project_id 仅作为集成方自带的数据隔离维度（无外键、
无 projects 表），故此处不映射 Project 模型；它为任意字符串（如 l0/l1/l2），
SQL 侧为 VARCHAR(64)（PG/MySQL 一致），故映射为 String(64) 而非 UUID36。

注：与 db/schema.sql / schema_mysql.sql 一致，**不声明任何表级外键**——按日分区
改造要求子表不 REFERENCES 分区父表，且外键检查会对父行加共享锁带来写争用。
session_id / trace_id / span_id 仅为普通列，引用完整性由 consumer 的
ensure_* 占位与查询过滤保证（本模块不参与建表，仅供 ORM 查询映射）。
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Column,
    DateTime,
    Index,
    Integer,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# 跨方言 UUID 列：PG 存原生 uuid 列（Uuid 绑定自动转 uuid，避免 uuid=varchar 报错），
# MySQL 存 VARCHAR(36) 带连字符字符串（与 schema_mysql.sql 的 CHAR(36) 语义一致）。
UUID36 = String(36).with_variant(Uuid, "postgresql")


class Base(DeclarativeBase):
    pass


class Session(Base):
    __tablename__ = "sessions"

    # id 用 VARCHAR：session_id 语义与 langfuse 一致（可为任意字符串，如 sess-xxx）
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(64))
    name: Mapped[str | None] = mapped_column(String(255))
    user_id: Mapped[str | None] = mapped_column(String(255))
    metadata_json: Mapped[dict | None] = Column("metadata", JSON)
    trace_count: Mapped[int] = mapped_column(Integer, server_default="0")
    total_tokens: Mapped[int] = mapped_column(BigInteger, server_default="0")
    total_duration_ms: Mapped[int] = mapped_column(BigInteger, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (Index("idx_sessions_project", "project_id", "created_at"),)


class Trace(Base):
    __tablename__ = "traces"

    id: Mapped[str] = mapped_column(UUID36, primary_key=True)
    event_id: Mapped[str] = mapped_column(UUID36, unique=True)
    project_id: Mapped[str] = mapped_column(String(64))
    session_id: Mapped[str | None] = mapped_column(String(64))
    name: Mapped[str | None] = mapped_column(String(255))
    agent_name: Mapped[str | None] = mapped_column(String(255))
    input: Mapped[dict | None] = mapped_column(JSON)
    output: Mapped[dict | None] = mapped_column(JSON)
    duration_ms: Mapped[int | None] = mapped_column(BigInteger)
    react_step_count: Mapped[int] = mapped_column(Integer, server_default="0")
    tool_count: Mapped[int] = mapped_column(Integer, server_default="0")
    span_count: Mapped[int] = mapped_column(Integer, server_default="0")
    status: Mapped[str] = mapped_column(String(20), server_default="success")
    error_info: Mapped[dict | None] = mapped_column(JSON)
    started_at: Mapped[datetime | None] = mapped_column(DateTime())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("idx_traces_project_time", "project_id", "created_at"),
        Index("idx_traces_session", "session_id"),
    )


class Span(Base):
    __tablename__ = "spans"

    id: Mapped[str] = mapped_column(UUID36, primary_key=True)
    event_id: Mapped[str] = mapped_column(UUID36, unique=True)
    project_id: Mapped[str] = mapped_column(String(64))
    trace_id: Mapped[str] = mapped_column(UUID36)
    parent_span_id: Mapped[str | None] = mapped_column(UUID36)
    name: Mapped[str] = mapped_column(String(255))
    span_type: Mapped[str] = mapped_column(String(20))
    input: Mapped[dict | None] = mapped_column(JSON)
    output: Mapped[dict | None] = mapped_column(JSON)
    duration_ms: Mapped[int | None] = mapped_column(BigInteger)
    model: Mapped[str | None] = mapped_column(String(255))
    tool_name: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), server_default="success")
    error_info: Mapped[dict | None] = mapped_column(JSON)
    started_at: Mapped[datetime | None] = mapped_column(DateTime())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("idx_spans_trace", "trace_id", "created_at"),
        Index("idx_spans_parent", "parent_span_id"),
        Index("idx_spans_project_time", "project_id", "created_at"),
    )


class Observation(Base):
    __tablename__ = "observations"

    id: Mapped[str] = mapped_column(UUID36, primary_key=True)
    event_id: Mapped[str] = mapped_column(UUID36, unique=True)
    project_id: Mapped[str] = mapped_column(String(64))
    trace_id: Mapped[str] = mapped_column(UUID36)
    span_id: Mapped[str | None] = mapped_column(UUID36)
    model: Mapped[str | None] = mapped_column(String(255))
    prompt_tokens: Mapped[int] = mapped_column(Integer, server_default="0")
    completion_tokens: Mapped[int] = mapped_column(Integer, server_default="0")
    total_tokens: Mapped[int] = mapped_column(Integer, server_default="0")
    input: Mapped[dict | None] = mapped_column(JSON)
    output: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("idx_observations_span", "span_id", "created_at"),
        Index("idx_observations_trace", "trace_id", "created_at"),
    )


class LlmRequest(Base):
    """真实 LLM 请求（中间件拦截，event_id 关联 llm span）。

    与 db/schema.sql 的 llm_requests 表对应：event_id 主键（幂等），
    input/output 为真实请求/响应 payload。
    """

    __tablename__ = "llm_requests"

    event_id: Mapped[str] = mapped_column(UUID36, primary_key=True)
    id: Mapped[str] = mapped_column(UUID36)
    project_id: Mapped[str] = mapped_column(String(64))
    trace_id: Mapped[str] = mapped_column(UUID36)
    span_id: Mapped[str | None] = mapped_column(UUID36)
    model: Mapped[str | None] = mapped_column(String(256))
    input: Mapped[dict] = mapped_column(JSON)
    output: Mapped[dict | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(16), server_default="success")
    error_info: Mapped[dict | None] = mapped_column(JSON)
    started_at: Mapped[datetime | None] = mapped_column(DateTime())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("idx_llm_requests_trace", "trace_id"),
        Index("idx_llm_requests_span", "span_id"),
    )
