/**
 * Codex instructions selection (Codex CLI compatible)
 *
 * Goal:
 * - Prefer Codex (codex-rs) prompt templates, chosen based on model name.
 * - Optionally switch to "opencode" instructions based on user-agent (CLIProxyAPI behavior).
 *
 * Reference:
 * - codex-rs core prompt templates: refence/codex/codex-rs/core/*.md
 * - CLIProxyAPI selection logic: refence/CLIProxyAPI/internal/misc/codex_instructions.go
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const USER_AGENT_OPENAI_SDK = 'ai-sdk/openai/';

function loadTemplate(fileName: string): string {
  return readFileSync(join(__dirname, 'templates', fileName), 'utf-8');
}

// Keep these filenames aligned with codex-rs core.
const T_PROMPT_DEFAULT = 'prompt.md';
const T_GPT5_CODEX = 'gpt_5_codex_prompt.md';
const T_GPT51 = 'gpt_5_1_prompt.md';
const T_GPT52 = 'gpt_5_2_prompt.md';
const T_GPT52_CODEX = 'gpt-5.2-codex_prompt.md';
const T_GPT51_CODEX_MAX = 'gpt-5.1-codex-max_prompt.md';

const T_OPENCODE = 'opencode_codex_instructions.txt';

function isOpenCodeUserAgent(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  return userAgent.toLowerCase().includes(USER_AGENT_OPENAI_SDK);
}

export function selectCodexInstructions(options: {
  modelName: string;
  /**
   * Existing system/instructions text (if the caller already provides something).
   * If it already starts with the selected template, we return "" (avoid duplication),
   * matching CLIProxyAPI behavior.
   */
  systemInstructions?: string;
  userAgent?: string;
  enabled: boolean;
}): { hasOfficialInstructions: boolean; instructions: string } {
  if (!options.enabled) {
    return { hasOfficialInstructions: true, instructions: '' };
  }

  const modelName = options.modelName || '';
  const systemInstructions = options.systemInstructions || '';
  const userAgent = options.userAgent || '';

  // CLIProxyAPI behavior: if UA indicates OpenAI SDK, switch to OpenCode instructions.
  if (isOpenCodeUserAgent(userAgent)) {
    const prompt = loadTemplate(T_OPENCODE);
    if (prompt && systemInstructions.startsWith(prompt)) {
      return { hasOfficialInstructions: true, instructions: '' };
    }
    return { hasOfficialInstructions: false, instructions: prompt };
  }

  let templateName = T_PROMPT_DEFAULT;
  if (modelName.includes('codex-max')) {
    templateName = T_GPT51_CODEX_MAX;
  } else if (modelName.includes('5.2-codex')) {
    templateName = T_GPT52_CODEX;
  } else if (modelName.includes('codex')) {
    templateName = T_GPT5_CODEX;
  } else if (modelName.includes('5.1')) {
    templateName = T_GPT51;
  } else if (modelName.includes('5.2')) {
    templateName = T_GPT52;
  }

  const prompt = loadTemplate(templateName);
  if (prompt && systemInstructions.startsWith(prompt)) {
    return { hasOfficialInstructions: true, instructions: '' };
  }

  return { hasOfficialInstructions: false, instructions: prompt };
}

