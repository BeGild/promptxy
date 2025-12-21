/**
 * 规则相关类型定义
 */

export type PromptxyClient = 'claude' | 'codex' | 'gemini';
export type PromptxyField = 'system' | 'instructions';

export type PromptxyOpType =
  | 'set'
  | 'append'
  | 'prepend'
  | 'replace'
  | 'delete'
  | 'insert_before'
  | 'insert_after';

export type PromptxyOp =
  | { type: 'set'; text: string }
  | { type: 'append'; text: string }
  | { type: 'prepend'; text: string }
  | {
      type: 'replace';
      match?: string;
      regex?: string;
      flags?: string;
      replacement: string;
    }
  | { type: 'delete'; match?: string; regex?: string; flags?: string }
  | { type: 'insert_before'; regex: string; flags?: string; text: string }
  | { type: 'insert_after'; regex: string; flags?: string; text: string };

export type PromptxyRuleWhen = {
  client: PromptxyClient;
  field: PromptxyField;
  method?: string;
  pathRegex?: string;
  modelRegex?: string;
};

export type PromptxyRule = {
  id: string;
  description?: string;
  when: PromptxyRuleWhen;
  ops: PromptxyOp[];
  stop?: boolean;
  enabled?: boolean;
  createdAt?: number;
  updatedAt?: number;
};

// 用于表单的规则类型（添加临时字段）
export interface RuleFormData extends Omit<PromptxyRule, 'createdAt' | 'updatedAt'> {
  isNew: boolean;
}
