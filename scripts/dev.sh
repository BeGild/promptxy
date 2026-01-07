#!/bin/bash

# PromptXY 开发环境启动脚本
# 同时启动后端和前端开发服务器

set -e

echo "========================================="
echo "  PromptXY - 开发环境启动"
echo "========================================="
echo ""

# 检查是否在正确的目录
# 后端依赖在根目录 package.json，前端依赖在 frontend/package.json
if [ ! -f "package.json" ] || [ ! -f "frontend/package.json" ]; then
	echo "错误: 请在项目根目录运行此脚本"
	exit 1
fi

# 检查 Node.js
if ! command -v node &>/dev/null; then
	echo "错误: Node.js 未安装"
	exit 1
fi

# 检查依赖
echo "检查依赖..."
if [ ! -d "node_modules" ]; then
	echo "安装后端依赖..."
	npm install
fi

if [ ! -d "frontend/node_modules" ]; then
	echo "安装前端依赖..."
	cd frontend && npm install && cd ..
fi

#npm run build

echo ""
echo "========================================="
echo "  启动服务..."
echo "========================================="
echo ""

# 启动后端
echo "启动后端服务..."
npm run dev &
BACKEND_PID=$!

# 等待后端启动并检测端口
echo "等待后端服务启动..."
sleep 3

# 检测后端端口（尝试常见范围）
BACKEND_PORT=""
# 说明：后端默认端口通过用户名 hash 计算（范围 8000-9000），因此这里覆盖完整区间
for port in {7070..7100} {8000..9000}; do
	if curl -s -m 1 "http://127.0.0.1:${port}/_promptxy/health" >/dev/null 2>&1; then
		BACKEND_PORT=$port
		break
	fi
done

if [ -z "$BACKEND_PORT" ]; then
	echo "警告: 无法检测到后端端口，使用默认端口 7070"
	BACKEND_PORT=7070
fi

echo "检测到后端端口: $BACKEND_PORT"
echo ""

# 启动前端（传入后端端口）
echo "启动前端 (端口 5173)..."
cd frontend
VITE_BACKEND_PORT=$BACKEND_PORT npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "========================================="
echo "  服务已启动!"
echo "========================================="
echo ""
echo "后端服务:     http://127.0.0.1:$BACKEND_PORT"
echo "前端 Web UI:  http://localhost:5173"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# 等待用户中断
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo '服务已停止'; exit 0" INT TERM

wait
