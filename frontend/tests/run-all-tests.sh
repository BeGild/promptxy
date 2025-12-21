#!/bin/bash

# 测试运行脚本
echo "🚀 开始运行 PromptXY 前端单元测试..."
echo ""

# 检查是否安装了依赖
if [ ! -d "node_modules" ]; then
    echo "❌ 未找到 node_modules，请先运行 npm install"
    exit 1
fi

# 运行所有测试
echo "📦 运行所有单元测试..."
npm run test:run

# 检查测试结果
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 所有测试通过！"
    echo ""
    echo "📊 测试覆盖范围："
    echo "   - 工具函数测试 (utils.test.ts)"
    echo "   - API 客户端测试 (api.test.ts)"
    echo "   - Hooks 测试 (hooks.test.ts)"
    echo "   - Store 测试 (store.test.ts)"
    echo ""
    echo "🎯 测试模块详情："
    echo "   1. utils/formatter.ts - 时间格式化、JSON美化、字节大小格式化"
    echo "   2. utils/validator.ts - 规则验证、正则验证"
    echo "   3. utils/diff.ts - JSON diff算法、行级比较"
    echo "   4. api/client.ts - Axios实例、错误处理、重试逻辑"
    echo "   5. api/sse.ts - EventSource连接管理、重连逻辑、事件解析"
    echo "   6. api/rules.ts - CRUD操作"
    echo "   7. api/requests.ts - 请求列表、详情、清理"
    echo "   8. api/config.ts - 配置读写"
    echo "   9. hooks/useRules.ts - React Query hooks、Mutation hooks"
    echo "   10. hooks/useRequests.ts - 请求列表过滤、详情"
    echo "   11. hooks/useSSE.ts - SSE连接、事件处理"
    echo "   12. hooks/useConfig.ts - 配置读写 hooks"
    echo "   13. store/app-store.ts - 全局应用状态"
    echo "   14. store/ui-store.ts - UI状态（模态框、过滤器）"
else
    echo ""
    echo "❌ 测试失败，请检查错误信息"
    exit 1
fi
