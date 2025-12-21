#!/bin/bash

# PromptXY 集成测试运行脚本

echo "🚀 启动 PromptXY 集成测试..."
echo "================================"

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误：请在 backend 目录下运行此脚本"
    exit 1
fi

# 检查依赖
echo "📦 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "⚠️  未找到 node_modules，正在安装依赖..."
    npm install
fi

# 运行 TypeScript 编译检查
echo "🔍 TypeScript 类型检查..."
npx tsc --noEmit --skipLibCheck

if [ $? -ne 0 ]; then
    echo "❌ TypeScript 编译错误，请修复后再运行测试"
    exit 1
fi

echo "✅ 类型检查通过"

# 运行集成测试
echo "🧪 运行集成测试..."
echo "================================"

# 运行所有集成测试
npx vitest run tests/integration/ --reporter=verbose

TEST_RESULT=$?

echo "================================"
if [ $TEST_RESULT -eq 0 ]; then
    echo "✅ 所有集成测试通过！"
else
    echo "❌ 部分测试失败，请检查输出"
    exit $TEST_RESULT
fi