/**
 * Claude count_tokens → Codex/OpenAI 转换器
 *
 * 支持上游 API + 本地 fallback 策略
 */

import type { ClaudeMessage, ClaudeContentBlock } from '../claude/types.js';
import { countClaudeTokens, type TokenCountResult } from '../../../utils/token-counter.js';
import type { UpstreamCapabilities } from '../../../utils/upstream-detector.js';

export interface CodexCountTokensResult extends TokenCountResult {}

export async function transformClaudeCountTokens(options: {
  messages: ClaudeMessage[];
  system?: string | ClaudeContentBlock[];
  tools?: unknown[];
  capabilities?: UpstreamCapabilities;
  baseUrl?: string;
  auth?: { type: 'bearer' | 'header'; token?: string; headerName?: string; headerValue?: string };
}): Promise<CodexCountTokensResult> {
  const { messages, system, tools, capabilities, baseUrl, auth } = options;

  const result = await countClaudeTokens({
    messages,
    system,
    tools,
    capabilities: capabilities
      ? {
          supportsCountTokens: capabilities.supportsCountTokens,
          countTokensEndpoint: capabilities.countTokensEndpoint,
        }
      : undefined,
    baseUrl,
    auth,
  });

  return result;
}
