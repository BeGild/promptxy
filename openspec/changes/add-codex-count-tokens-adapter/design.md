## Context

PromptXY 当前支持 `/v1/messages` 端点，但缺少对 Claude 标准的 `/v1/messages/count_tokens` API 的完整支持。当前系统存在以下限制：

1. **架构现状**：
   - 网关支持多种协议转换（Claude → Codex/Gemini/Anthropic）
   - Gemini 转换器已有 `countTokens` 功能实现
   - Anthropic 原生支持 count_tokens API
   - Codex 转换器缺少 count_tokens 适配

2. **技术约束**：
   - OpenAI 标准不提供 count_tokens 端点
   - 不同供应商的 API 能力差异（有的支持，有的不支持）
   - 需要保证跨供应商的接口一致性
   - Token 计算精度 vs 性能的权衡

3. **业务需求**：
   - 用户需要准确的消息 token 计算以管理上下文窗口
   - 不同供应商提供不同精度的计算能力（tiktoken vs 字节估算）
   - 需要健壮的降级机制保证可用性

## Goals

- **主要目标**：实现跨供应商的 Token 计算能力，确保所有转换器支持 Claude count_tokens API
- **次要目标**：
  - 最小化代码修改（复用现有实现）
  - 提供统一的降级策略
  - 保持向后兼容性
  - 优化性能（优先上游 API，fallback 本地估算）

## Non-Goals

- 不重构现有的 Gemini 转换器（已经稳定运行）
- 不修改 Anthropic 的透明转发逻辑（原生支持）
- 不引入复杂的外部依赖（优先使用现有技术栈）
- 不改变现有的 `/v1/messages` 端点行为

## Decisions

### 决策 1：采用混合策略而非统一字节估算

**问题**：
- **选项 A（统一字节估算）**：所有渠道都使用 `Math.ceil(totalChars / 3)`
  - 优点：完全统一、性能最优、零依赖
  - 缺点：失去 Gemini 已有 tiktoken 实现的精度
- **选项 B（混合策略）**：优先上游 API，fallback 到字节估算
  - 优点：复用 Gemini 实现、尽可能精确、有降级保障
  - 缺点：实现稍复杂

**选择**：选项 B（混合策略）

**理由**：
1. **最大化复用**：Gemini 转换器的 tiktoken 实现已经成熟，不应废弃
2. **渐进式增强**：先实现基础功能，后续可逐步优化精度
3. **用户体验**：优先提供精确计算（上游 API），降级时清晰标记
4. **架构清晰**：职责分离明确（上游检测、Token 计算、协议转换）

### 决策 2：字节估算的精度权衡

**算法选择**：`Math.ceil(totalChars / 3)` 而非 `Math.ceil(totalBytes / 4)`

**理由**：
1. **参考实现**：Codex 项目使用 `(字符数 + 1) / 4` 作为近似
2. **语言差异**：英文和中文的字节/字符比不同，字符数更通用
3. **简化逻辑**：避免复杂的 UTF-8 字节计算
4. **降级场景**：作为兜底方案，精度要求较低，快速性更重要

**精度说明**：
- 精确 tiktoken：使用分词器，准确率 > 95%
- 字节估算：基于经验公式，准确率 ~70-80%
- 使用标记 `_fallback: true` 让用户知道计算方法

### 决策 3：上游 API 探测机制

**实现选择**：通过调用 `/models` 端点检测能力

**理由**：
1. **OpenAI 标准规范**：官方文档可能说明 count_tokens 支持
2. **供应商兼容性**：某些供应商可能在 `/models` 响应中标记能力
3. **渐进探测**：首次调用失败后可回退到本地估算
4. **配置灵活性**：未来可通过配置禁用上游探测（性能优化）

**替代方案考虑**：
- **选项 A（硬编码列表）**：维护供应商能力白名单
  - 缺点：需要频繁更新、遗漏新供应商
- **选项 B（直接尝试）**：直接调用 count_tokens，捕获 404 错误
  - 缺点：网络开销、错误误判（可能 404 是临时错误）
- **选项 C（模型探测）**：通过 `/models` 端点检查
  - 优点：符合 OpenAI 标准模式、信息准确
  - 缺点：实现稍复杂（需要解析 models 响应）

**选择**：选项 C（模型探测）

### 决策 4：接口设计统一化

**返回格式设计**：所有转换器统一返回 `{ input_tokens, _method?, _fallback? }`

**理由**：
1. **一致性**：前端可以统一处理不同供应商的响应
2. **透明度**：`_method` 和 `_fallback` 字段提供计算方式信息
3. **向后兼容**：主字段 `input_tokens` 符合 Claude 标准
4. **可观测性**：便于调试和监控（统计不同方法使用率）

**字段说明**：
- `input_tokens`：Token 数量（主字段，必填）
- `_method`：`'tiktoken'`（上游 API）或 `'estimate'`（本地估算）
- `_fallback`：`true`（使用了降级）或 `undefined`（精确计算）
- `_cache_used`：可选，用于 Codex 转换器标记缓存命中

### 决策 5：复用 vs 新建的边界

