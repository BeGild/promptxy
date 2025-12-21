import { applyPromptRules } from '../rules/engine.js';
import { PromptxyRule, PromptxyRuleMatch, PromptxyRequestContext } from '../types.js';

function extractModel(body: any): string | undefined {
  return typeof body?.model === 'string' ? body.model : undefined;
}

export function mutateCodexBody(options: {
  body: any;
  method: string;
  path: string;
  rules: PromptxyRule[];
}): { body: any; matches: PromptxyRuleMatch[]; warnings: string[] } {
  const { body, method, path, rules } = options;

  if (!body || typeof body !== 'object') return { body, matches: [], warnings: [] };
  if (typeof body.instructions !== 'string') return { body, matches: [], warnings: [] };

  const original = body.instructions;
  const model = extractModel(body);
  const ctx: PromptxyRequestContext = {
    client: 'codex',
    field: 'instructions',
    method,
    path,
    model,
  };

  const result = applyPromptRules(original, ctx, rules);
  const warnings: string[] = [];

  if (result.matches.length) {
    body.instructions = result.text;
  }

  // Safety: warn if the beginning of the instructions changed a lot.
  if (result.matches.length) {
    const guard = original.slice(0, 64);
    if (guard && !result.text.startsWith(guard)) {
      warnings.push('Codex instructions prefix changed (first 64 chars differ from original).');
    }
  }

  return { body, matches: result.matches, warnings };
}
