import { applyPromptRules } from '../rules/engine.js';
import { PromptxyRule, PromptxyRuleMatch, PromptxyRequestContext } from '../types.js';

type GeminiPartsContainer = {
  parts?: unknown;
  [key: string]: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function extractModelFromPath(pathname: string): string | undefined {
  const marker = '/models/';
  const idx = pathname.indexOf(marker);
  if (idx === -1) return undefined;
  const after = pathname.slice(idx + marker.length);
  const end = after.indexOf(':');
  if (end === -1) return after || undefined;
  return after.slice(0, end) || undefined;
}

function coerceGeminiSystemText(
  value: unknown,
): { text: string; writer: (newText: string) => any } | null {
  if (typeof value === 'string') {
    return {
      text: value,
      writer: newText => newText,
    };
  }

  if (isObject(value)) {
    const parts = (value as GeminiPartsContainer).parts;
    if (Array.isArray(parts)) {
      const texts: string[] = [];
      for (const part of parts) {
        if (!isObject(part)) continue;
        const t = part.text;
        if (typeof t === 'string') texts.push(t);
      }
      const joined = texts.join('');
      return {
        text: joined,
        writer: newText => ({
          ...value,
          parts: [{ text: newText }],
        }),
      };
    }
  }

  return null;
}

export function mutateGeminiBody(options: {
  body: any;
  method: string;
  path: string;
  rules: PromptxyRule[];
}): { body: any; matches: PromptxyRuleMatch[] } {
  const { body, method, path, rules } = options;

  if (!body || typeof body !== 'object') return { body, matches: [] };

  const model =
    extractModelFromPath(path) ?? (typeof body.model === 'string' ? body.model : undefined);
  const ctxBase: Omit<PromptxyRequestContext, 'field'> = {
    client: 'gemini',
    method,
    path,
    model,
  };

  const candidates: Array<{
    key: 'system_instruction' | 'systemInstruction';
    value: unknown;
  }> = [
    { key: 'system_instruction', value: (body as any).system_instruction },
    { key: 'systemInstruction', value: (body as any).systemInstruction },
  ];

  for (const candidate of candidates) {
    if (candidate.value === undefined || candidate.value === null) continue;

    const extracted = coerceGeminiSystemText(candidate.value);
    if (!extracted) continue;

    const result = applyPromptRules(extracted.text, { ...ctxBase, field: 'system' }, rules);
    if (!result.matches.length) continue;

    (body as any)[candidate.key] = extracted.writer(result.text);
    return { body, matches: result.matches };
  }

  return { body, matches: [] };
}
