# Tasks: 协议转换（Claude Code 统一入口 → 单上游）与可验证预览/Trace

## 0. 提案对齐与回归基线

- [x] 0.1 确认 v1 边界：单 `localPrefix` ⇄ 单 supplier；不引入 Router
- [x] 0.2 确认 v1 必须支持的上游集合（至少 1 个 OpenAI compatible + 可选 Gemini）
- [ ] 0.3 基于 `docs/protocol-transformation-research.md` 的 8.5 样例整理测试 fixture（脱敏/截断）

## 1. 后端：协议转换与鉴权

- [x] 1.1 供应商配置扩展：新增 `supplier.transformer`（default + models exact match）与 `supplier.auth`
- [x] 1.2 网关入站鉴权：新增 `gatewayAuth`，支持从 `acceptedHeaders` 指定的 header 中读取 token 并校验
- [x] 1.3 确保入站鉴权 header 在转发前被清理（避免误传到上游）
- [ ] 1.3.1 增加"header 观测"诊断输出：在 transform trace 中返回 `authHeaderUsed`（仅 header 名称，永不包含值），用于在运行 `cc_lo -p "<提示词>"` 时确认 Claude Code 使用的鉴权头名
- [x] 1.4 接入 `@musistudio/llms`：实现最薄封装的 transformer registry / pipeline（含可用性校验）
- [x] 1.5 在网关请求管线中插入协议转换：rules 之后、fetch 之前（与研究文档一致）
- [x] 1.6 上游鉴权注入：当 `supplier.auth` 存在时注入/覆盖上游认证；并禁止透传入站凭证到上游
- [x] 1.7 响应转换：非流式响应可正确转换回 Anthropic
- [ ] 1.8 流式（SSE）转换：当请求/上游为流式时，支持"解析 → 转换 → 序列化 → 输出"，避免全量缓冲
- [x] 1.9 统一脱敏与安全输出：日志/历史/preview/trace 均不得包含明文 token

## 2. 后端：可验证 Preview + Trace API

- [x] 2.1 定义 `transformPreview` 输出结构（上游 method/path/headers/body，默认脱敏）
- [x] 2.2 定义 `transformTrace` 输出结构（命中 supplier、命中链、步骤列表、warnings/errors、耗时）
- [x] 2.3 实现预览 API：输入示例请求（Anthropic）→ 输出 rules 后请求 + 上游预览 + trace
- [x] 2.4 实现诊断能力：能在转换失败时返回"可定位"的失败步骤与原因

## 3. 前端：协议转换实验室（工作台）

- [x] 3.1 增加协议转换实验室页面：供应商选择、模型选择（用于触发 model override）
- [x] 3.2 示例请求编辑器：支持 fixture 选择、JSON 编辑、stream on/off
- [x] 3.3 上游请求预览：展示脱敏后的 headers/body，并支持一键复制（JSON / cURL）
- [x] 3.4 Trace 面板：展示链选择、步骤摘要、warnings/errors，并支持复制 trace
- [x] 3.5 在 supplier 配置页提供入口（或跳转）到实验室页面

## 4. 测试与验证

- [ ] 4.1 单元测试：链选择（default vs model override）、配置校验、脱敏策略
- [ ] 4.2 集成测试：Anthropic ↔ OpenAI compatible（含 tools、streaming）
- [ ] 4.3 回归测试：确保未启用 transformer 的 supplier 仍保持现有转发行为

## 5. 文档与迁移

- [x] 5.1 更新用户文档：解释 gatewayAuth 与 supplier.auth 的区别；修正"不存储密钥"的旧表述
- [x] 5.2 更新安全说明：哪些内容会记录到本地、如何脱敏、如何避免泄漏
- [x] 5.3 提供最小可用配置示例（Claude Code → OpenAI compatible 单上游）

