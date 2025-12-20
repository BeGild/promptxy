#!/bin/bash

# PromptXY v2.0 生产环境启动脚本
# 启动构建后的后端服务（包含 API 和静态文件）

set -e

echo "========================================="
echo "  PromptXY v2.0 - 生产环境启动"
echo "========================================="
echo ""

# 检查是否在正确的目录
if [ ! -f "backend/package.json" ]; then
    echo "错误: 请在项目根目录或 backend 目录运行此脚本"
    exit 1
fi

# 检查构建文件
if [ ! -d "dist" ]; then
    echo "错误: 未找到构建文件，请先运行 ./scripts/build.sh"
    exit 1
fi

if [ ! -d "public" ] || [ ! -f "public/index.html" ]; then
    echo "错误: 未找到前端静态文件，请先运行 ./scripts/build.sh"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: Node.js 未安装"
    exit 1
fi

echo "启动 PromptXY 服务..."
echo "API 端口: 7071"
echo "Web UI: http://127.0.0.1:7071"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

cd backend
node dist/main.js
