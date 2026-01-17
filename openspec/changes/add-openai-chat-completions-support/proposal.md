# Change: 增加 OpenAI Chat Completions 协议转换支持

## Why

项目演进需要对接 OpenAI `/chat/completions` 协议，以便 Claude Code 通过 `/claude` 使用支持该协议的供应商。

## What Changes

- 新增 Claude Messages → OpenAI Chat Completions 的转换（请求/非流式响应/流式 SSE）
- 将 OpenAI 供应商协议拆分为：`openai-codex`（/responses）与 `openai-chat`（/chat/completions）
- 更新默认供应商命名：OpenaiCodex / Openai
- **BREAKING**：不再接受旧 `Supplier.protocol: openai`（开发阶段不兼容旧配置）

## Impact

- Affected specs: `claude-openai-chat-transformation`, `promptxy-gateway`
- Affected code (planned): `backend/src/promptxy/types.ts`, `backend/src/promptxy/config.ts`, `backend/src/promptxy/gateway.ts`, `backend/src/promptxy/transformers/**`, `frontend/src/**`
