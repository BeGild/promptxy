#!/bin/bash
#
# records-query CLI 包装脚本
# 渐进式披露的记录查询工具
#
# 用法: ./scripts/records.sh <command> [options]
#
# 示例:
#   ./scripts/records.sh list sessions --limit 5
#   ./scripts/records.sh list requests --conversation msg_abc123
#   ./scripts/records.sh structure 2026-01-29_10-30-15-234_xxx
#   ./scripts/records.sh get 2026-01-29_10-30-15-234_xxx --path originalBody.model
#

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 检查 dist 目录是否存在
if [ ! -d "${PROJECT_ROOT}/dist/records-query" ]; then
    echo "错误: 未找到编译后的文件。请先运行 'npm run build'" >&2
    exit 1
fi

# 执行 CLI
node "${PROJECT_ROOT}/dist/records-query/cli.js" "$@"
