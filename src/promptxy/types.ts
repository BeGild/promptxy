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
  when: PromptxyRuleWhen;
  ops: PromptxyOp[];
  stop?: boolean;
};

export type PromptxyConfig = {
  listen: {
    host: string;
    port: number;
  };
  upstreams: {
    anthropic: string;
    openai: string;
    gemini: string;
  };
  rules: PromptxyRule[];
  debug: boolean;
};

export type PromptxyRequestContext = {
  client: PromptxyClient;
  field: PromptxyField;
  method: string;
  path: string;
  model?: string;
};

export type PromptxyRuleMatch = {
  ruleId: string;
  opType: PromptxyOpType;
};

export type PromptxyRuleApplyResult = {
  text: string;
  matches: PromptxyRuleMatch[];
};
