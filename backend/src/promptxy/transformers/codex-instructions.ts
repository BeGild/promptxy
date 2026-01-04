/**
 * Codex CLI instructions 模板
 *
 * 现状：
 * - 默认上游（AICODE Mirror 的 codex backend）会对 `instructions` 做严格校验。
 * - 简短的 instructions 会触发 `"Instructions are not valid"`。
 *
 * 策略（最小可行，优先可用性）：
 * - 从 `resources/` 目录下的“原生 /codex 请求日志”中提取一份 instructions 模板作为基线；
 * - 若模板不存在，则回退到一个最小 instructions（可能仍会被上游拒绝，但至少不崩溃）。
 *
 * 说明：
 * - 这不是最终形态；后续可将模板下沉到配置（supplier/route）或内置资源。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

let cachedTemplate: string | null = null;

function loadTemplateFromYaml(yamlPath: string): string | null {
  if (!fs.existsSync(yamlPath)) return null;
  const content = fs.readFileSync(yamlPath, 'utf-8');

  // 该 YAML 文件的 originalBody 是单行：originalBody: '{"model":...,"instructions":"..."}'
  const match = content.match(/^originalBody:\s*'(.*)'\s*$/m);
  if (!match) return null;

  // YAML 单引号内的转义规则：两个单引号表示一个单引号
  const jsonStr = match[1]!.replace(/''/g, "'");
  try {
    const obj = JSON.parse(jsonStr) as { instructions?: unknown };
    return typeof obj.instructions === 'string' ? obj.instructions : null;
  } catch {
    return null;
  }
}

function getTemplate(): string {
  if (cachedTemplate) return cachedTemplate;

  const configured = process.env.PROMPTXY_CODEX_INSTRUCTIONS_TEMPLATE_YAML;
  const defaultPath = path.resolve(process.cwd(), 'resources', '2026-01-04_21-46-07-226_mvcluq.yaml');

  const template =
    (configured ? loadTemplateFromYaml(configured) : null) ??
    loadTemplateFromYaml(defaultPath) ??
    null;

  cachedTemplate =
    template ??
    [
      'You are GPT-5.2 running in the Codex CLI, a terminal-based coding assistant.',
      'Codex CLI is an open source project led by OpenAI.',
      'You are expected to be precise, safe, and helpful.',
    ].join('\n');

  return cachedTemplate;
}

export function getCodexInstructions(prettyModel: string): string {
  const template = getTemplate();
  if (!prettyModel) return template;
  return template.replace(
    /^You are .*? running in the Codex CLI,/,
    `You are ${prettyModel} running in the Codex CLI,`,
  );
}

