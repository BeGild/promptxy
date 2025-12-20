#!/bin/bash

# PromptXY v2.0 构建脚本
# 构建前端并复制到后端 public 目录

set -e

echo "========================================="
echo "  PromptXY v2.0 - 构建脚本"
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

echo "步骤 1: 构建前端..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    npm install
fi
npm run build
cd ..

echo ""
echo "步骤 2: 复制构建文件到后端 public 目录..."
mkdir -p backend/public
rm -rf backend/public/*
cp -r frontend/dist/* backend/public/

echo ""
echo "步骤 3: 构建后端..."
cd backend
if [ ! -d "node_modules" ]; then
    echo "安装后端依赖..."
    npm install
fi
npm run build
cd ..

echo ""
echo "========================================="
echo "  构建完成!"
echo "========================================="
echo ""
echo "构建文件位置:"
echo "  - 后端代码: backend/dist/"
echo "  - 前端静态: backend/public/"
echo ""
echo "运行生产环境:"
echo "  cd backend && npm start"
echo ""
