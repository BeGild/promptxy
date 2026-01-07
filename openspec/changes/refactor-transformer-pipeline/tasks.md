# Tasks: 转换器重构（可审计流水线 + tool call 端到端闭环）

## 0. 规格对齐与验收基线（先定规则，再动代码）

- [x] 0.1 复核并冻结对齐文档（作为实现验收依据，不再"边写边改规格"）
  - `docs/transformers/transformer-refactor.md`
  - `docs/protocols/claude-messages-spec.md`
  - `docs/protocols/codex-responses-spec.md`
- [x] 0.2 明确 Open Questions 的决策（写入 `design.md` 的 Decision，或写成明确的 v1 fallback）
  - Claude SSE 的 `message_delta.delta.stop_reason`：使用 `end_turn`
  - `custom_tool_call` 的 Claude 侧 input 映射策略：包一层 object
  - FieldAudit 落库体积控制策略：完整保存
- [ ] 0.3 明确 v1 的"必须不破坏"行为（验收用例清单）
  - 文本 stream：Claude → Codex → Claude（纯文本增量）
  - tool loop：至少 1 次 tool_use/tool_result 往返可跑通
  - preview：能输出可读的 FieldAudit 摘要与可复制 JSON

## 1. 推倒重写（先删后写，避免历史负担）

- [x] 1.1（backend）盘点旧 transformers 对外 API 与调用点（作为新 public API 设计输入）
  - `createProtocolTransformer()` 的调用点（gateway/preview）
  - `createSSETransformStream()` 的调用点（gateway streaming pipe）
  - transformer registry / validate API（`/_promptxy/transformers*`）
- [x] 1.2（backend）删除旧 transformers 实现代码与隐式行为（不保留 fallback）
  - 删除 `backend/src/promptxy/transformers/*` 旧实现文件（llms-compat/sse/validation/registry 等）
  - 删除任何"旧实现兼容层"的隐式入口（避免 repo 内存在双轨路径）
- [x] 1.3（backend）按 `design.md` 重建新目录骨架并确保可编译
  - 新 `backend/src/promptxy/transformers/index.ts` 作为唯一 public API
  - 新 pipeline runner / audit / errors / protocol modules（先 stub，返回可定位的 not-implemented/validation error）
- [x] 1.4（backend）让网关与 preview 重新跑起来（即使功能未完整，也必须能给出可定位错误）
  - gateway 与 preview API 只依赖新 transformers public API
  - 任何 v1 未实现能力必须显式失败（避免 silent fallback）

## 2. Trace/Audit（字段级证据：少字段 error 的"证据链"）

- [x] 2.1（backend）定义 FieldAudit（JSON Pointer 路径标准）与最小收集器
  - `missingRequiredTargetPaths` / `extraTargetPaths` / `unmappedSourcePaths`
  - `defaulted[]`（path + source + reason）
  - `diffs`（JSON Patch 或等价结构；允许截断预览但不丢路径）
- [x] 2.2（backend）扩展 transform trace / preview 输出：携带 FieldAudit 摘要与关键 evidence
- [ ] 2.3（backend）落库：request history 保存 FieldAudit（不记录任何 plaintext secrets；必要时对 value 做截断）
- [ ] 2.4（frontend）Protocol Lab/preview UI 展示 FieldAudit 摘要（错误/警告/信息分级）

## 3. 请求转换：Claude → Codex（必须满足 call_id 对称闭环）

- [x] 3.1（backend）实现 `instructions = template + normalize(system)`（并记录 defaulted/mapped/unmapped）
- [x] 3.2（backend）实现 messages 映射：text blocks → `input[].type="message"`（与现有行为对齐）
- [x] 3.3（backend）实现 `tool_use` → `function_call`（`arguments` 必须为 JSON string）
- [x] 3.4（backend）实现 `tool_result` → `function_call_output`
  - v1 保守策略：非 string 的 content 统一 JSON.stringify
  - FieldAudit 记录 `outputWasStringified` 与原始路径
- [x] 3.5（backend）实现 call_id 配对与对称性校验（缺失/重复/孤儿 → error）
- [x] 3.6（backend）将校验失败映射为可定位的错误响应（错误类型 + missingPaths/invariant + stepName）

## 4. SSE 转换：Codex Responses SSE → Claude SSE（Claude Code 可消费）

- [x] 4.1（backend）实现 Codex Responses SSE 解析：以 `data.type` 分发（不依赖 `event:` 行）
- [x] 4.2（backend）实现最小状态机：text delta 与 tool call 并存，按 `item.type` 处理 output_item.done
- [x] 4.3（backend）实现 tool call SSE 映射：
  - `function_call/custom_tool_call` → `content_block_start` → `input_json_delta` → `content_block_stop` → `message_delta`
- [x] 4.4（backend）实现 stream 结束规则：
  - 以 `response.completed` 为优先结束信号
  - upstream 缺失 completed：补齐 `message_stop` 且 FieldAudit 标记 `missingUpstreamCompleted=true`
- [ ] 4.5（backend）补齐边界用例：多 tool call、文本与工具交错、异常中断等

## 5. UI：Protocol Lab 可验证输出（最小必要）

- [ ] 5.1（frontend）Trace 面板新增 FieldAudit 摘要区（missing/extra/unmapped/defaulted）
- [ ] 5.2（frontend）支持复制/导出 audit（JSON）

## 6. 测试与验证（减少“看起来能跑”的幻觉）

- [ ] 6.1（backend）新增 fixtures：至少 1 个“包含工具调用”的端到端样例（请求 + SSE 响应序列）
- [ ] 6.2（backend）单元测试：call_id 对称性校验、system 规范化、tool_result stringify 策略
- [ ] 6.3（backend）单元测试：SSE tool call 状态机（function_call → Claude tool_use 序列）
- [ ] 6.4（manual）集成验证：启动开发服务器 `./scripts/dev.sh &`，用 Protocol Lab 跑通 tool call 闭环；验证后关闭后台进程
- [ ] 6.5（manual）回归验收：
  - [ ] 6.5.1 纯文本流：输出连续、message_stop 正常
  - [ ] 6.5.2 tool loop：至少 1 次工具往返可跑通
  - [ ] 6.5.3 missing=error：缺 required/call_id 不对称时能得到可定位错误
  - [ ] 6.5.4 FieldAudit：UI 可见、可复制、落库可回放
