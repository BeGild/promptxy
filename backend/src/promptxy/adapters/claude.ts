import { applyPromptRules } from '../rules/engine.js';
import { PromptxyRule, PromptxyRuleMatch, PromptxyRequestContext, SupplierAuth } from '../types.js';
import { countClaudeTokens } from '../utils/token-counter.js';
import type { TokenCountResult } from '../utils/token-counter.js';

type ClaudeSystemTextBlock = {
  type?: string;
  text?: unknown;
  [key: string]: unknown;
};

function extractModel(body: any): string | undefined {
  return typeof body?.model === 'string' ? body.model : undefined;
}

function coerceText(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
    return value.join('');
  }
  return undefined;
}

export function mutateClaudeBody(options: {
  body: any;
  method: string;
  path: string;
  rules: PromptxyRule[];
}): { body: any; matches: PromptxyRuleMatch[] } {
  const { body, method, path, rules } = options;

  if (!body || typeof body !== 'object') return { body, matches: [] };
  if (body.system === undefined || body.system === null) return { body, matches: [] };

  const model = extractModel(body);
  const ctx: Omit<PromptxyRequestContext, 'field'> = {
    client: 'claude',
    method,
    path,
    model,
  };

  const matches: PromptxyRuleMatch[] = [];

  if (typeof body.system === 'string') {
    const result = applyPromptRules(body.system, { ...ctx, field: 'system' }, rules);
    if (result.matches.length) {
      body.system = result.text;
      matches.push(...result.matches);
    }
    return { body, matches };
  }

  if (Array.isArray(body.system)) {
    const blocks = body.system as ClaudeSystemTextBlock[];
    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue;
      if (block.type !== 'text') continue;

      const text = coerceText(block.text);
      if (text === undefined) continue;

      const result = applyPromptRules(text, { ...ctx, field: 'system' }, rules);
      if (!result.matches.length) continue;

      block.text = result.text;
      matches.push(...result.matches);
    }
    return { body, matches };
  }

  return { body, matches: [] };
}

export async function handleClaudeCountTokens(options: {
  body: any;
  capabilities?: { supportsCountTokens: boolean; countTokensEndpoint?: string };
  baseUrl?: string;
  auth?: SupplierAuth;
}): Promise<TokenCountResult> {
  const { body, capabilities, baseUrl, auth } = options;

  if (!body || typeof body !== 'object') {
    throw new Error('Invalid request body');
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw new Error('messages is required and must be a non-empty array');
  }

  const messages = body.messages;
  const system = body.system;
  const tools = body.tools;

  const result = await countClaudeTokens({
    messages,
    system,
    tools,
    capabilities,
    baseUrl,
    auth,
  });

  return result;
}
