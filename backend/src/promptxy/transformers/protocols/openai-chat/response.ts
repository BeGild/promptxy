/**
 * OpenAI Chat Completions → Claude 响应转换
 *
 * OpenAI Chat Completions 响应格式与 Codex 使用相同的基本结构（choices[0].message）。
 * 复用 codex/response.ts 的转换逻辑。
 */

export { transformCodexResponseToClaude as transformOpenAIChatResponseToClaude } from '../codex/response.js';
