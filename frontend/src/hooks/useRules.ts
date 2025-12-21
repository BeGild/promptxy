import { useQuery, useMutation, useQueryClient, useIsMutating } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useAppStore } from '@/store';
import {
  getRules,
  createRule,
  updateRule,
  deleteRule,
  batchUpdateRules,
  previewRule,
} from '@/api/rules';
import { PromptxyRule, PreviewRequest } from '@/types';

/**
 * 获取所有规则的 Hook - 优化版本
 * 使用 useMemo 优化返回值，避免不必要的对象重新创建
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

  // 使用 useMemo 优化返回值，避免每次渲染都创建新对象
  return useMemo(
    () => ({
      rules: query.data || [],
      isLoading: loading || query.isLoading,
      error: query.error,
      refetch: query.refetch,
    }),
    [query.data, loading, query.isLoading, query.error, query.refetch],
  );
}

/**
 * 保存规则的 Hook - 优化版本
 * 使用 useCallback 优化 mutation 函数
 */
export function useSaveRules() {
  const queryClient = useQueryClient();
  const saveRules = useAppStore(state => state.saveRules);

  const mutation = useMutation({
    mutationFn: async (rules: PromptxyRule[]) => {
      return await saveRules(rules);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  // 使用 useCallback 优化返回的 mutate 函数
  const mutate = useCallback(
    (rules: PromptxyRule[]) => {
      mutation.mutate(rules);
    },
    [mutation],
  );

  return {
    ...mutation,
    mutate,
  };
}

/**
 * 创建规则的 Hook - 优化版本
 */
export function useCreateRule() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (rule: PromptxyRule) => {
      return await createRule(rule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  const mutate = useCallback(
    (rule: PromptxyRule) => {
      mutation.mutate(rule);
    },
    [mutation],
  );

  return {
    ...mutation,
    mutate,
  };
}

/**
 * 更新规则的 Hook - 优化版本
 */
export function useUpdateRule() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (rule: PromptxyRule) => {
      return await updateRule(rule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  const mutate = useCallback(
    (rule: PromptxyRule) => {
      mutation.mutate(rule);
    },
    [mutation],
  );

  return {
    ...mutation,
    mutate,
  };
}

/**
 * 删除规则的 Hook - 优化版本
 */
export function useDeleteRule() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return await deleteRule(ruleId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  const mutate = useCallback(
    (ruleId: string) => {
      mutation.mutate(ruleId);
    },
    [mutation],
  );

  return {
    ...mutation,
    mutate,
  };
}

/**
 * 批量更新规则的 Hook - 优化版本
 */
export function useBatchUpdateRules() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (rules: PromptxyRule[]) => {
      return await batchUpdateRules(rules);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  const mutate = useCallback(
    (rules: PromptxyRule[]) => {
      mutation.mutate(rules);
    },
    [mutation],
  );

  return {
    ...mutation,
    mutate,
  };
}

/**
 * 预览规则效果的 Hook - 优化版本
 */
export function usePreviewRule() {
  const mutation = useMutation({
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

  const mutate = useCallback(
    (request: PreviewRequest) => {
      mutation.mutate(request);
    },
    [mutation],
  );

  return {
    ...mutation,
    mutate,
  };
}

/**
 * 获取单个规则的 Hook - 优化版本
 * 使用 useMemo 优化返回值
 */
export function useRule(ruleId: string | null) {
  const { rules, isLoading } = useRules();

  // 使用 useMemo 优化单个规则查找
  const rule = useMemo(() => {
    return rules.find(r => r.id === ruleId) || null;
  }, [rules, ruleId]);

  return useMemo(
    () => ({
      rule,
      isLoading,
    }),
    [rule, isLoading],
  );
}

/**
 * 使用增量API创建规则的 Hook - 优化版本
 * @deprecated 使用 useCreateRule 替代
 */
export function useCreateRuleIncremental() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (rule: PromptxyRule) => {
      return await createRule(rule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  const mutate = useCallback(
    (rule: PromptxyRule) => {
      mutation.mutate(rule);
    },
    [mutation],
  );

  return {
    ...mutation,
    mutate,
  };
}

/**
 * 使用增量API更新规则的 Hook - 优化版本
 * @deprecated 使用 useUpdateRule 替代
 */
export function useUpdateRuleIncremental() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (rule: PromptxyRule) => {
      return await updateRule(rule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  const mutate = useCallback(
    (rule: PromptxyRule) => {
      mutation.mutate(rule);
    },
    [mutation],
  );

  return {
    ...mutation,
    mutate,
  };
}

/**
 * 使用增量API删除规则的 Hook - 优化版本
 * @deprecated 使用 useDeleteRule 替代
 */
export function useDeleteRuleIncremental() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return await deleteRule(ruleId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  const mutate = useCallback(
    (ruleId: string) => {
      mutation.mutate(ruleId);
    },
    [mutation],
  );

  return {
    ...mutation,
    mutate,
  };
}
