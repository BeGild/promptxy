import {
  PromptxyRequestContext,
  PromptxyRule,
  PromptxyRuleApplyResult,
  PromptxyRuleMatch,
} from "../types.js";

function compileRegex(pattern: string, flags: string | undefined, label: string): RegExp {
  try {
    return new RegExp(pattern, flags);
  } catch (error: any) {
    throw new Error(`${label}: invalid regex (${pattern}/${flags ?? ""}): ${error?.message ?? error}`);
  }
}

function matchesRule(rule: PromptxyRule, ctx: PromptxyRequestContext): boolean {
  if (rule.when.client !== ctx.client) return false;
  if (rule.when.field !== ctx.field) return false;

  if (rule.when.method) {
    if (rule.when.method.toUpperCase() !== ctx.method.toUpperCase()) return false;
  }

  if (rule.when.pathRegex) {
    const re = compileRegex(rule.when.pathRegex, undefined, `rule(${rule.id}).when.pathRegex`);
    if (!re.test(ctx.path)) return false;
  }

  if (rule.when.modelRegex) {
    if (!ctx.model) return false;
    const re = compileRegex(rule.when.modelRegex, undefined, `rule(${rule.id}).when.modelRegex`);
    if (!re.test(ctx.model)) return false;
  }

  return true;
}

export function applyPromptRules(
  inputText: string,
  ctx: PromptxyRequestContext,
  rules: PromptxyRule[]
): PromptxyRuleApplyResult {
  let text = inputText;
  const matches: PromptxyRuleMatch[] = [];

  for (const rule of rules) {
    // 跳过禁用的规则
    if (rule.enabled === false) continue;

    if (!matchesRule(rule, ctx)) continue;

    for (const op of rule.ops) {
      switch (op.type) {
        case "set": {
          text = op.text;
          matches.push({ ruleId: rule.id, opType: op.type });
          break;
        }
        case "append": {
          text = text + op.text;
          matches.push({ ruleId: rule.id, opType: op.type });
          break;
        }
        case "prepend": {
          text = op.text + text;
          matches.push({ ruleId: rule.id, opType: op.type });
          break;
        }
        case "replace": {
          if (op.match !== undefined) {
            if (op.match === "") {
              throw new Error(`rule(${rule.id}).op(replace): match must not be empty`);
            }
            text = text.split(op.match).join(op.replacement);
            matches.push({ ruleId: rule.id, opType: op.type });
            break;
          }
          if (op.regex !== undefined) {
            const re = compileRegex(op.regex, op.flags, `rule(${rule.id}).op(replace).regex`);
            text = text.replace(re, op.replacement);
            matches.push({ ruleId: rule.id, opType: op.type });
            break;
          }
          throw new Error(`rule(${rule.id}).op(replace): must provide match or regex`);
        }
        case "delete": {
          if (op.match !== undefined) {
            if (op.match === "") {
              throw new Error(`rule(${rule.id}).op(delete): match must not be empty`);
            }
            text = text.split(op.match).join("");
            matches.push({ ruleId: rule.id, opType: op.type });
            break;
          }
          if (op.regex !== undefined) {
            const re = compileRegex(op.regex, op.flags, `rule(${rule.id}).op(delete).regex`);
            text = text.replace(re, "");
            matches.push({ ruleId: rule.id, opType: op.type });
            break;
          }
          throw new Error(`rule(${rule.id}).op(delete): must provide match or regex`);
        }
        case "insert_before": {
          const re = compileRegex(op.regex, op.flags, `rule(${rule.id}).op(insert_before).regex`);
          text = text.replace(re, (match) => `${op.text}${match}`);
          matches.push({ ruleId: rule.id, opType: op.type });
          break;
        }
        case "insert_after": {
          const re = compileRegex(op.regex, op.flags, `rule(${rule.id}).op(insert_after).regex`);
          text = text.replace(re, (match) => `${match}${op.text}`);
          matches.push({ ruleId: rule.id, opType: op.type });
          break;
        }
        default: {
          const exhaustive: never = op;
          throw new Error(`Unsupported op: ${JSON.stringify(exhaustive)}`);
        }
      }
    }

    if (rule.stop) break;
  }

  return { text, matches };
}
