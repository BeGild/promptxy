#!/bin/bash

# PromptXY v2.0 开发环境启动脚本
# 同时启动后端和前端开发服务器

set -e

echo "========================================="
echo "  PromptXY v2.0 - 开发环境启动"
echo "========================================="
echo ""

# 检查是否在正确的目录
if [ ! -f "backend/package.json" ] || [ ! -f "frontend/package.json" ]; then
    echo "错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: Node.js 未安装"
    exit 1
fi

# 检查依赖
echo "检查依赖..."
if [ ! -d "backend/node_modules" ]; then
    echo "安装后端依赖..."
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "安装前端依赖..."
    cd frontend && npm install && cd ..
fi

echo ""
echo "========================================="
echo "  启动服务..."
echo "========================================="
echo ""

# 启动后端 (使用 tmux 或后台进程)
echo "启动后端 (端口 7070 + 7071)..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

sleep 2

# 启动前端
echo "启动前端 (端口 5173)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "========================================="
echo "  服务已启动!"
echo "========================================="
echo ""
echo "后端 Gateway:  http://127.0.0.1:7070"
echo "后端 API:      http://127.0.0.1:7071"
echo "前端 Web UI:   http://localhost:5173"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# 等待用户中断
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo '服务已停止'; exit 0" INT TERM

wait
