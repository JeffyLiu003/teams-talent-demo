"""服务端集中配置：从 trace_server/.env / 环境变量读取，无硬编码默认值。

所有可配置项：
- STORAGE_BACKEND : database | file
- DATABASE_URL    : SQLAlchemy async URL（database 后端）
- DATA_FILE       : SDK 直写 JSONL 文件目录（file 后端，只读）
- HOST / PORT     : 服务监听地址

配置文件位于 trace_server/.env，本文件在 backend/ 下。
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# trace_server 根目录 = backend 的上一级
SERVER_ROOT = Path(__file__).resolve().parent.parent
# 加载 trace_server/.env（存在时），环境变量优先（load_dotenv 默认不覆盖已存在变量）
_ENV_FILE = SERVER_ROOT / ".env"
load_dotenv(_ENV_FILE, override=False)

DEFAULT_STORAGE_BACKEND = "database"
STORAGE_BACKENDS = ("database", "file")

# 存储后端
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", DEFAULT_STORAGE_BACKEND)
if STORAGE_BACKEND not in STORAGE_BACKENDS:
    raise RuntimeError(
        f"STORAGE_BACKEND 无效: {STORAGE_BACKEND!r}，可选 {STORAGE_BACKENDS}"
    )

# 数据库 URL（database 后端必需）
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if STORAGE_BACKEND == "database" and not DATABASE_URL:
    raise RuntimeError(
        "未配置 DATABASE_URL：请在 trace_server/.env 中设置数据库连接，"
        "例如 postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/trace_db"
    )

# SDK 直写 JSONL 文件目录（file 后端使用，只读）
DATA_FILE = os.getenv("DATA_FILE", "trace_data")

# 服务监听
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))

# 若 DATA_FILE 为相对路径，则相对 trace_server/ 根目录解析
if not os.path.isabs(DATA_FILE):
    DATA_FILE = str(SERVER_ROOT / DATA_FILE)


# ============================================================
# OTLP 端点接收（见 docs/OTLP端点接收实现方案.md）
#
# 注意：OTLP_SINK 与 STORAGE_BACKEND 是**两个独立开关**：
#   OTLP_SINK       —— 接收端把事件写到哪里
#   STORAGE_BACKEND —— 查询端从哪里读
# 二者互不牵连，允许「写 Kafka 读 Python 文件」这类组合。
# ============================================================

OTLP_ENABLED = os.getenv("OTLP_ENABLED", "1") == "1"

# 接收路径（挂在根路径下，不在 /api/v1 前缀内）
OTLP_PATH = os.getenv("OTLP_PATH", "/v1/traces")

# 写入通道：kafka（默认）| redis | file | none
OTLP_SINK = os.getenv("OTLP_SINK", "kafka").strip().lower()
OTLP_SINK_CHOICES = ("kafka", "redis", "file", "none")

# 客户端未带 project 属性时的兜底项目
OTLP_DEFAULT_PROJECT_ID = os.getenv("OTLP_DEFAULT_PROJECT_ID", "otlp")

# 非空则校验 Authorization: Bearer <token>
OTLP_AUTH_TOKEN = os.getenv("OTLP_AUTH_TOKEN", "").strip()

# 请求体上限（字节），默认 16MB
OTLP_MAX_BODY_BYTES = int(os.getenv("OTLP_MAX_BODY_BYTES", str(16 * 1024 * 1024)))

# 批处理参数
OTLP_QUEUE_SIZE = int(os.getenv("OTLP_QUEUE_SIZE", "10000"))
OTLP_FLUSH_INTERVAL = float(os.getenv("OTLP_FLUSH_INTERVAL", "1.0"))
OTLP_BATCH_SIZE = int(os.getenv("OTLP_BATCH_SIZE", "200"))

# 事件时间戳时区（IANA 名），需与 SDK 侧 TRACE_TIMEZONE 口径一致
OTLP_TIMEZONE = os.getenv("OTLP_TIMEZONE", "Asia/Shanghai")

# file 通道输出目录；留空则沿用 DATA_FILE
_OTLP_FILE_DIR_RAW = os.getenv("OTLP_FILE_DIR", "").strip()
OTLP_FILE_DIR = _OTLP_FILE_DIR_RAW or DATA_FILE
if _OTLP_FILE_DIR_RAW and not os.path.isabs(_OTLP_FILE_DIR_RAW):
    OTLP_FILE_DIR = str(SERVER_ROOT / _OTLP_FILE_DIR_RAW)

# kafka 通道（OTLP_SINK=kafka 时生效）：接收端自己的连接串，
# 与查询侧、consumer 侧配置互不影响
OTLP_KAFKA_BOOTSTRAP = os.getenv("OTLP_KAFKA_BOOTSTRAP", "127.0.0.1:9092").strip()
OTLP_KAFKA_TOPIC = os.getenv("OTLP_KAFKA_TOPIC", "trace_topic").strip()
OTLP_KAFKA_ACKS = os.getenv("OTLP_KAFKA_ACKS", "all").strip()

# redis 通道（OTLP_SINK=redis 时生效）
OTLP_REDIS_URL = os.getenv(
    "OTLP_REDIS_URL", "redis://:myredissecret@127.0.0.1:6379/0"
).strip()
OTLP_REDIS_TOPIC = os.getenv("OTLP_REDIS_TOPIC", "trace_topic").strip()

# 下游不可达时的重连间隔（秒）
OTLP_RECONNECT_INTERVAL = float(os.getenv("OTLP_RECONNECT_INTERVAL", "5.0"))

if OTLP_ENABLED and OTLP_SINK not in OTLP_SINK_CHOICES:
    raise RuntimeError(
        f"OTLP_SINK 无效: {OTLP_SINK!r}，可选 {OTLP_SINK_CHOICES}"
    )
