/**
 * Hooks 测试
 * 覆盖 useRules.ts, useRequests.ts, useSSE.ts, useConfig.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// 模拟 API 模块
vi.mock('@/api/rules', () => ({
  getRules: vi.fn(),
  syncRules: vi.fn(),
  createRule: vi.fn(),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
  batchUpdateRules: vi.fn(),
  previewRule: vi.fn(),
}));

vi.mock('@/api/requests', () => ({
  getRequests: vi.fn(),
  getRequestDetail: vi.fn(),
  deleteRequest: vi.fn(),
  cleanupRequests: vi.fn(),
  getStats: vi.fn(),
  getDatabaseInfo: vi.fn(),
}));

vi.mock('@/api/config', () => ({
  exportConfig: vi.fn(),
  importConfig: vi.fn(),
  downloadConfig: vi.fn(),
  uploadConfig: vi.fn(),
}));

vi.mock('@/api/client', () => ({
  checkHealth: vi.fn(),
}));

vi.mock('@/api/sse', () => ({
  SSEClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
  })),
}));

vi.mock('@/store', () => ({
  useAppStore: vi.fn(selector => {
    if (typeof selector === 'function') {
      return selector({
        loading: { rules: false, requests: false, stats: false, saving: false },
        sseStatus: { connected: false, lastEvent: null, error: null },
        addNewRequest: vi.fn(),
        setSSEStatus: vi.fn(),
        saveRules: vi.fn(),
      });
    }
    return {
      loading: { rules: false, requests: false, stats: false, saving: false },
      sseStatus: { connected: false, lastEvent: null, error: null },
      addNewRequest: vi.fn(),
      setSSEStatus: vi.fn(),
      saveRules: vi.fn(),
    };
  }),
}));

// 导入被测试的 hooks
import {
  useRules,
  useSaveRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useBatchUpdateRules,
  usePreviewRule,
  useRule,
  useCreateRuleIncremental,
  useUpdateRuleIncremental,
  useDeleteRuleIncremental,
} from '@/hooks/useRules';

import {
  useRequests,
  useRequestDetail,
  useDeleteRequest,
  useCleanupRequests,
  useStats,
  useDatabaseInfo,
} from '@/hooks/useRequests';

import { useSSE } from '@/hooks/useSSE';

import {
  useExportConfig,
  useImportConfig,
  useDownloadConfig,
  useUploadConfig,
  useConfig,
} from '@/hooks/useConfig';

import {
  getRules,
  syncRules,
  createRule,
  updateRule,
  deleteRule,
  batchUpdateRules,
  previewRule,
} from '@/api/rules';
import {
  getRequests,
  getRequestDetail,
  deleteRequest,
  cleanupRequests,
  getStats,
  getDatabaseInfo,
} from '@/api/requests';
import { exportConfig, importConfig } from '@/api/config';

// 创建 QueryClient 包装器
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
  return function QueryClientWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe('Rules Hooks', () => {
  describe('useRules', () => {
    it('应该获取规则列表', async () => {
      const mockRules = [{ id: 'rule-1', when: { client: 'claude', field: 'system' }, ops: [] }];
      (getRules as any).mockResolvedValue(mockRules);

      const { result } = renderHook(() => useRules(), { wrapper: createWrapper() });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.rules).toEqual(mockRules);
      });
    });

    it('应该处理错误', async () => {
      (getRules as any).mockRejectedValue(new Error('Failed to fetch'));

      const { result } = renderHook(() => useRules(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });
    });
  });

  describe('useSaveRules', () => {
    it('应该保存规则', async () => {
      const mockSaveRules = vi.fn().mockResolvedValue({ success: true });
      (syncRules as any).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useSaveRules(), { wrapper: createWrapper() });

      const rules = [{ id: 'rule-1', when: { client: 'claude', field: 'system' }, ops: [] }];
      result.current.mutate(rules);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe('useCreateRule', () => {
    it('应该创建规则', async () => {
      const rule = { id: 'rule-1', when: { client: 'claude', field: 'system' }, ops: [] };
      (createRule as any).mockResolvedValue({ success: true, rule });

      const { result } = renderHook(() => useCreateRule(), { wrapper: createWrapper() });

      result.current.mutate(rule);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(createRule).toHaveBeenCalledWith(rule);
      });
    });
  });

  describe('useUpdateRule', () => {
    it('应该更新规则', async () => {
      const rule = { id: 'rule-1', when: { client: 'claude', field: 'system' }, ops: [] };
      (updateRule as any).mockResolvedValue({ success: true, rule });

      const { result } = renderHook(() => useUpdateRule(), { wrapper: createWrapper() });

      result.current.mutate(rule);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(updateRule).toHaveBeenCalledWith(rule);
      });
    });
  });

  describe('useDeleteRule', () => {
    it('应该删除规则', async () => {
      (deleteRule as any).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useDeleteRule(), { wrapper: createWrapper() });

      result.current.mutate('rule-1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(deleteRule).toHaveBeenCalledWith('rule-1');
      });
    });
  });

  describe('useBatchUpdateRules', () => {
    it('应该批量更新规则', async () => {
      const rules = [{ id: 'rule-1', when: { client: 'claude', field: 'system' }, ops: [] }];
      (batchUpdateRules as any).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useBatchUpdateRules(), { wrapper: createWrapper() });

      result.current.mutate(rules);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(batchUpdateRules).toHaveBeenCalledWith(rules);
      });
    });
  });

  describe('usePreviewRule', () => {
    it('应该预览规则效果', async () => {
      const request = {
        body: { test: 'data' },
        client: 'claude' as const,
        field: 'system' as const,
      };
      const mockResponse = { original: request.body, modified: { test: 'modified' }, matches: [] };
      (previewRule as any).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => usePreviewRule(), { wrapper: createWrapper() });

      result.current.mutate(request);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(previewRule).toHaveBeenCalledWith(
          request.body,
          request.client,
          request.field,
          undefined,
          undefined,
          undefined,
        );
      });
    });
  });

  describe('useRule', () => {
    it('应该获取单个规则', async () => {
      const mockRules = [
        { id: 'rule-1', when: { client: 'claude', field: 'system' }, ops: [] },
        { id: 'rule-2', when: { client: 'claude', field: 'instructions' }, ops: [] },
      ];
      (getRules as any).mockResolvedValue(mockRules);

      const { result } = renderHook(() => useRule('rule-1'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.rule).toEqual(mockRules[0]);
      });
    });

    it('应该返回null当规则不存在', async () => {
      const mockRules = [{ id: 'rule-1', when: { client: 'claude', field: 'system' }, ops: [] }];
      (getRules as any).mockResolvedValue(mockRules);

      const { result } = renderHook(() => useRule('rule-2'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.rule).toBeNull();
      });
    });
  });

  describe('useCreateRuleIncremental', () => {
    it('应该使用增量API创建规则', async () => {
      const rule = { id: 'rule-1', when: { client: 'claude', field: 'system' }, ops: [] };
      (createRule as any).mockResolvedValue({ success: true, rule });

      const { result } = renderHook(() => useCreateRuleIncremental(), { wrapper: createWrapper() });

      result.current.mutate(rule);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(createRule).toHaveBeenCalledWith(rule);
      });
    });
  });

  describe('useUpdateRuleIncremental', () => {
    it('应该使用增量API更新规则', async () => {
      const rule = { id: 'rule-1', when: { client: 'claude', field: 'system' }, ops: [] };
      (updateRule as any).mockResolvedValue({ success: true, rule });

      const { result } = renderHook(() => useUpdateRuleIncremental(), { wrapper: createWrapper() });

      result.current.mutate(rule);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(updateRule).toHaveBeenCalledWith(rule);
      });
    });
  });

  describe('useDeleteRuleIncremental', () => {
    it('应该使用增量API删除规则', async () => {
      (deleteRule as any).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useDeleteRuleIncremental(), { wrapper: createWrapper() });

      result.current.mutate('rule-1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(deleteRule).toHaveBeenCalledWith('rule-1');
      });
    });
  });
});

describe('Requests Hooks', () => {
  describe('useRequests', () => {
    it('应该获取请求列表', async () => {
      const mockResponse = {
        total: 1,
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
        ],
      };
      (getRequests as any).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useRequests({}, 1), { wrapper: createWrapper() });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toEqual(mockResponse);
      });
    });

    it('应该应用过滤器', async () => {
      const filters = { client: 'claude', search: 'test' };
      const mockResponse = { total: 0, limit: 50, offset: 0, items: [] };
      (getRequests as any).mockResolvedValue(mockResponse);

      renderHook(() => useRequests(filters, 1), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(getRequests).toHaveBeenCalledWith(filters, 1, 50);
      });
    });
  });

  describe('useRequestDetail', () => {
    it('应该获取请求详情', async () => {
      const mockDetail = {
        id: 'req-1',
        timestamp: Date.now(),
        client: 'claude',
        path: '/test',
        method: 'POST',
        originalBody: { test: 'original' },
        modifiedBody: { test: 'modified' },
        matchedRules: [{ ruleId: 'rule-1', opType: 'append' }],
      };
      (getRequestDetail as any).mockResolvedValue(mockDetail);

      const { result } = renderHook(() => useRequestDetail('req-1'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.request).toEqual(mockDetail);
      });
    });

    it('应该在没有ID时禁用查询', () => {
      const { result } = renderHook(() => useRequestDetail(null), { wrapper: createWrapper() });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.request).toBeUndefined();
    });
  });

  describe('useDeleteRequest', () => {
    it('应该删除请求', async () => {
      (deleteRequest as any).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useDeleteRequest(), { wrapper: createWrapper() });

      result.current.mutate('req-1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(deleteRequest).toHaveBeenCalledWith('req-1');
      });
    });
  });

  describe('useCleanupRequests', () => {
    it('应该清理请求', async () => {
      (cleanupRequests as any).mockResolvedValue({ deleted: 10, remaining: 90, success: true });

      const { result } = renderHook(() => useCleanupRequests(), { wrapper: createWrapper() });

      result.current.mutate(100);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(cleanupRequests).toHaveBeenCalledWith(100);
      });
    });
  });

  describe('useStats', () => {
    it('应该获取统计信息', async () => {
      const mockStats = {
        total: 100,
        byClient: { claude: 60, codex: 40 },
        recent: 10,
        database: { path: '/db.sqlite', size: 1024, recordCount: 100 },
      };
      (getStats as any).mockResolvedValue(mockStats);

      const { result } = renderHook(() => useStats(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.stats).toEqual(mockStats);
      });
    });
  });

  describe('useDatabaseInfo', () => {
    it('应该获取数据库信息', async () => {
      const mockDbInfo = { path: '/db.sqlite', size: 1024, recordCount: 100 };
      (getDatabaseInfo as any).mockResolvedValue(mockDbInfo);

      const { result } = renderHook(() => useDatabaseInfo(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.database).toEqual(mockDbInfo);
      });
    });
  });
});

describe('SSE Hook', () => {
  describe('useSSE', () => {
    it('应该建立SSE连接', () => {
      const { result } = renderHook(() => useSSE(), { wrapper: createWrapper() });

      // Hook应该返回连接状态和控制函数
      expect(result.current).toHaveProperty('isConnected');
      expect(result.current).toHaveProperty('reconnect');
      expect(result.current).toHaveProperty('disconnect');
    });

    it('应该处理重连', () => {
      const { result } = renderHook(() => useSSE(), { wrapper: createWrapper() });

      act(() => {
        result.current.reconnect();
      });

      // 由于我们模拟了SSEClient，这里主要验证函数存在且可调用
      expect(typeof result.current.reconnect).toBe('function');
    });

    it('应该处理断开连接', () => {
      const { result } = renderHook(() => useSSE(), { wrapper: createWrapper() });

      act(() => {
        result.current.disconnect();
      });

      expect(typeof result.current.disconnect).toBe('function');
    });
  });
});

describe('Config Hooks', () => {
  describe('useExportConfig', () => {
    it('应该导出配置', async () => {
      const mockConfig = { rules: [{ id: 'rule-1' }] };
      (exportConfig as any).mockResolvedValue(mockConfig);

      const { result } = renderHook(() => useExportConfig(), { wrapper: createWrapper() });

      result.current.mutate();

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(exportConfig).toHaveBeenCalled();
      });
    });
  });

  describe('useImportConfig', () => {
    it('应该导入配置', async () => {
      const config = { rules: [{ id: 'rule-1' }] };
      const response = { success: true, message: 'Imported' };
      (importConfig as any).mockResolvedValue(response);

      const { result } = renderHook(() => useImportConfig(), { wrapper: createWrapper() });

      result.current.mutate(config);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(importConfig).toHaveBeenCalledWith(config);
      });
    });
  });

  describe('useDownloadConfig', () => {
    it('应该提供下载功能', () => {
      const { result } = renderHook(() => useDownloadConfig(), { wrapper: createWrapper() });

      expect(result.current.download).toBeDefined();
      expect(typeof result.current.download).toBe('function');
    });
  });

  describe('useUploadConfig', () => {
    it('应该提供上传功能', () => {
      const { result } = renderHook(() => useUploadConfig(), { wrapper: createWrapper() });

      expect(result.current.upload).toBeDefined();
      expect(typeof result.current.upload).toBe('function');
    });
  });

  describe('useConfig', () => {
    it('应该获取配置', async () => {
      const mockConfig = { rules: [{ id: 'rule-1' }] };
      (exportConfig as any).mockResolvedValue(mockConfig);

      const { result } = renderHook(() => useConfig(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.config).toEqual(mockConfig);
      });
    });
  });
});
