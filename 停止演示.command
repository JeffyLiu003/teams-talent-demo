#!/bin/zsh
set -eu
cd "$(dirname "$0")/demo"
exec /bin/zsh "停止演示.command"
