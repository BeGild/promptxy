# 数据统计问题修复清单

## 问题汇总

### 问题 1：Token 始终为 0
**状态**: 🔴 严重
**原因**: OpenAI 流式 API 默认不返回 usage 数据
**修复位置**: `backend/src/promptxy/gateway.ts`

### 问题 2：成功率超过 2000%
**状态**: 🔴 严重
**原因**: 统计数据文件已损坏，`requestTotal` 与 `requestSuccess` 不一致
**修复步骤**:
1. 立即重置统计数据（见下方命令）
2. 添加数据校验逻辑（见修复代码）

---

## 立即修复步骤

### 步骤 1：重置统计数据

```bash
# 执行重置脚本
chmod +x scripts/reset-stats.sh
./scripts/reset-stats.sh
```

### 步骤 2：修复 OpenAI Usage 追踪

需要在向上游发送请求时，添加 `stream_options.include_usage: true`。

**修改位置**: `backend/src/promptxy/gateway.ts`

在发送请求到上游之前，修改请求体：

```typescript
// 在转发请求到上游之前，确保启用 usage 追踪
if (jsonBody?.stream === true) {
  jsonBody.stream_options = {
    ...jsonBody.stream_options,
    include_usage: true
  };
}
```

### 步骤 3：添加数据校验

在 `backend/src/promptxy/database.ts` 的 `extractMetrics` 方法后，添加校验：

```typescript
// 在 extractMetrics 方法末尾添加
private validateMetrics(metrics: StatsMetrics): void {
  // 确保 requestTotal 始终等于 requestSuccess + requestFailed
  const expectedTotal = metrics.requestSuccess + metrics.requestFailed;
  if (metrics.requestTotal !== expectedTotal) {
    console.warn(`[PromptXY] 统计数据不一致，自动修复: requestTotal ${metrics.requestTotal} -> ${expectedTotal}`);
    metrics.requestTotal = expectedTotal;
  }
}
```

---

## 数据验证

重置数据后，验证统计功能正常：

1. 启动服务后访问数据统计页面
2. 发送几个测试请求
3. 检查日志中的统计更新
4. 验证成功率和 Token 数显示正常

---

## 预防措施

1. **定期备份**: 统计数据文件位于 `~/.local/promptxy/indexes/`
2. **监控告警**: 如果成功率 > 100%，立即发出警告
3. **数据校验**: 定期运行数据一致性检查
