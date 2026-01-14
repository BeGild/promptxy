# Tasks

- [x] 调研当前 `/claude/v1/messages`（stream）实际使用的 SSE 转换路径与事件形状差异
- [x] 设计统一 SSE 转换接口：在 `createSSETransformStream('codex')` 中复用 `protocols/codex/sse/to-claude.ts`
- [x] 补齐 `message_start` 事件字段（id/usage/type/stop_sequence 等）并与旧行为对齐
- [x] 在 `response.completed` 时输出完整 usage：input_tokens/output_tokens/cached_tokens/reasoning_tokens
- [x] 迁移/保留 `ping` 事件行为（首个 message_start 后发送一次）
- [x] 删除 `backend/src/promptxy/transformers/index.ts` 中旧的 Codex SSE 内嵌转换实现
- [x] 增加覆盖 `createSSETransformStream('codex')` 的单测（模拟 SSE chunk，断言输出包含完整 usage 与稳定 id）
- [x] 运行 `npx vitest run --root backend --config vitest.config.ts` 验证
- [x] 运行 `npx tsc -p backend/tsconfig.json` 验证类型与构建