**复用场景**：
- ✅ Gemini 转换器：完全不动，复用现有 `transformClaudeCountTokensToGemini`
- ✅ Anthropic 网关：透传逻辑，无需转换器

**新建场景**：
- ⭐ Codex 转换器：新建 `transformers/protocols/codex/count-tokens.ts`
- ⭐ Token 计算工具：新建 `utils/token-counter.ts`
- ⭐ 上游检测：新建 `utils/upstream-detector.ts`

**边界划分**：
- **通用层**：`token-counter.ts`、`upstream-detector.ts`（所有转换器共享）
- **协议层**：`codex/count-tokens.ts`（Codex 专用逻辑）
- **适配层**：`adapters/claude.ts`（网关适配）
- **路由层**：`gateway.ts`（端点路由）

## Risks / Trade-offs

### 风险 1：上游 API 探测失败

**描述**：供应商的 `/models` 端点可能不返回 count_tokens 能力信息，或者返回格式不标准

**影响**：Codex 转换器始终使用本地字节估算，失去精度

**缓解措施**：
1. 保守探测策略：捕获异常后自动 fallback 到本地估算
2. 可观测性：记录探测失败日志，便于后续优化
3. 配置开关：未来可通过环境变量禁用上游探测（如 `DISABLE_COUNT_TOKENS_DETECTION=1`）

### 风险 2：字节估算精度不足

**描述**：本地字节估算的精度低于 tiktoken，可能导致上下文窗口误判

**影响**：用户可能遇到上下文溢出或浪费预留空间

**缓解措施**：
1. 清晰标记：`_fallback: true` 让用户知道使用了降级
2. 文档说明：在 API 文档中说明不同方法的精度差异
3. 用户反馈：收集用户反馈，评估是否值得引入 tiktoken 依赖

### 风险 3：缓存一致性问题

**描述**：如果添加缓存机制，可能在内容相同但上游结果不同时导致不一致

**影响**：Token 计算结果可能在两次调用中不同，影响用户判断

**缓解措施**：
1. 缓存策略：仅对本地估算使用缓存（上游 API 调用不缓存）
2. 缓存键设计：包含完整请求内容（messages + system + tools）
3. 短期 TTL：5 分钟过期，避免长时间缓存过期内容
4. 可配置：未来可通过环境变量调整 TTL（如 `COUNT_TOKENS_CACHE_TTL`）

### 权衡 1：性能 vs 精度

**问题**：
- tiktoken 编码：精确但较慢（需要分词）
- 字节估算：快速但不精确（O(1) 复杂度）

**权衡决策**：采用优先级策略（上游 API > 本地估算）

**依据**：
1. 上游 API 调用虽然较慢，但只对首次调用影响
2. 缓存机制可以显著减少重复调用的延迟
3. 用户体验更重要：精确的 Token 计算能帮助用户更好地管理上下文

## Migration Plan

### 阶段 1：基础实现（1-2 天）

1. 创建工具层文件
   - `backend/src/promptxy/utils/upstream-detector.ts`
   - `backend/src/promptxy/utils/token-counter.ts`

2. 创建 Codex 转换器
   - `backend/src/promptxy/transformers/protocols/codex/count-tokens.ts`

3. 适配器扩展
   - `backend/src/promptxy/adapters/claude.ts`（添加 `handleClaudeCountTokens`）

4. 网关路由集成
   - `backend/src/promptxy/gateway.ts`（添加 `isCountTokensRequest` 和路由逻辑）

### 阶段 2：测试验证（1-2 天）

5. 单元测试
   - `backend/tests/utils/token-counter.test.ts`
   - `backend/tests/transformers/protocols/codex/count-tokens.test.ts`

6. 集成测试
   - `backend/tests/integration/count_tokens.test.ts`

7. LSP 诊断
   - 运行 `npx tsc --noEmit` 检查类型错误
   - 运行 ESLint 检查代码规范

### 阶段 3：文档和部署（1 天）

8. API 文档更新
   - `docs/api.md`（添加 `/v1/messages/count_tokens` 说明）

9. README 更新
   - 在项目 README 中说明新功能和使用示例

10. 部署验证
   - 在测试环境部署并验证功能
   - 监控日志确认无错误

### 回滚计划

如果部署后发现严重问题：

1. **立即回滚**：通过 Git revert 到上一个稳定版本
2. **修复后再部署**：修复问题后重新创建提案和实施
3. **灰度发布**：如果风险较高，考虑先部分用户可见

## Open Questions

1. **上游 API 探测优化**：
   - 是否需要维护一个已知的供应商能力白名单？
   - 是否需要支持自定义上游 count_tokens 端点 URL？

2. **缓存策略细化**：
   - 是否需要更复杂的 LRU 缓存实现（基于内存限制）？
   - 缓存 TTL 是否需要根据内容长度动态调整？

3. **精度监控**：
   - 是否需要收集不同计算方法的精度数据（与真实 Token 数量对比）？
   - 是否需要在响应中返回置信度指标？

4. **性能优化**：
   - 是否需要异步上游 API 调用（避免阻塞）？
   - 是否需要预加载编码器（tiktoken）以加速首次调用？
