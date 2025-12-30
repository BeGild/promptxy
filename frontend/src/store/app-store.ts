import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
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
  immer(
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

      // 添加新请求（来自 SSE）- 使用 immer 优化，避免创建新数组
      addNewRequest: (request: RequestListItem) => {
        set((state: AppState) => {
          // 使用 immer 的 draft 模式，直接修改状态
          state.requests.unshift(request);
          // 保持最多 50 条记录
          if (state.requests.length > 50) {
            state.requests.length = 50;
          }
          state.requestTotal += 1;
        });
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
  ),
);

/**
 * 优化的选择器 - 直接使用 Zustand 的选择器
 *
 * Zustand 已经提供了状态订阅和浅比较优化，
 * 额外的 useMemo 反而会增加开销且没有收益。
 *
 * 使用方式：
 * - 单个状态：useAppStore(state => state.rules)
 * - 多个状态：useAppStore(state => ({ rules: state.rules, loading: state.loading }))
 */

/**
 * 获取规则列表的选择器
 */
export const useRulesSelector = () =>
  useAppStore(state => ({
    rules: state.rules,
    isLoading: state.loading.rules,
    error: state.errors.rules,
  }));

/**
 * 获取请求列表的选择器
 */
export const useRequestsSelector = () =>
  useAppStore(state => ({
    requests: state.requests,
    isLoading: state.loading.requests,
    error: state.errors.requests,
    page: state.requestPage,
    total: state.requestTotal,
  }));

/**
 * 获取统计信息的选择器
 */
export const useStatsSelector = () =>
  useAppStore(state => ({
    stats: state.stats,
    isLoading: state.loading.stats,
    error: state.errors.stats,
  }));

/**
 * 获取 SSE 状态的选择器
 */
export const useSSEStatusSelector = () =>
  useAppStore(state => ({
    sseStatus: state.sseStatus,
    apiConnected: state.apiConnected,
  }));

/**
 * 获取加载状态的选择器
 */
export const useLoadingSelector = () => useAppStore(state => state.loading);

/**
 * 获取错误状态的选择器
 */
export const useErrorSelector = () => useAppStore(state => state.errors);
