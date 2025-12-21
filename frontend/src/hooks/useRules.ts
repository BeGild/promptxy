import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store';
import {
  getRules,
  syncRules,
  createRule,
  updateRule,
  deleteRule,
  batchUpdateRules,
  previewRule,
} from '@/api/rules';
import { PromptxyRule, PreviewRequest } from '@/types';

/**
 * 获取所有规则的 Hook
 */
export function useRules() {
  const loading = useAppStore(state => state.loading.rules);

  const query = useQuery({
    queryKey: ['rules'],
    queryFn: async () => {
      const rules = await getRules();
      return rules;
    },
    staleTime: 1000 * 60 * 5, // 5分钟
    refetchOnWindowFocus: false,
  });

  return {
    rules: query.data || [],
    isLoading: loading || query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 保存规则的 Hook
 */
export function useSaveRules() {
  const queryClient = useQueryClient();
  const saveRules = useAppStore(state => state.saveRules);

  return useMutation({
    mutationFn: async (rules: PromptxyRule[]) => {
      return await saveRules(rules);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });
}

/**
 * 创建规则的 Hook
 */
export function useCreateRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: PromptxyRule) => {
      return await createRule(rule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });
}

/**
 * 更新规则的 Hook
 */
export function useUpdateRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: PromptxyRule) => {
      return await updateRule(rule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });
}

/**
 * 删除规则的 Hook
 */
export function useDeleteRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ruleId: string) => {
      return await deleteRule(ruleId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });
}

/**
 * 批量更新规则的 Hook
 */
export function useBatchUpdateRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rules: PromptxyRule[]) => {
      return await batchUpdateRules(rules);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });
}

/**
 * 预览规则效果的 Hook
 */
export function usePreviewRule() {
  return useMutation({
    mutationFn: async (request: PreviewRequest) => {
      return await previewRule(
        request.body,
        request.client,
        request.field,
        request.model,
        request.path,
        request.method,
      );
    },
  });
}

/**
 * 获取单个规则的 Hook
 */
export function useRule(ruleId: string | null) {
  const { rules, isLoading } = useRules();

  const rule = rules.find(r => r.id === ruleId) || null;

  return {
    rule,
    isLoading,
  };
}

/**
 * 使用增量API创建规则的 Hook
 */
export function useCreateRuleIncremental() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: PromptxyRule) => {
      return await createRule(rule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });
}

/**
 * 使用增量API更新规则的 Hook
 */
export function useUpdateRuleIncremental() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: PromptxyRule) => {
      return await updateRule(rule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });
}

/**
 * 使用增量API删除规则的 Hook
 */
export function useDeleteRuleIncremental() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ruleId: string) => {
      return await deleteRule(ruleId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });
}
