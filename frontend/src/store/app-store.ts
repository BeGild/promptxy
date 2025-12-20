import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { PromptxyRule, RequestListItem, SSEConnectionStatus } from "@/types";
import { getRules, syncRules } from "@/api/rules";
import { getRequests, getStats } from "@/api/requests";
import { checkHealth } from "@/api/client";

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
      set((state) => ({ loading: { ...state.loading, rules: true } }));
      try {
        const rules = await getRules();
        set({ rules, errors: { ...get().errors, rules: null } });
      } catch (error: any) {
        set({ errors: { ...get().errors, rules: error.message } });
      } finally {
        set((state) => ({ loading: { ...state.loading, rules: false } }));
      }
    },

    // 保存规则
    saveRules: async (rules: PromptxyRule[]) => {
      set((state) => ({ loading: { ...state.loading, saving: true } }));
      try {
        const result = await syncRules(rules);
        set({
          rules,
          errors: { ...get().errors, save: null },
        });
        return result;
      } catch (error: any) {
        set({ errors: { ...get().errors, save: error.message } });
        throw error;
      } finally {
        set((state) => ({ loading: { ...state.loading, saving: false } }));
      }
    },

    // 加载请求列表
    loadRequests: async (page = 1) => {
      set((state) => ({ loading: { ...state.loading, requests: true } }));
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
        set((state) => ({ loading: { ...state.loading, requests: false } }));
      }
    },

    // 加载统计
    loadStats: async () => {
      set((state) => ({ loading: { ...state.loading, stats: true } }));
      try {
        const stats = await getStats();
        set({ stats, errors: { ...get().errors, stats: null } });
      } catch (error: any) {
        set({ errors: { ...get().errors, stats: error.message } });
      } finally {
        set((state) => ({ loading: { ...state.loading, stats: false } }));
      }
    },

    // 检查连接
    checkConnection: async () => {
      const connected = await checkHealth();
      set({ apiConnected: connected });
      return connected;
    },

    // 设置 SSE 状态
    setSSEStatus: (status: SSEConnectionStatus) => {
      set({ sseStatus: status });
    },

    // 添加新请求（来自 SSE）
    addNewRequest: (request: RequestListItem) => {
      set((state) => ({
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
  }))
);
