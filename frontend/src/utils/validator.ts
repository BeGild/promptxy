import { PromptxyRule, PromptxyOp } from '@/types';

interface RuleValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 验证规则格式
 */
export function validateRule(rule: PromptxyRule): RuleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 基本字段验证
  if (!rule.id || typeof rule.id !== 'string') {
    errors.push('规则ID是必需的');
  }

  if (!rule.when) {
    errors.push('when 条件是必需的');
  } else {
    if (!rule.when.client) {
      errors.push('客户端类型是必需的');
    }
    if (!rule.when.field) {
      errors.push('字段类型是必需的');
    }
  }

  if (!rule.ops || !Array.isArray(rule.ops) || rule.ops.length === 0) {
    errors.push('操作序列不能为空');
  } else {
    // 验证每个操作
    for (let i = 0; i < rule.ops.length; i++) {
      const op = rule.ops[i];
      const opErrors = validateOp(op);
      if (opErrors.length > 0) {
        errors.push(`操作 ${i + 1}: ${opErrors.join(', ')}`);
      }
    }
  }

  // 警告
  if (rule.enabled === undefined) {
    warnings.push('未指定启用状态，默认启用');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 验证单个操作
 */
function validateOp(op: PromptxyOp): string[] {
  const errors: string[] = [];

  if (!op || typeof op !== 'object') {
    return ['操作格式无效'];
  }

  const type = (op as any).type;
  if (!type) {
    return ['缺少操作类型'];
  }

  switch (type) {
    case 'set':
    case 'append':
    case 'prepend':
      if (!('text' in op) || typeof op.text !== 'string') {
        errors.push('需要 text 字段');
      }
      break;

    case 'replace':
      if (!('match' in op || 'regex' in op)) {
        errors.push('需要 match 或 regex');
      }
      if (!('replacement' in op)) {
        errors.push('需要 replacement');
      }
      break;

    case 'delete':
      if (!('match' in op || 'regex' in op)) {
        errors.push('需要 match 或 regex');
      }
      break;

    case 'insert_before':
    case 'insert_after':
      if (!('regex' in op) || typeof (op as any).regex !== 'string') {
        errors.push('需要 regex');
      }
      if (!('text' in op) || typeof (op as any).text !== 'string') {
        errors.push('需要 text');
      }
      break;

    default:
      errors.push(`不支持的操作类型: ${type}`);
  }

  // 验证正则语法
  if ('regex' in op && op.regex) {
    try {
      new RegExp(op.regex, (op as any).flags);
    } catch (e: any) {
      errors.push(`正则表达式无效: ${e.message}`);
    }
  }

  return errors;
}

/**
 * 验证正则表达式
 */
export function validateRegex(pattern: string, flags?: string): { valid: boolean; error?: string } {
  try {
    new RegExp(pattern, flags);
    return { valid: true };
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
}

/**
 * 检查规则冲突
 */
export function checkRuleConflicts(rules: PromptxyRule[], newRule: PromptxyRule): string[] {
  const conflicts: string[] = [];

  for (const rule of rules) {
    if (rule.id === newRule.id) continue; // 跳过自身

    // 检查条件是否完全相同
    const sameConditions =
      rule.when.client === newRule.when.client &&
      rule.when.field === newRule.when.field &&
      rule.when.method === newRule.when.method &&
      rule.when.pathRegex === newRule.when.pathRegex &&
      rule.when.modelRegex === newRule.when.modelRegex;

    if (sameConditions) {
      conflicts.push(`与规则 ${rule.id} 的条件相同`);
    }
  }

  return conflicts;
}

/**
 * 生成默认规则
 */
export function createDefaultRule(): PromptxyRule {
  return {
    id: `rule-${Date.now()}`,
    description: '',
    when: {
      client: 'claude',
      field: 'system',
    },
    ops: [{ type: 'append', text: '\n\n' }],
    enabled: true,
  };
}
