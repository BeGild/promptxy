import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useMemo } from 'react';
import { PromptxyRule, RequestListItem, SSEConnectionStatus } from '@/types';
import { getRules, syncRules } from '@/api/rules';
import { getRequests, getStats } from '@/api/requests';
import { checkHealth } from '@/api/client';

interface AppState {
  // 数据状态
  rules: PromptxyRule[];
  requests: RequestListItem[];
  stats: any;

  // 加载状态
  loading: {
    rules: boolean;
    requests: boolean;
    stats: boolean;
    saving: boolean;
  };

  // 错误状态
  errors: {
    rules: string | null;
    requests: string | null;
    stats: string | null;
    save: string | null;
  };

  // 连接状态
  sseStatus: SSEConnectionStatus;
  apiConnected: boolean;

  // 分页
  requestPage: number;
  requestTotal: number;

  // 操作
  loadRules: () => Promise<void>;
  saveRules: (rules: PromptxyRule[]) => Promise<void>;
  loadRequests: (page?: number) => Promise<void>;
  loadStats: () => Promise<void>;
  checkConnection: () => Promise<void>;
  setSSEStatus: (status: SSEConnectionStatus) => void;
  addNewRequest: (request: RequestListItem) => void;
  clearErrors: () => void;
  reset: () => void;
}

export const useAppStore = create<AppState>()(
  devtools((set, get) => ({
    // 初始状态
    rules: [],
    requests: [],
    stats: null,

    loading: {
      rules: false,
      requests: false,
      stats: false,
      saving: false,
    },

    errors: {
      rules: null,
      requests: null,
      stats: null,
      save: null,
    },

    sseStatus: { connected: false, lastEvent: null, error: null },
    apiConnected: false,

    requestPage: 1,
    requestTotal: 0,

    // 加载规则
    loadRules: async () => {
      set(state => ({ loading: { ...state.loading, rules: true } }));
      try {
        const rules = await getRules();
        set({ rules, errors: { ...get().errors, rules: null } });
      } catch (error: any) {
        set({ errors: { ...get().errors, rules: error.message } });
      } finally {
        set(state => ({ loading: { ...state.loading, rules: false } }));
      }
    },

    // 保存规则
    saveRules: async (rules: PromptxyRule[]) => {
      set(state => ({ loading: { ...state.loading, saving: true } }));
      try {
        await syncRules(rules);
        set({
          rules,
          errors: { ...get().errors, save: null },
        });
      } catch (error: any) {
        set({ errors: { ...get().errors, save: error.message } });
        throw error;
      } finally {
        set(state => ({ loading: { ...state.loading, saving: false } }));
      }
    },

    // 加载请求列表
    loadRequests: async (page = 1) => {
      set(state => ({ loading: { ...state.loading, requests: true } }));
      try {
        const result = await getRequests({}, page, 50);
        set({
          requests: result.items,
          requestPage: page,
          requestTotal: result.total,
          errors: { ...get().errors, requests: null },
        });
      } catch (error: any) {
        set({ errors: { ...get().errors, requests: error.message } });
      } finally {
        set(state => ({ loading: { ...state.loading, requests: false } }));
      }
    },

    // 加载统计
    loadStats: async () => {
      set(state => ({ loading: { ...state.loading, stats: true } }));
      try {
        const stats = await getStats();
        set({ stats, errors: { ...get().errors, stats: null } });
      } catch (error: any) {
        set({ errors: { ...get().errors, stats: error.message } });
      } finally {
        set(state => ({ loading: { ...state.loading, stats: false } }));
      }
    },

    // 检查连接
    checkConnection: async () => {
      const connected = await checkHealth();
      set({ apiConnected: connected });
    },

    // 设置 SSE 状态
    setSSEStatus: (status: SSEConnectionStatus) => {
      set({ sseStatus: status });
    },

    // 添加新请求（来自 SSE）
    addNewRequest: (request: RequestListItem) => {
      set(state => ({
        requests: [request, ...state.requests].slice(0, 50),
        requestTotal: state.requestTotal + 1,
      }));
    },

    // 清除错误
    clearErrors: () => {
      set({
        errors: {
          rules: null,
          requests: null,
          stats: null,
          save: null,
        },
      });
    },

    // 重置
    reset: () => {
      set({
        rules: [],
        requests: [],
        stats: null,
        loading: {
          rules: false,
          requests: false,
          stats: false,
          saving: false,
        },
        errors: {
          rules: null,
          requests: null,
          stats: null,
          save: null,
        },
        requestPage: 1,
        requestTotal: 0,
      });
    },
  })),
);

/**
 * 优化的 Memoized 选择器 - 避免不必要的重新渲染
 * 使用 useMemo 缓存计算结果，只有当依赖项变化时才重新计算
 */

/**
 * 获取规则列表的 Memoized 选择器
 * 只有当 rules 数组变化时才会触发重新渲染
 */
export const useRulesSelector = () => {
  const rules = useAppStore(state => state.rules);
  const loading = useAppStore(state => state.loading.rules);
  const error = useAppStore(state => state.errors.rules);

  return useMemo(
    () => ({
      rules,
      isLoading: loading,
      error,
    }),
    [rules, loading, error],
  );
};

/**
 * 获取请求列表的 Memoized 选择器
 * 只有当 requests 数组或分页状态变化时才会触发重新渲染
 */
export const useRequestsSelector = () => {
  const requests = useAppStore(state => state.requests);
  const loading = useAppStore(state => state.loading.requests);
  const error = useAppStore(state => state.errors.requests);
  const page = useAppStore(state => state.requestPage);
  const total = useAppStore(state => state.requestTotal);

  return useMemo(
    () => ({
      requests,
      isLoading: loading,
      error,
      page,
      total,
    }),
    [requests, loading, error, page, total],
  );
};

/**
 * 获取统计信息的 Memoized 选择器
 * 只有当 stats 数据变化时才会触发重新渲染
 */
export const useStatsSelector = () => {
  const stats = useAppStore(state => state.stats);
  const loading = useAppStore(state => state.loading.stats);
  const error = useAppStore(state => state.errors.stats);

  return useMemo(
    () => ({
      stats,
      isLoading: loading,
      error,
    }),
    [stats, loading, error],
  );
};

/**
 * 获取 SSE 状态的 Memoized 选择器
 * 只有当 SSE 状态变化时才会触发重新渲染
 */
export const useSSEStatusSelector = () => {
  const sseStatus = useAppStore(state => state.sseStatus);
  const apiConnected = useAppStore(state => state.apiConnected);

  return useMemo(
    () => ({
      sseStatus,
      apiConnected,
    }),
    [sseStatus, apiConnected],
  );
};

/**
 * 获取加载状态的 Memoized 选择器
 * 只有当加载状态变化时才会触发重新渲染
 */
export const useLoadingSelector = () => {
  const loading = useAppStore(state => state.loading);

  return useMemo(
    () => ({
      ...loading,
    }),
    [loading],
  );
};

/**
 * 获取错误状态的 Memoized 选择器
 * 只有当错误状态变化时才会触发重新渲染
 */
export const useErrorSelector = () => {
  const errors = useAppStore(state => state.errors);

  return useMemo(
    () => ({
      ...errors,
    }),
    [errors],
  );
};
