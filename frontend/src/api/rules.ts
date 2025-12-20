import { apiClient } from "./client";
import { PromptxyRule, ConfigSyncResponse } from "@/types";

/**
 * 获取所有规则
 */
export async function getRules(): Promise<PromptxyRule[]> {
  const response = await apiClient.get("/_promptxy/config");
  return response.data.rules || [];
}

/**
 * 同步规则（保存）
 */
export async function syncRules(rules: PromptxyRule[]): Promise<ConfigSyncResponse> {
  const response = await apiClient.post("/_promptxy/config/sync", { rules });
  return response.data;
}

/**
 * 创建规则
 */
export async function createRule(rule: PromptxyRule): Promise<ConfigSyncResponse> {
  const rules = await getRules();
  rules.push(rule);
  return syncRules(rules);
}

/**
 * 更新规则
 */
export async function updateRule(rule: PromptxyRule): Promise<ConfigSyncResponse> {
  const rules = await getRules();
  const index = rules.findIndex((r) => r.id === rule.id);
  if (index === -1) {
    throw new Error("Rule not found");
  }
  rules[index] = rule;
  return syncRules(rules);
}

/**
 * 删除规则
 */
export async function deleteRule(ruleId: string): Promise<ConfigSyncResponse> {
  const rules = await getRules();
  const filtered = rules.filter((r) => r.id !== ruleId);
  return syncRules(filtered);
}

/**
 * 批量更新规则
 */
export async function batchUpdateRules(rules: PromptxyRule[]): Promise<ConfigSyncResponse> {
  return syncRules(rules);
}

/**
 * 预览规则效果
 */
export async function previewRule(body: any, client: string, field: string, model?: string, path?: string, method?: string) {
  const response = await apiClient.post("/_promptxy/preview", {
    body,
    client,
    field,
    model,
    path,
    method,
  });
  return response.data;
}
