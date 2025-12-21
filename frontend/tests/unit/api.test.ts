/**
 * API 客户端测试
 * 覆盖 client.ts, sse.ts, rules.ts, requests.ts, config.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { apiClient, checkHealth } from '@/api/client';
import { SSEClient } from '@/api/sse';
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
import { exportConfig, importConfig, downloadConfig, uploadConfig } from '@/api/config';
import type { PromptxyRule, RequestFilters, SSEConnectionStatus, SSERequestEvent } from '@/types';

// 模拟 axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

describe('API Client', () => {
  describe('apiClient', () => {
    it('应该创建具有正确配置的axios实例', () => {
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: undefined,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('应该处理请求拦截器', () => {
      const mockUse = vi.fn();
      const mockInterceptors = {
        request: { use: mockUse },
        response: { use: vi.fn() },
      };

      (axios.create as any).mockReturnValue({
        interceptors: mockInterceptors,
        get: vi.fn(),
        post: vi.fn(),
      });

      // 重新导入以触发拦截器设置
      const client = apiClient;
      expect(mockUse).toHaveBeenCalled();
    });
  });

  describe('checkHealth', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('应该返回true当健康检查成功', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: { status: 'ok' },
      });
      (axios.create as any).mockReturnValue({
        get: mockGet,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      });

      const result = await checkHealth();
      expect(result).toBe(true);
      expect(mockGet).toHaveBeenCalledWith('/_promptxy/health');
    });

    it('应该返回false当健康检查失败', async () => {
      const mockGet = vi.fn().mockRejectedValue(new Error('Network error'));
      (axios.create as any).mockReturnValue({
        get: mockGet,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      });

      const result = await checkHealth();
      expect(result).toBe(false);
    });

    it('应该返回false当状态不是ok', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: { status: 'error' },
      });
      (axios.create as any).mockReturnValue({
        get: mockGet,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      });

      const result = await checkHealth();
      expect(result).toBe(false);
    });
  });
});

describe('SSE Client', () => {
  let sseClient: SSEClient;
  let mockOnEvent: ReturnType<typeof vi.fn>;
  let mockOnStatusChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnEvent = vi.fn();
    mockOnStatusChange = vi.fn();
    sseClient = new SSEClient('http://test.com/events', mockOnEvent, mockOnStatusChange);
  });

  afterEach(() => {
    if (sseClient) {
      sseClient.disconnect();
    }
  });

  describe('connect', () => {
    it('应该建立SSE连接', () => {
      sseClient.connect();
      expect(sseClient.isConnected()).toBe(true);
    });

    it('应该处理连接打开事件', () => {
      vi.useFakeTimers();
      sseClient.connect();

      // 触发onopen
      const eventSource = (sseClient as any).eventSource;
      if (eventSource && eventSource.onopen) {
        eventSource.onopen();
      }

      expect(mockOnStatusChange).toHaveBeenCalledWith(expect.objectContaining({ connected: true }));
      vi.useRealTimers();
    });

    it('应该处理消息事件', () => {
      vi.useFakeTimers();
      sseClient.connect();

      const eventSource = (sseClient as any).eventSource;
      if (eventSource && eventSource.onmessage) {
        const mockEvent = {
          data: JSON.stringify({
            id: 'test-id',
            timestamp: Date.now(),
            client: 'claude',
            path: '/test',
            method: 'POST',
            matchedRules: ['rule-1'],
          }),
        };
        eventSource.onmessage(mockEvent);
      }

      expect(mockOnEvent).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('应该处理自定义request事件', () => {
      vi.useFakeTimers();
      sseClient.connect();

      const eventSource = (sseClient as any).eventSource;
      if (eventSource && eventSource.addEventListener) {
        // 模拟addEventListener调用
        const mockAddEventListener = vi.fn();
        eventSource.addEventListener = mockAddEventListener;

        // 重新连接以触发事件监听器设置
        sseClient.disconnect();
        sseClient.connect();

        // 验证request事件监听器被添加
        expect(mockAddEventListener).toHaveBeenCalledWith('request', expect.any(Function));
      }
      vi.useRealTimers();
    });

    it('应该处理错误并自动重连', () => {
      vi.useFakeTimers();
      const originalConnect = sseClient.connect.bind(sseClient);
      const connectSpy = vi.spyOn(sseClient, 'connect');

      sseClient.connect();

      const eventSource = (sseClient as any).eventSource;
      if (eventSource && eventSource.onerror) {
        eventSource.onerror();
      }

      // 应该调用重连
      expect(connectSpy).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('不应该在手动关闭后重连', () => {
      vi.useFakeTimers();
      const connectSpy = vi.spyOn(sseClient, 'connect');

      sseClient.connect();
      sseClient.disconnect();

      const eventSource = (sseClient as any).eventSource;
      if (eventSource && eventSource.onerror) {
        eventSource.onerror();
      }

      // 不应该再次调用connect
      expect(connectSpy).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });

  describe('disconnect', () => {
    it('应该正确断开连接', () => {
      sseClient.connect();
      expect(sseClient.isConnected()).toBe(true);

      sseClient.disconnect();
      expect(sseClient.isConnected()).toBe(false);
      expect(mockOnStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ connected: false }),
      );
    });
  });

  describe('isConnected', () => {
    it('应该正确返回连接状态', () => {
      expect(sseClient.isConnected()).toBe(false);
      sseClient.connect();
      expect(sseClient.isConnected()).toBe(true);
      sseClient.disconnect();
      expect(sseClient.isConnected()).toBe(false);
    });
  });
});

describe('Rules API', () => {
  let mockApi: any;

  beforeEach(() => {
    mockApi = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    };
    (axios.create as any).mockReturnValue(mockApi);
  });

  describe('getRules', () => {
    it('应该获取规则列表', async () => {
      const mockRules = [{ id: 'rule-1', when: { client: 'claude', field: 'system' }, ops: [] }];
      mockApi.get.mockResolvedValue({ data: { rules: mockRules } });

      const result = await getRules();
      expect(result).toEqual(mockRules);
      expect(mockApi.get).toHaveBeenCalledWith('/_promptxy/config');
    });

    it('应该返回空数组当没有规则', async () => {
      mockApi.get.mockResolvedValue({ data: {} });

      const result = await getRules();
      expect(result).toEqual([]);
    });
  });

  describe('syncRules', () => {
    it('应该同步规则', async () => {
      const rules = [{ id: 'rule-1', when: { client: 'claude', field: 'system' }, ops: [] }];
      const response = { success: true, message: 'OK', appliedRules: 1 };
      mockApi.post.mockResolvedValue({ data: response });

      const result = await syncRules(rules);
      expect(result).toEqual(response);
      expect(mockApi.post).toHaveBeenCalledWith('/_promptxy/config/sync', { rules });
    });
  });

  describe('createRule', () => {
    it('应该创建规则', async () => {
      const rule = { id: 'rule-1', when: { client: 'claude', field: 'system' }, ops: [] };
      const response = { success: true, message: 'Created', rule };
      mockApi.post.mockResolvedValue({ data: response });

      const result = await createRule(rule);
      expect(result).toEqual(response);
      expect(mockApi.post).toHaveBeenCalledWith('/_promptxy/rules', { rule });
    });
  });

  describe('updateRule', () => {
    it('应该更新规则', async () => {
      const rule = { id: 'rule-1', when: { client: 'claude', field: 'system' }, ops: [] };
      const response = { success: true, message: 'Updated', rule };
      mockApi.put.mockResolvedValue({ data: response });

      const result = await updateRule(rule);
      expect(result).toEqual(response);
      expect(mockApi.put).toHaveBeenCalledWith('/_promptxy/rules/rule-1', { rule });
    });
  });

  describe('deleteRule', () => {
    it('应该删除规则', async () => {
      const response = { success: true, message: 'Deleted' };
      mockApi.delete.mockResolvedValue({ data: response });

      const result = await deleteRule('rule-1');
      expect(result).toEqual(response);
      expect(mockApi.delete).toHaveBeenCalledWith('/_promptxy/rules/rule-1');
    });
  });

  describe('batchUpdateRules', () => {
    it('应该批量更新规则', async () => {
      const rules = [{ id: 'rule-1', when: { client: 'claude', field: 'system' }, ops: [] }];
      const response = { success: true, message: 'OK', appliedRules: 1 };
      mockApi.post.mockResolvedValue({ data: response });

      const result = await batchUpdateRules(rules);
      expect(result).toEqual(response);
      expect(mockApi.post).toHaveBeenCalledWith('/_promptxy/config/sync', { rules });
    });
  });

  describe('previewRule', () => {
    it('应该预览规则效果', async () => {
      const body = { test: 'data' };
      const client = 'claude';
      const field = 'system';
      const model = 'gpt-4';
      const path = '/api/test';
      const method = 'POST';

      const response = { original: body, modified: { test: 'modified' }, matches: [] };
      mockApi.post.mockResolvedValue({ data: response });

      const result = await previewRule(body, client, field, model, path, method);
      expect(result).toEqual(response);
      expect(mockApi.post).toHaveBeenCalledWith('/_promptxy/preview', {
        body,
        client,
        field,
        model,
        path,
        method,
      });
    });
  });
});

describe('Requests API', () => {
  let mockApi: any;

  beforeEach(() => {
    mockApi = {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    };
    (axios.create as any).mockReturnValue(mockApi);
  });

  describe('getRequests', () => {
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
      mockApi.get.mockResolvedValue({ data: mockResponse });

      const result = await getRequests();
      expect(result).toEqual(mockResponse);
      expect(mockApi.get).toHaveBeenCalledWith('/_promptxy/requests?limit=50&offset=0');
    });

    it('应该应用过滤器', async () => {
      const filters: RequestFilters = {
        client: 'claude',
        startTime: 1000000,
        endTime: 2000000,
        search: 'test',
      };
      mockApi.get.mockResolvedValue({ data: { items: [], total: 0 } });

      await getRequests(filters);
      expect(mockApi.get).toHaveBeenCalledWith(
        '/_promptxy/requests?limit=50&offset=0&client=claude&startTime=1000000&endTime=2000000&search=test',
      );
    });

    it('应该支持分页', async () => {
      mockApi.get.mockResolvedValue({ data: { items: [], total: 0 } });

      await getRequests({}, 2, 25);
      expect(mockApi.get).toHaveBeenCalledWith('/_promptxy/requests?limit=25&offset=25');
    });
  });

  describe('getRequestDetail', () => {
    it('应该获取单个请求详情', async () => {
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
      mockApi.get.mockResolvedValue({ data: mockDetail });

      const result = await getRequestDetail('req-1');
      expect(result).toEqual(mockDetail);
      expect(mockApi.get).toHaveBeenCalledWith('/_promptxy/requests/req-1');
    });
  });

  describe('deleteRequest', () => {
    it('应该删除请求', async () => {
      const response = { success: true, message: 'Deleted' };
      mockApi.delete.mockResolvedValue({ data: response });

      const result = await deleteRequest('req-1');
      expect(result).toEqual(response);
      expect(mockApi.delete).toHaveBeenCalledWith('/_promptxy/requests/req-1');
    });
  });

  describe('cleanupRequests', () => {
    it('应该清理旧数据', async () => {
      const response = { deleted: 10, remaining: 90, success: true };
      mockApi.post.mockResolvedValue({ data: response });

      const result = await cleanupRequests(100);
      expect(result).toEqual(response);
      expect(mockApi.post).toHaveBeenCalledWith('/_promptxy/requests/cleanup?keep=100');
    });
  });

  describe('getStats', () => {
    it('应该获取统计信息', async () => {
      const stats = {
        total: 100,
        byClient: { claude: 60, codex: 40 },
        recent: 10,
        database: { path: '/db.sqlite', size: 1024, recordCount: 100 },
      };
      mockApi.get.mockResolvedValue({ data: stats });

      const result = await getStats();
      expect(result).toEqual(stats);
      expect(mockApi.get).toHaveBeenCalledWith('/_promptxy/stats');
    });
  });

  describe('getDatabaseInfo', () => {
    it('应该获取数据库信息', async () => {
      const dbInfo = { path: '/db.sqlite', size: 1024, recordCount: 100 };
      mockApi.get.mockResolvedValue({ data: dbInfo });

      const result = await getDatabaseInfo();
      expect(result).toEqual(dbInfo);
      expect(mockApi.get).toHaveBeenCalledWith('/_promptxy/database');
    });
  });
});

describe('Config API', () => {
  let mockApi: any;

  beforeEach(() => {
    mockApi = {
      get: vi.fn(),
      post: vi.fn(),
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    };
    (axios.create as any).mockReturnValue(mockApi);
  });

  describe('exportConfig', () => {
    it('应该导出配置', async () => {
      const config = { rules: [{ id: 'rule-1' }] };
      mockApi.get.mockResolvedValue({ data: config });

      const result = await exportConfig();
      expect(result).toEqual(config);
      expect(mockApi.get).toHaveBeenCalledWith('/_promptxy/config');
    });
  });

  describe('importConfig', () => {
    it('应该导入配置', async () => {
      const config = { rules: [{ id: 'rule-1' }] };
      const response = { success: true, message: 'Imported' };
      mockApi.post.mockResolvedValue({ data: response });

      const result = await importConfig(config);
      expect(result).toEqual(response);
      expect(mockApi.post).toHaveBeenCalledWith('/_promptxy/config/sync', config);
    });
  });

  describe('downloadConfig', () => {
    it('应该下载配置文件', () => {
      const config = { rules: [{ id: 'rule-1' }] };
      const mockCreateElement = vi.spyOn(document, 'createElement');
      const mockClick = vi.fn();
      const mockRemoveChild = vi.fn();

      const mockAnchor = {
        href: '',
        download: '',
        click: mockClick,
      } as any;

      mockCreateElement.mockReturnValue(mockAnchor);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);

      downloadConfig(config);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockAnchor.href).toContain('blob:');
      expect(mockAnchor.download).toBe('promptxy-config.json');
      expect(mockClick).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalledWith(mockAnchor);
    });
  });

  describe('uploadConfig', () => {
    it('应该上传配置文件', async () => {
      const mockInput = {
        type: '',
        accept: '',
        onchange: null as any,
        click: vi.fn(),
      } as any;

      const mockCreateElement = vi.spyOn(document, 'createElement');
      mockCreateElement.mockReturnValue(mockInput);

      const uploadPromise = uploadConfig();

      // 模拟文件选择
      const mockFile = new File(['{"test": "config"}'], 'config.json', {
        type: 'application/json',
      });
      const mockEvent = {
        target: {
          files: [mockFile],
        },
      };

      // 触发onchange
      mockInput.onchange(mockEvent);

      const result = await uploadPromise;
      expect(result).toEqual({ test: 'config' });
    });

    it('应该拒绝没有文件的情况', async () => {
      const mockInput = {
        type: '',
        accept: '',
        onchange: null as any,
        click: vi.fn(),
      } as any;

      const mockCreateElement = vi.spyOn(document, 'createElement');
      mockCreateElement.mockReturnValue(mockInput);

      const uploadPromise = uploadConfig();

      // 模拟没有选择文件
      const mockEvent = {
        target: {
          files: [],
        },
      };

      mockInput.onchange(mockEvent);

      await expect(uploadPromise).rejects.toThrow('No file selected');
    });

    it('应该拒绝无效的JSON文件', async () => {
      const mockInput = {
        type: '',
        accept: '',
        onchange: null as any,
        click: vi.fn(),
      } as any;

      const mockCreateElement = vi.spyOn(document, 'createElement');
      mockCreateElement.mockReturnValue(mockInput);

      const uploadPromise = uploadConfig();

      // 模拟无效JSON
      const mockFile = new File(['invalid json'], 'config.json', { type: 'application/json' });
      const mockEvent = {
        target: {
          files: [mockFile],
        },
      };

      mockInput.onchange(mockEvent);

      await expect(uploadPromise).rejects.toThrow('Invalid JSON file');
    });
  });
});
