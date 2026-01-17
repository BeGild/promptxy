## 1. Spec & Proposal
- [ ] 1.1 写 proposal.md（含 BREAKING 说明）
- [ ] 1.2 写 claude-openai-chat-transformation spec delta
- [ ] 1.3 写 promptxy-gateway spec delta
- [ ] 1.4 openspec validate 严格校验

## 2. Implementation
- [ ] 2.1 拆分 Supplier.protocol：openai-codex/openai-chat
- [ ] 2.2 更新默认配置与校验（config.ts）
- [ ] 2.3 新增 Claude→OpenAI Chat 请求转换
- [ ] 2.4 新增 OpenAI Chat→Claude 响应转换（非流式）
- [ ] 2.5 新增 OpenAI Chat SSE→Claude SSE 转换流
- [ ] 2.6 网关路由选择与图标映射更新
- [ ] 2.7 前端供应商协议下拉/展示更新
- [ ] 2.8 补齐集成测试与 fixtures

## 3. Verification
- [ ] 3.1 运行后端测试
- [ ] 3.2 运行 build
