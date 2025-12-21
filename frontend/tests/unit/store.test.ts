/**
 * Store 测试
 * 覆盖 app-store.ts, ui-store.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';

// 模拟 API 模块
vi.mock('@/api/rules', () => ({
  getRules: vi.fn(),
  syncRules: vi.fn(),
}));

vi.mock('@/api/requests', () => ({
  getRequests: vi.fn(),
  getStats: vi.fn(),
}));

vi.mock('@/api/client', () => ({
  checkHealth: vi.fn(),
}));

// 模拟 zustand/middleware
vi.mock('zustand/middleware', () => ({
  devtools: (fn: any) => fn,
  persist: (fn: any, config: any) => {
    const store = fn(
      (...args: any[]) => {
        // 简化版的 set 和 get
        const state = args[0];
        if (typeof state === 'function') {
          return state;
        }
        return state;
      },
      () => ({}),
    );
    return store;
  },
}));

// 导入被测试的 store
import { useAppStore } from '@/store/app-store';
import { useUIStore } from '@/store/ui-store';
import { getRules, syncRules } from '@/api/rules';
import { getRequests, getStats } from '@/api/requests';
import { checkHealth } from '@/api/client';

describe('App Store', () => {
  beforeEach(() => {
    // 重置 store
    useAppStore.getState().reset();
    vi.clearAllMocks();
  });

  describe('初始状态', () => {
    it('应该有正确的初始状态', () => {
      const state = useAppStore.getState();
      expect(state.rules).toEqual([]);
      expect(state.requests).toEqual([]);
      expect(state.stats).toBeNull();
      expect(state.loading.rules).toBe(false);
      expect(state.loading.requests).toBe(false);
      expect(state.loading.stats).toBe(false);
      expect(state.loading.saving).toBe(false);
      expect(state.errors.rules).toBeNull();
      expect(state.errors.requests).toBeNull();
      expect(state.errors.stats).toBeNull();
      expect(state.errors.save).toBeNull();
      expect(state.sseStatus).toEqual({ connected: false, lastEvent: null, error: null });
      expect(state.apiConnected).toBe(false);
      expect(state.requestPage).toBe(1);
      expect(state.requestTotal).toBe(0);
    });
  });

  describe('loadRules', () => {
    it('应该成功加载规则', async () => {
      const mockRules = [
        { id: 'rule-1', when: { client: 'claude', field: 'system' }, ops: [] },
        { id: 'rule-2', when: { client: 'claude', field: 'instructions' }, ops: [] },
      ];
      (getRules as any).mockResolvedValue(mockRules);

      await act(async () => {
        await useAppStore.getState().loadRules();
      });

      const state = useAppStore.getState();
      expect(state.rules).toEqual(mockRules);
      expect(state.loading.rules).toBe(false);
      expect(state.errors.rules).toBeNull();
    });

    it('应该处理加载规则失败', async () => {
      const errorMessage = 'Network error';
      (getRules as any).mockRejectedValue(new Error(errorMessage));

      await act(async () => {
        await useAppStore.getState().loadRules();
      });

      const state = useAppStore.getState();
      expect(state.rules).toEqual([]);
      expect(state.loading.rules).toBe(false);
      expect(state.errors.rules).toBe(errorMessage);
    });

    it('应该设置加载状态', async () => {
      (getRules as any).mockImplementation(() => new Promise(() => {}));

      const loadPromise = useAppStore.getState().loadRules();
      const stateDuringLoad = useAppStore.getState();
      expect(stateDuringLoad.loading.rules).toBe(true);

      // 为了测试，我们取消这个promise
      loadPromise.catch(() => {});
    });
  });

  describe('saveRules', () => {
    it('应该成功保存规则', async () => {
      const rules = [{ id: 'rule-1', when: { client: 'claude', field: 'system' }, ops: [] }];
      (syncRules as any).mockResolvedValue({ success: true });

      await act(async () => {
        await useAppStore.getState().saveRules(rules);
      });

      const state = useAppStore.getState();
      expect(state.rules).toEqual(rules);
      expect(state.loading.saving).toBe(false);
      expect(state.errors.save).toBeNull();
    });

    it('应该处理保存失败', async () => {
      const rules = [{ id: 'rule-1', when: { client: 'claude', field: 'system' }, ops: [] }];
      const errorMessage = 'Save failed';
      (syncRules as any).mockRejectedValue(new Error(errorMessage));

      let caughtError: Error | null = null;
      try {
        await act(async () => {
          await useAppStore.getState().saveRules(rules);
        });
      } catch (error: any) {
        caughtError = error;
      }

      const state = useAppStore.getState();
      expect(state.errors.save).toBe(errorMessage);
      expect(caughtError).toBeInstanceOf(Error);
    });

    it('应该设置保存加载状态', async () => {
      (syncRules as any).mockImplementation(() => new Promise(() => {}));

      const savePromise = useAppStore.getState().saveRules([]);
      const stateDuringSave = useAppStore.getState();
      expect(stateDuringSave.loading.saving).toBe(true);

      // 为了测试，我们取消这个promise
      savePromise.catch(() => {});
    });
  });

  describe('loadRequests', () => {
    it('应该成功加载请求列表', async () => {
      const mockResponse = {
        total: 2,
        limit: 50,
        offset: 0,
        items: [
          {
            id: 'req-1',
            timestamp: Date.now(),
            client: 'claude',
            path: '/test',
            method: 'POST',
            matchedRules: [],
          },
          {
            id: 'req-2',
            timestamp: Date.now(),
            client: 'codex',
            path: '/api',
            method: 'GET',
            matchedRules: [],
          },
        ],
      };
      (getRequests as any).mockResolvedValue(mockResponse);

      await act(async () => {
        await useAppStore.getState().loadRequests(1);
      });

      const state = useAppStore.getState();
      expect(state.requests).toEqual(mockResponse.items);
      expect(state.requestPage).toBe(1);
      expect(state.requestTotal).toBe(2);
      expect(state.loading.requests).toBe(false);
      expect(state.errors.requests).toBeNull();
    });

    it('应该处理加载请求失败', async () => {
      const errorMessage = 'Network error';
      (getRequests as any).mockRejectedValue(new Error(errorMessage));

      await act(async () => {
        await useAppStore.getState().loadRequests(1);
      });

      const state = useAppStore.getState();
      expect(state.requests).toEqual([]);
      expect(state.loading.requests).toBe(false);
      expect(state.errors.requests).toBe(errorMessage);
    });

    it('应该支持分页', async () => {
      const mockResponse = {
        total: 100,
        limit: 50,
        offset: 50,
        items: [
          {
            id: 'req-51',
            timestamp: Date.now(),
            client: 'claude',
            path: '/test',
            method: 'POST',
            matchedRules: [],
          },
        ],
      };
      (getRequests as any).mockResolvedValue(mockResponse);

      await act(async () => {
        await useAppStore.getState().loadRequests(2);
      });

      expect(getRequests).toHaveBeenCalledWith({}, 2, 50);
      const state = useAppStore.getState();
      expect(state.requestPage).toBe(2);
    });
  });

  describe('loadStats', () => {
    it('应该成功加载统计信息', async () => {
      const mockStats = {
        total: 100,
        byClient: { claude: 60, codex: 40 },
        recent: 10,
        database: { path: '/db.sqlite', size: 1024, recordCount: 100 },
      };
      (getStats as any).mockResolvedValue(mockStats);

      await act(async () => {
        await useAppStore.getState().loadStats();
      });

      const state = useAppStore.getState();
      expect(state.stats).toEqual(mockStats);
      expect(state.loading.stats).toBe(false);
      expect(state.errors.stats).toBeNull();
    });

    it('应该处理加载统计失败', async () => {
      const errorMessage = 'Stats error';
      (getStats as any).mockRejectedValue(new Error(errorMessage));

      await act(async () => {
        await useAppStore.getState().loadStats();
      });

      const state = useAppStore.getState();
      expect(state.stats).toBeNull();
      expect(state.loading.stats).toBe(false);
      expect(state.errors.stats).toBe(errorMessage);
    });
  });

  describe('checkConnection', () => {
    it('应该检测连接成功', async () => {
      (checkHealth as any).mockResolvedValue(true);

      await act(async () => {
        await useAppStore.getState().checkConnection();
      });

      const state = useAppStore.getState();
      expect(state.apiConnected).toBe(true);
    });

    it('应该检测连接失败', async () => {
      (checkHealth as any).mockResolvedValue(false);

      await act(async () => {
        await useAppStore.getState().checkConnection();
      });

      const state = useAppStore.getState();
      expect(state.apiConnected).toBe(false);
    });
  });

  describe('setSSEStatus', () => {
    it('应该设置SSE状态', () => {
      const newStatus = { connected: true, lastEvent: Date.now(), error: null };
      act(() => {
        useAppStore.getState().setSSEStatus(newStatus);
      });

      const state = useAppStore.getState();
      expect(state.sseStatus).toEqual(newStatus);
    });
  });

  describe('addNewRequest', () => {
    it('应该添加新请求到列表', () => {
      const initialRequest = {
        id: 'req-1',
        timestamp: Date.now(),
        client: 'claude',
        path: '/test',
        method: 'POST',
        matchedRules: [],
      };

      act(() => {
        useAppStore.getState().addNewRequest(initialRequest);
      });

      const state = useAppStore.getState();
      expect(state.requests).toHaveLength(1);
      expect(state.requests[0]).toEqual(initialRequest);
      expect(state.requestTotal).toBe(1);
    });

    it('应该将新请求添加到列表开头', () => {
      const existingRequest = {
        id: 'req-1',
        timestamp: Date.now(),
        client: 'claude',
        path: '/test',
        method: 'POST',
        matchedRules: [],
      };

      act(() => {
        useAppStore.getState().addNewRequest(existingRequest);
      });

      const newRequest = {
        id: 'req-2',
        timestamp: Date.now() + 1000,
        client: 'codex',
        path: '/api',
        method: 'GET',
        matchedRules: [],
      };

      act(() => {
        useAppStore.getState().addNewRequest(newRequest);
      });

      const state = useAppStore.getState();
      expect(state.requests[0].id).toBe('req-2'); // 新的在前面
      expect(state.requests[1].id).toBe('req-1');
    });

    it('应该限制列表长度为50', () => {
      // 添加51个请求
      act(() => {
        for (let i = 0; i < 51; i++) {
          useAppStore.getState().addNewRequest({
            id: `req-${i}`,
            timestamp: Date.now(),
            client: 'claude',
            path: '/test',
            method: 'POST',
            matchedRules: [],
          });
        }
      });

      const state = useAppStore.getState();
      expect(state.requests).toHaveLength(50);
    });
  });

  describe('clearErrors', () => {
    it('应该清除所有错误', () => {
      // 先设置一些错误
      act(() => {
        useAppStore.setState({
          errors: {
            rules: 'rule error',
            requests: 'request error',
            stats: 'stats error',
            save: 'save error',
          },
        });
      });

      act(() => {
        useAppStore.getState().clearErrors();
      });

      const state = useAppStore.getState();
      expect(state.errors.rules).toBeNull();
      expect(state.errors.requests).toBeNull();
      expect(state.errors.stats).toBeNull();
      expect(state.errors.save).toBeNull();
    });
  });

  describe('reset', () => {
    it('应该重置到初始状态', () => {
      // 设置一些状态
      act(() => {
        useAppStore.setState({
          rules: [{ id: 'rule-1', when: { client: 'claude', field: 'system' }, ops: [] }],
          requests: [
            {
              id: 'req-1',
              timestamp: Date.now(),
              client: 'claude',
              path: '/test',
              method: 'POST',
              matchedRules: [],
            },
          ],
          stats: { total: 100 },
          loading: { rules: true, requests: true, stats: true, saving: true },
          errors: { rules: 'error', requests: 'error', stats: 'error', save: 'error' },
          requestPage: 5,
          requestTotal: 100,
        });
      });

      act(() => {
        useAppStore.getState().reset();
      });

      const state = useAppStore.getState();
      expect(state.rules).toEqual([]);
      expect(state.requests).toEqual([]);
      expect(state.stats).toBeNull();
      expect(state.loading.rules).toBe(false);
      expect(state.loading.requests).toBe(false);
      expect(state.loading.stats).toBe(false);
      expect(state.loading.saving).toBe(false);
      expect(state.errors.rules).toBeNull();
      expect(state.errors.requests).toBeNull();
      expect(state.errors.stats).toBeNull();
      expect(state.errors.save).toBeNull();
      expect(state.requestPage).toBe(1);
      expect(state.requestTotal).toBe(0);
    });
  });
});

describe('UI Store', () => {
  beforeEach(() => {
    // 重置 store
    useUIStore.getState().reset();
    vi.clearAllMocks();
  });

  describe('初始状态', () => {
    it('应该有正确的初始状态', () => {
      const state = useUIStore.getState();
      expect(state.isRuleEditorOpen).toBe(false);
      expect(state.isRequestDetailOpen).toBe(false);
      expect(state.isPreviewOpen).toBe(false);
      expect(state.isSettingsOpen).toBe(false);
      expect(state.selectedRuleId).toBeNull();
      expect(state.selectedRequestId).toBeNull();
      expect(state.sidebarCollapsed).toBe(false);
      expect(state.activeTab).toBe('rules');
    });
  });

  describe('模态框操作', () => {
    describe('openRuleEditor', () => {
      it('应该打开规则编辑器', () => {
        act(() => {
          useUIStore.getState().openRuleEditor();
        });

        const state = useUIStore.getState();
        expect(state.isRuleEditorOpen).toBe(true);
        expect(state.selectedRuleId).toBeNull();
      });

      it('应该打开规则编辑器并设置选中ID', () => {
        act(() => {
          useUIStore.getState().openRuleEditor('rule-1');
        });

        const state = useUIStore.getState();
        expect(state.isRuleEditorOpen).toBe(true);
        expect(state.selectedRuleId).toBe('rule-1');
      });
    });

    describe('closeRuleEditor', () => {
      it('应该关闭规则编辑器', () => {
        act(() => {
          useUIStore.getState().openRuleEditor('rule-1');
          useUIStore.getState().closeRuleEditor();
        });

        const state = useUIStore.getState();
        expect(state.isRuleEditorOpen).toBe(false);
        expect(state.selectedRuleId).toBeNull();
      });
    });

    describe('openRequestDetail', () => {
      it('应该打开请求详情', () => {
        act(() => {
          useUIStore.getState().openRequestDetail('req-1');
        });

        const state = useUIStore.getState();
        expect(state.isRequestDetailOpen).toBe(true);
        expect(state.selectedRequestId).toBe('req-1');
      });
    });

    describe('closeRequestDetail', () => {
      it('应该关闭请求详情', () => {
        act(() => {
          useUIStore.getState().openRequestDetail('req-1');
          useUIStore.getState().closeRequestDetail();
        });

        const state = useUIStore.getState();
        expect(state.isRequestDetailOpen).toBe(false);
        expect(state.selectedRequestId).toBeNull();
      });
    });

    describe('openPreview', () => {
      it('应该打开预览', () => {
        act(() => {
          useUIStore.getState().openPreview();
        });

        const state = useUIStore.getState();
        expect(state.isPreviewOpen).toBe(true);
      });
    });

    describe('closePreview', () => {
      it('应该关闭预览', () => {
        act(() => {
          useUIStore.getState().openPreview();
          useUIStore.getState().closePreview();
        });

        const state = useUIStore.getState();
        expect(state.isPreviewOpen).toBe(false);
      });
    });

    describe('openSettings', () => {
      it('应该打开设置', () => {
        act(() => {
          useUIStore.getState().openSettings();
        });

        const state = useUIStore.getState();
        expect(state.isSettingsOpen).toBe(true);
      });
    });

    describe('closeSettings', () => {
      it('应该关闭设置', () => {
        act(() => {
          useUIStore.getState().openSettings();
          useUIStore.getState().closeSettings();
        });

        const state = useUIStore.getState();
        expect(state.isSettingsOpen).toBe(false);
      });
    });
  });

  describe('导航操作', () => {
    describe('setActiveTab', () => {
      it('应该设置活动标签', () => {
        act(() => {
          useUIStore.getState().setActiveTab('requests');
        });

        const state = useUIStore.getState();
        expect(state.activeTab).toBe('requests');
      });

      it('应该支持所有标签类型', () => {
        const tabs = ['rules', 'requests', 'preview', 'settings'] as const;

        tabs.forEach(tab => {
          act(() => {
            useUIStore.getState().setActiveTab(tab);
          });

          const state = useUIStore.getState();
          expect(state.activeTab).toBe(tab);
        });
      });
    });

    describe('toggleSidebar', () => {
      it('应该切换侧边栏状态', () => {
        const initialState = useUIStore.getState().sidebarCollapsed;

        act(() => {
          useUIStore.getState().toggleSidebar();
        });

        let state = useUIStore.getState();
        expect(state.sidebarCollapsed).toBe(!initialState);

        act(() => {
          useUIStore.getState().toggleSidebar();
        });

        state = useUIStore.getState();
        expect(state.sidebarCollapsed).toBe(initialState);
      });
    });
  });

  describe('reset', () => {
    it('应该重置到初始状态', () => {
      // 设置一些状态
      act(() => {
        useUIStore.getState().openRuleEditor('rule-1');
        useUIStore.getState().openRequestDetail('req-1');
        useUIStore.getState().openPreview();
        useUIStore.getState().openSettings();
        useUIStore.getState().setActiveTab('requests');
        useUIStore.getState().toggleSidebar();
      });

      // 验证状态已改变
      let state = useUIStore.getState();
      expect(state.isRuleEditorOpen).toBe(true);
      expect(state.isRequestDetailOpen).toBe(true);
      expect(state.isPreviewOpen).toBe(true);
      expect(state.isSettingsOpen).toBe(true);
      expect(state.selectedRuleId).toBe('rule-1');
      expect(state.selectedRequestId).toBe('req-1');
      expect(state.activeTab).toBe('requests');
      expect(state.sidebarCollapsed).toBe(true);

      // 重置
      act(() => {
        useUIStore.getState().reset();
      });

      // 验证回到初始状态
      state = useUIStore.getState();
      expect(state.isRuleEditorOpen).toBe(false);
      expect(state.isRequestDetailOpen).toBe(false);
      expect(state.isPreviewOpen).toBe(false);
      expect(state.isSettingsOpen).toBe(false);
      expect(state.selectedRuleId).toBeNull();
      expect(state.selectedRequestId).toBeNull();
      expect(state.activeTab).toBe('rules');
      expect(state.sidebarCollapsed).toBe(false);
    });
  });
});
