import { apiClient } from './client';
import { PromptxyRule, ConfigSyncResponse, RuleOperationResponse } from '@/types';

/**
 * 获取所有规则
 */
export async function getRules(): Promise<PromptxyRule[]> {
  const response = await apiClient.get('/_promptxy/config');
  return response.data.rules || [];
}

/**
 * 同步规则（保存）- 保留用于批量导入/导出场景
 */
export async function syncRules(rules: PromptxyRule[]): Promise<ConfigSyncResponse> {
  const response = await apiClient.post('/_promptxy/config/sync', { rules });
  return response.data;
}

/**
 * 创建规则 - 增量API
 */
export async function createRule(rule: PromptxyRule): Promise<RuleOperationResponse> {
  const response = await apiClient.post('/_promptxy/rules', { rule });
  return response.data;
}

/**
 * 更新规则 - 增量API
 */
export async function updateRule(rule: PromptxyRule): Promise<RuleOperationResponse> {
  const response = await apiClient.put(`/_promptxy/rules/${rule.uuid}`, { rule });
  return response.data;
}

/**
 * 删除规则 - 增量API
 */
export async function deleteRule(ruleId: string): Promise<RuleOperationResponse> {
  const response = await apiClient.delete(`/_promptxy/rules/${ruleId}`);
  return response.data;
}

/**
 * 批量更新规则 - 保留用于批量操作
 */
export async function batchUpdateRules(rules: PromptxyRule[]): Promise<ConfigSyncResponse> {
  return syncRules(rules);
}

/**
 * 预览规则效果
 */
export async function previewRule(
  body: any,
  client: string,
  field: string,
  model?: string,
  path?: string,
  method?: string,
) {
  const response = await apiClient.post('/_promptxy/preview', {
    body,
    client,
    field,
    model,
    path,
    method,
  });
  return response.data;
}
