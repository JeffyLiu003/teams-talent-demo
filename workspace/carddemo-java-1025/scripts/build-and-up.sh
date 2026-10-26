#!/usr/bin/env bash
# 构建全部模块（跳过测试）并启动 Docker Compose 编排
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> 1/3 构建 jar（跳过测试）"
mvn -q -DskipTests package

echo "==> 2/3 构建镜像并启动"
docker compose up -d --build

echo "==> 3/3 容器状态"
docker compose ps
