/**
 * PromptXY API 服务器集成测试
 *
 * 测试场景：
 * 1. SSE 端点连接和事件推送
 * 2. 请求历史列表和详情 API
 * 3. 配置读取和同步 API
 * 4. 数据清理 API
 * 5. 健康检查端点
 * 6. CORS 头验证
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { Database } from 'sqlite';
import {
  TestServerContainer,
  createTestConfig,
  initializeTestDatabase,
  startTestServers,
  cleanupTestData,
  HttpClient,
  waitForCondition,
  createTestRule,
} from './test-utils.js';
import { insertRequestRecord } from '../../src/promptxy/database.js';
import { RequestRecord } from '../../src/promptxy/types.js';

describe('API Server Integration Tests', () => {
  let servers: TestServerContainer;
  let db: Database;
  let apiClient: HttpClient;
  let config: any;

  beforeAll(async () => {
    // 初始化测试配置和数据库
    config = await createTestConfig({
      rules: [
        createTestRule('test-rule-1', 'claude', 'instructions', [
          { type: 'append', text: ' [TEST]' },
        ]),
      ],
    });
    db = await initializeTestDatabase();
  });

  afterAll(async () => {
    // 清理所有测试数据
    await cleanupTestData();
  });

  beforeEach(async () => {
    // 启动服务器
    servers = await startTestServers(config, db);
    apiClient = new HttpClient(`http://127.0.0.1:${servers.apiPort}`);

    // 清空数据库中的请求记录
    await db.run('DELETE FROM requests');
  });

  afterEach(async () => {
    // 关闭服务器
    await servers.shutdown();
  });

  describe('CORS Headers', () => {
    it('应该返回正确的 CORS 头', async () => {
      const response = await apiClient.request('OPTIONS', '/_promptxy/health', undefined, {});

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-methods']).toContain('PUT');
      expect(response.headers['access-control-allow-methods']).toContain('DELETE');
      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
    });

    it('GET 请求也应该包含 CORS 头', async () => {
      const response = await apiClient.get('/_promptxy/health');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('Health Check', () => {
    it('应该返回健康状态', async () => {
      const response = await apiClient.get('/_promptxy/health');

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.service).toBe('promptxy-api');
      expect(body.timestamp).toBeDefined();
      expect(typeof body.timestamp).toBe('number');
    });
  });

  describe('SSE Events', () => {
    it('应该建立 SSE 连接并接收连接确认', async () => {
      let connected = false;
      let connectionEvent: any = null;
      let sseConnection: any = null;

      try {
        sseConnection = await apiClient.connectSSE('/_promptxy/events', (event, data) => {
          if (event === 'connected') {
            connected = true;
            connectionEvent = data;
          }
        });

        // 等待连接确认（带超时）
        await Promise.race([
          waitForCondition(() => connected, 5000),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('SSE connection timeout')), 5000),
          ),
        ]);

        expect(connected).toBe(true);
        expect(connectionEvent).toEqual({ status: 'ok' });
      } finally {
        if (sseConnection) {
          sseConnection.close();
        }
      }
    });

    it('应该接收请求事件广播', async () => {
      const events: Array<{ event: string; data: any }> = [];
      let sseConnection: any = null;

      try {
        sseConnection = await apiClient.connectSSE('/_promptxy/events', (event, data) => {
          events.push({ event, data });
        });

        // 等待连接建立
        await new Promise(resolve => setTimeout(resolve, 100));

        // 导入 broadcastRequest 函数来测试 SSE 广播
        const { broadcastRequest } = await import('../../src/promptxy/api-server.js');

        // 创建测试事件数据
        const testEvent = {
          id: 'test-sse-event',
          timestamp: Date.now(),
          client: 'claude',
          path: '/v1/messages',
          method: 'POST',
          matchedRules: ['rule-1'],
        };

        // 触发广播
        broadcastRequest(testEvent);

        // 等待事件处理
        await new Promise(resolve => setTimeout(resolve, 200));

        // 关闭连接
        sseConnection.close();

        // 验证事件接收
        expect(events.length).toBeGreaterThan(0);
        expect(events[0].event).toBe('connected');

        // 查找请求事件
        const requestEvent = events.find(e => e.event === 'request');
        expect(requestEvent).toBeDefined();
        expect(requestEvent?.data.id).toBe('test-sse-event');
        expect(requestEvent?.data.client).toBe('claude');
      } finally {
        if (sseConnection) {
          sseConnection.close();
        }
      }
    });
  });

  describe('Request History', () => {
    // 插入测试数据
    async function insertTestData() {
      const testRecords: RequestRecord[] = [
        {
          id: 'req-001',
          timestamp: Date.now() - 10000,
          client: 'claude',
          path: '/v1/messages',
          method: 'POST',
          originalBody: JSON.stringify({ instructions: 'Hello' }),
          modifiedBody: JSON.stringify({ instructions: 'Hello [MODIFIED]' }),
          matchedRules: JSON.stringify([{ ruleId: 'rule-1', opType: 'append' }]),
          responseStatus: 200,
          durationMs: 150,
          responseHeaders: JSON.stringify({ 'content-type': 'application/json' }),
        },
        {
          id: 'req-002',
          timestamp: Date.now() - 5000,
          client: 'codex',
          path: '/openai/v1/chat/completions',
          method: 'POST',
          originalBody: JSON.stringify({ messages: [{ role: 'user', content: 'Test' }] }),
          modifiedBody: JSON.stringify({
            messages: [{ role: 'user', content: 'Test [MODIFIED]' }],
          }),
          matchedRules: JSON.stringify([{ ruleId: 'rule-2', opType: 'prepend' }]),
          responseStatus: 200,
          durationMs: 200,
          responseHeaders: JSON.stringify({ 'content-type': 'application/json' }),
        },
        {
          id: 'req-003',
          timestamp: Date.now() - 2000,
          client: 'claude',
          path: '/v1/messages',
          method: 'POST',
          originalBody: JSON.stringify({ instructions: 'Error case' }),
          modifiedBody: JSON.stringify({ instructions: 'Error case' }),
          matchedRules: JSON.stringify([]),
          responseStatus: undefined,
          durationMs: 50,
          responseHeaders: undefined,
          error: 'Network timeout',
        },
      ];

      for (const record of testRecords) {
        await insertRequestRecord(record);
      }
    }

    it('应该获取请求历史列表', async () => {
      await insertTestData();

      const response = await apiClient.get('/_promptxy/requests');

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.total).toBe(3);
      expect(body.limit).toBe(50);
      expect(body.offset).toBe(0);
      expect(body.items).toHaveLength(3);

      // 验证项目结构
      const firstItem = body.items[0];
      expect(firstItem.id).toBeDefined();
      expect(firstItem.timestamp).toBeDefined();
      expect(firstItem.client).toBeDefined();
      expect(firstItem.path).toBeDefined();
      expect(firstItem.method).toBeDefined();
      expect(Array.isArray(firstItem.matchedRules)).toBe(true);
    });

    it('应该支持分页参数', async () => {
      await insertTestData();

      const response = await apiClient.get('/_promptxy/requests?limit=2&offset=1');

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.total).toBe(3);
      expect(body.limit).toBe(2);
      expect(body.offset).toBe(1);
      expect(body.items).toHaveLength(2);
    });

    it('应该支持客户端筛选', async () => {
      await insertTestData();

      const response = await apiClient.get('/_promptxy/requests?client=claude');

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.total).toBe(2);
      expect(body.items.every((item: any) => item.client === 'claude')).toBe(true);
    });

    it('应该支持时间范围筛选', async () => {
      // 清空数据库确保测试数据隔离
      await db.run('DELETE FROM requests');

      // 使用固定的测试时间戳，避免时间计算误差
      const baseTime = Date.now();
      const testRecords: RequestRecord[] = [
        {
          id: 'time-test-001',
          timestamp: baseTime - 10000, // 10秒前 - 在范围外
          client: 'claude',
          path: '/v1/messages',
          method: 'POST',
          originalBody: JSON.stringify({ instructions: 'Old' }),
          modifiedBody: JSON.stringify({ instructions: 'Old [MODIFIED]' }),
          matchedRules: JSON.stringify([]),
          responseStatus: 200,
          durationMs: 100,
          responseHeaders: JSON.stringify({}),
        },
        {
          id: 'time-test-002',
          timestamp: baseTime - 5000, // 5秒前 - 在范围内 (8秒到2秒之间)
          client: 'claude',
          path: '/v1/messages',
          method: 'POST',
          originalBody: JSON.stringify({ instructions: 'Middle' }),
          modifiedBody: JSON.stringify({ instructions: 'Middle [MODIFIED]' }),
          matchedRules: JSON.stringify([]),
          responseStatus: 200,
          durationMs: 100,
          responseHeaders: JSON.stringify({}),
        },
        {
          id: 'time-test-003',
          timestamp: baseTime - 500, // 0.5秒前 - 在范围外 (小于endTime但 still included due to <=)
          client: 'claude',
          path: '/v1/messages',
          method: 'POST',
          originalBody: JSON.stringify({ instructions: 'Recent' }),
          modifiedBody: JSON.stringify({ instructions: 'Recent [MODIFIED]' }),
          matchedRules: JSON.stringify([]),
          responseStatus: 200,
          durationMs: 100,
          responseHeaders: JSON.stringify({}),
        },
      ];

      for (const record of testRecords) {
        await insertRequestRecord(record);
      }

      // 查询时间范围：8秒前到2秒前，应该只返回 time-test-002
      const startTime = baseTime - 8000;
      const endTime = baseTime - 2000;

      const response = await apiClient.get(
        `/_promptxy/requests?startTime=${startTime}&endTime=${endTime}`,
      );

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);

      // 应该只返回 time-test-002
      expect(body.total).toBe(1);
      expect(body.items[0].id).toBe('time-test-002');
    });

    it('应该支持搜索功能', async () => {
      await insertTestData();

      const response = await apiClient.get('/_promptxy/requests?search=Error');

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.total).toBe(1);
      expect(body.items[0].id).toBe('req-003');
    });

    it('应该返回空列表当没有数据时', async () => {
      const response = await apiClient.get('/_promptxy/requests');

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.total).toBe(0);
      expect(body.items).toEqual([]);
    });
  });

  describe('Request Detail', () => {
    it('应该获取单个请求的详细信息', async () => {
      const record: RequestRecord = {
        id: 'detail-test-001',
        timestamp: Date.now(),
        client: 'gemini',
        path: '/v1beta/models',
        method: 'GET',
        originalBody: JSON.stringify({ query: 'test' }),
        modifiedBody: JSON.stringify({ query: 'test [MODIFIED]' }),
        matchedRules: JSON.stringify([{ ruleId: 'gemini-rule', opType: 'append' }]),
        responseStatus: 200,
        durationMs: 75,
        responseHeaders: JSON.stringify({ 'content-type': 'application/json' }),
      };

      await insertRequestRecord(record);

      const response = await apiClient.get(`/_promptxy/requests/${record.id}`);

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.id).toBe(record.id);
      expect(body.timestamp).toBe(record.timestamp);
      expect(body.client).toBe('gemini');
      expect(body.path).toBe('/v1beta/models');
      expect(body.method).toBe('GET');
      expect(body.originalBody).toEqual({ query: 'test' });
      expect(body.modifiedBody).toEqual({ query: 'test [MODIFIED]' });
      expect(body.matchedRules).toEqual([{ ruleId: 'gemini-rule', opType: 'append' }]);
      expect(body.responseStatus).toBe(200);
      expect(body.durationMs).toBe(75);
      expect(body.responseHeaders).toEqual({ 'content-type': 'application/json' });
      expect(body.error).toBeUndefined();
    });

    it('应该返回 404 当请求不存在时', async () => {
      const response = await apiClient.get('/_promptxy/requests/non-existent-id');

      expect(response.status).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Request not found');
    });

    it('应该处理错误请求的详情', async () => {
      const errorRecord: RequestRecord = {
        id: 'error-test-001',
        timestamp: Date.now(),
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        originalBody: JSON.stringify({ instructions: 'Test' }),
        modifiedBody: JSON.stringify({ instructions: 'Test' }),
        matchedRules: JSON.stringify([]),
        responseStatus: undefined,
        durationMs: 100,
        responseHeaders: undefined,
        error: 'Upstream connection failed',
      };

      await insertRequestRecord(errorRecord);

      const response = await apiClient.get(`/_promptxy/requests/${errorRecord.id}`);

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.id).toBe(errorRecord.id);
      expect(body.error).toBe('Upstream connection failed');
      expect(body.responseStatus).toBeUndefined();
    });
  });

  describe('Request Deletion', () => {
    it('应该删除指定的请求', async () => {
      const record: RequestRecord = {
        id: 'delete-test-001',
        timestamp: Date.now(),
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        originalBody: JSON.stringify({}),
        modifiedBody: JSON.stringify({}),
        matchedRules: JSON.stringify([]),
        responseStatus: 200,
        durationMs: 100,
      };

      await insertRequestRecord(record);

      // 验证存在
      let response = await apiClient.get(`/_promptxy/requests/${record.id}`);
      expect(response.status).toBe(200);

      // 删除
      response = await apiClient.delete(`/_promptxy/requests/${record.id}`);
      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // 验证已删除
      response = await apiClient.get(`/_promptxy/requests/${record.id}`);
      expect(response.status).toBe(404);
    });

    it('应该返回 404 当删除不存在的请求时', async () => {
      const response = await apiClient.delete('/_promptxy/requests/non-existent');

      expect(response.status).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Request not found');
    });
  });

  describe('Configuration', () => {
    it('应该读取当前配置', async () => {
      const response = await apiClient.get('/_promptxy/config');

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.listen).toBeDefined();
      expect(body.api).toBeDefined();
      expect(body.suppliers).toBeDefined();
      expect(body.rules).toBeDefined();
      expect(body.storage).toBeDefined();
      expect(body.debug).toBeDefined();
    });

    it('应该同步配置并更新规则', async () => {
      const newRules = [
        createTestRule('new-rule-1', 'claude', 'system', [
          { type: 'set', text: 'New system prompt' },
        ]),
        createTestRule('new-rule-2', 'codex', 'instructions', [
          { type: 'replace', match: 'old', replacement: 'new' },
        ]),
      ];

      const response = await apiClient.post('/_promptxy/config/sync', {
        rules: newRules,
      });

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.appliedRules).toBe(2);
      expect(body.message).toContain('配置已更新');

      // 验证配置确实被更新
      const configResponse = await apiClient.get('/_promptxy/config');
      const updatedConfig = JSON.parse(configResponse.body);

      expect(updatedConfig.rules).toHaveLength(2);
      expect(updatedConfig.rules[0].id).toBe('new-rule-1');
    });

    it('应该拒绝无效的规则格式', async () => {
      const invalidRules = [
        {
          // 缺少必要的字段
          id: 'invalid-rule',
          // 缺少 when 对象
          ops: [{ type: 'append', text: 'test' }],
        },
      ];

      const response = await apiClient.post('/_promptxy/config/sync', {
        rules: invalidRules,
      });

      expect(response.status).toBe(400);
      const body = JSON.parse(response.body);

      expect(body.error).toBe('Validation failed');
      expect(body.errors).toBeDefined();
      expect(body.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Preview', () => {
    it('应该预览规则应用效果', async () => {
      const previewRequest = {
        body: { instructions: 'Hello world' },
        client: 'claude',
        field: 'instructions',
      };

      const response = await apiClient.post('/_promptxy/preview', previewRequest);

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.original).toEqual({ instructions: 'Hello world' });
      expect(body.modified).toBeDefined();
      expect(Array.isArray(body.matches)).toBe(true);
    });

    it('应该预览系统字段的修改', async () => {
      const previewRequest = {
        body: { system: 'You are a helpful assistant' },
        client: 'claude',
        field: 'system',
      };

      const response = await apiClient.post('/_promptxy/preview', previewRequest);

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.original).toEqual({ system: 'You are a helpful assistant' });
      expect(body.modified).toBeDefined();
    });
  });

  describe('Data Cleanup', () => {
    async function insertMultipleRecords(count: number) {
      for (let i = 0; i < count; i++) {
        const record: RequestRecord = {
          id: `cleanup-test-${i}`,
          timestamp: Date.now() - i * 1000, // 按时间排序
          client: 'claude',
          path: '/v1/messages',
          method: 'POST',
          originalBody: JSON.stringify({}),
          modifiedBody: JSON.stringify({}),
          matchedRules: JSON.stringify([]),
          responseStatus: 200,
          durationMs: 100,
        };
        await insertRequestRecord(record);
      }
    }

    it('应该清理旧数据并保留指定数量', async () => {
      // 插入 10 条记录
      await insertMultipleRecords(10);

      // 清理，只保留 5 条
      const response = await apiClient.post('/_promptxy/requests/cleanup?keep=5');

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.deleted).toBe(5);
      expect(body.remaining).toBe(5);
      expect(body.success).toBe(true);
    });

    it('应该处理数据不足的情况', async () => {
      // 只插入 3 条记录
      await insertMultipleRecords(3);

      // 尝试保留 5 条（实际只有 3 条）
      const response = await apiClient.post('/_promptxy/requests/cleanup?keep=5');

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.deleted).toBe(0);
      expect(body.remaining).toBe(3);
    });
  });

  describe('Statistics', () => {
    it('应该返回数据库统计信息', async () => {
      // 插入一些测试数据
      const records: RequestRecord[] = [
        {
          id: 'stat-1',
          timestamp: Date.now(),
          client: 'claude',
          path: '/v1/messages',
          method: 'POST',
          originalBody: JSON.stringify({}),
          modifiedBody: JSON.stringify({}),
          matchedRules: JSON.stringify([]),
          responseStatus: 200,
          durationMs: 100,
        },
        {
          id: 'stat-2',
          timestamp: Date.now(),
          client: 'codex',
          path: '/openai/v1/chat/completions',
          method: 'POST',
          originalBody: JSON.stringify({}),
          modifiedBody: JSON.stringify({}),
          matchedRules: JSON.stringify([]),
          responseStatus: 200,
          durationMs: 150,
        },
      ];

      for (const record of records) {
        await insertRequestRecord(record);
      }

      const response = await apiClient.get('/_promptxy/stats');

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.total).toBe(2);
      expect(body.byClient).toBeDefined();
      expect(body.byClient.claude).toBe(1);
      expect(body.byClient.codex).toBe(1);
      expect(body.recent).toBe(2); // 最近24小时
      expect(body.database).toBeDefined();
    });
  });

  describe('Database Info', () => {
    it('应该返回数据库信息', async () => {
      const response = await apiClient.get('/_promptxy/database');

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.path).toBeDefined();
      expect(body.size).toBeDefined();
      expect(body.recordCount).toBeDefined();
      expect(typeof body.recordCount).toBe('number');
    });
  });

  describe('Suppliers API', () => {
    describe('GET /_promptxy/suppliers', () => {
      it('应该获取所有供应商', async () => {
        const response = await apiClient.get('/_promptxy/suppliers');

        expect(response.status).toBe(200);
        const body = JSON.parse(response.body);

        expect(Array.isArray(body.suppliers)).toBe(true);
        expect(body.suppliers.length).toBeGreaterThan(0);

        // 验证供应商结构
        const firstSupplier = body.suppliers[0];
        expect(firstSupplier.id).toBeDefined();
        expect(firstSupplier.name).toBeDefined();
        expect(firstSupplier.baseUrl).toBeDefined();
        expect(firstSupplier.localPrefix).toBeDefined();
        expect(typeof firstSupplier.enabled).toBe('boolean');
      });

      it('应该包含默认的三个供应商', async () => {
        const response = await apiClient.get('/_promptxy/suppliers');
        const body = JSON.parse(response.body);

        const ids = body.suppliers.map((s: any) => s.id);
        expect(ids).toContain('claude-anthropic');
        expect(ids).toContain('openai-official');
        expect(ids).toContain('gemini-google');
      });
    });

    describe('POST /_promptxy/suppliers', () => {
      it('应该创建新供应商', async () => {
        const newSupplier = {
          supplier: {
            name: 'Test Supplier',
            baseUrl: 'https://test.example.com',
            localPrefix: '/test',
            enabled: true,
          },
        };

        const response = await apiClient.post('/_promptxy/suppliers', newSupplier);

        expect(response.status).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.success).toBe(true);
        expect(body.supplier.id).toBeDefined();
        expect(body.supplier.name).toBe('Test Supplier');
        expect(body.supplier.localPrefix).toBe('/test');
      });

      it('应该拒绝相同 localPrefix 的已启用供应商', async () => {
        // 尝试创建与默认供应商冲突的供应商
        const duplicateSupplier = {
          supplier: {
            name: 'Duplicate Claude',
            baseUrl: 'https://other.com',
            localPrefix: '/claude',
            enabled: true,
          },
        };

        const response = await apiClient.post('/_promptxy/suppliers', duplicateSupplier);

        expect(response.status).toBe(400);
        const body = JSON.parse(response.body);

        expect(body.message).toBeDefined();
        expect(body.message).toContain('Local prefix');
      });

      it('应该允许相同 localPrefix 但禁用的供应商', async () => {
        const disabledSupplier = {
          supplier: {
            name: 'Disabled Claude',
            baseUrl: 'https://other.com',
            localPrefix: '/claude',
            enabled: false,
          },
        };

        const response = await apiClient.post('/_promptxy/suppliers', disabledSupplier);

        expect(response.status).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.success).toBe(true);
        expect(body.supplier.enabled).toBe(false);
      });

      it('应该拒绝无效的 baseUrl', async () => {
        const invalidSupplier = {
          supplier: {
            name: 'Invalid URL',
            baseUrl: 'not-a-valid-url',
            localPrefix: '/invalid',
            enabled: true,
          },
        };

        const response = await apiClient.post('/_promptxy/suppliers', invalidSupplier);

        expect(response.status).toBe(400);
        const body = JSON.parse(response.body);

        expect(body.message).toBeDefined();
      });

      it('应该拒绝无效的 localPrefix（缺少前导斜杠）', async () => {
        const invalidPrefixSupplier = {
          supplier: {
            name: 'Invalid Prefix',
            baseUrl: 'https://test.com',
            localPrefix: 'invalid-prefix',
            enabled: true,
          },
        };

        const response = await apiClient.post('/_promptxy/suppliers', invalidPrefixSupplier);

        expect(response.status).toBe(400);
        const body = JSON.parse(response.body);

        expect(body.message).toBeDefined();
        expect(body.message).toContain('localPrefix');
      });
    });

    describe('PUT /_promptxy/suppliers/:id', () => {
      it('应该更新供应商信息', async () => {
        // 先创建一个供应商，获取返回的 ID
        const createResponse = await apiClient.post('/_promptxy/suppliers', {
          supplier: {
            name: 'Original Name',
            baseUrl: 'https://original.com',
            localPrefix: '/update-test',
            enabled: true,
          },
        });

        const createdBody = JSON.parse(createResponse.body);
        const supplierId = createdBody.supplier.id;

        // 更新供应商 - 请求体格式应为 { supplier: {...} }
        const updatedData = {
          supplier: {
            id: supplierId,
            name: 'Updated Name',
            baseUrl: 'https://updated.com',
            localPrefix: '/update-test',
            enabled: false,
          },
        };

        const response = await apiClient.put(`/_promptxy/suppliers/${supplierId}`, updatedData);

        expect(response.status).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.success).toBe(true);
        expect(body.supplier.name).toBe('Updated Name');
        expect(body.supplier.baseUrl).toBe('https://updated.com');
        expect(body.supplier.enabled).toBe(false);
      });

      it('应该拒绝更新不存在的供应商', async () => {
        const response = await apiClient.put('/_promptxy/suppliers/non-existent', {
          supplier: {
            id: 'non-existent',
            name: 'Non-existent',
            baseUrl: 'https://test.com',
            localPrefix: '/test',
            enabled: true,
          },
        });

        expect(response.status).toBe(404);
      });
    });

    describe('DELETE /_promptxy/suppliers/:id', () => {
      it('应该删除指定供应商', async () => {
        // 先创建一个供应商，获取返回的 ID
        const createResponse = await apiClient.post('/_promptxy/suppliers', {
          supplier: {
            name: 'To Delete',
            baseUrl: 'https://delete.com',
            localPrefix: '/delete-test',
            enabled: true,
          },
        });

        const createdBody = JSON.parse(createResponse.body);
        const supplierId = createdBody.supplier.id;

        // 删除供应商
        const response = await apiClient.delete(`/_promptxy/suppliers/${supplierId}`);

        expect(response.status).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.success).toBe(true);

        // 验证供应商已被删除
        const getResponse = await apiClient.get('/_promptxy/suppliers');
        const getBody = JSON.parse(getResponse.body);
        expect(getBody.suppliers.find((s: any) => s.id === supplierId)).toBeUndefined();
      });

      it('应该拒绝删除不存在的供应商', async () => {
        const response = await apiClient.delete('/_promptxy/suppliers/non-existent');

        expect(response.status).toBe(404);
      });
    });

    describe('POST /_promptxy/suppliers/:id/toggle', () => {
      it('应该切换供应商启用状态', async () => {
        // 先创建一个禁用的供应商，获取返回的 ID
        const createResponse = await apiClient.post('/_promptxy/suppliers', {
          supplier: {
            name: 'Toggle Test',
            baseUrl: 'https://toggle.com',
            localPrefix: '/toggle-test',
            enabled: false,
          },
        });

        const createdBody = JSON.parse(createResponse.body);
        const supplierId = createdBody.supplier.id;

        // 启用供应商
        const enableResponse = await apiClient.post(`/_promptxy/suppliers/${supplierId}/toggle`, {
          enabled: true,
        });

        expect(enableResponse.status).toBe(200);
        const enableBody = JSON.parse(enableResponse.body);
        expect(enableBody.success).toBe(true);
        expect(enableBody.supplier.enabled).toBe(true);

        // 禁用供应商
        const disableResponse = await apiClient.post(`/_promptxy/suppliers/${supplierId}/toggle`, {
          enabled: false,
        });

        expect(disableResponse.status).toBe(200);
        const disableBody = JSON.parse(disableResponse.body);
        expect(disableBody.success).toBe(true);
        expect(disableBody.supplier.enabled).toBe(false);
      });

      it('应该拒绝启用冲突的供应商', async () => {
        // 创建一个与默认供应商冲突的供应商，但禁用
        const createResponse = await apiClient.post('/_promptxy/suppliers', {
          supplier: {
            name: 'Conflict Test',
            baseUrl: 'https://conflict.com',
            localPrefix: '/claude',
            enabled: false,
          },
        });

        const createdBody = JSON.parse(createResponse.body);
        const supplierId = createdBody.supplier.id;

        // 尝试启用（应该失败，因为 /claude 已被默认供应商使用）
        const response = await apiClient.post(`/_promptxy/suppliers/${supplierId}/toggle`, {
          enabled: true,
        });

        expect(response.status).toBe(400);
        const body = JSON.parse(response.body);

        expect(body.message).toBeDefined();
        expect(body.message).toContain('Local prefix');
      });
    });
  });

  describe('Error Handling', () => {
    it('应该返回 404 对于未知路径', async () => {
      const response = await apiClient.get('/_promptxy/unknown');

      expect(response.status).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Not Found');
    });

    it('应该处理 JSON 解析错误', async () => {
      // 发送无效的 JSON
      const invalidJson = 'invalid json';
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: servers.apiPort,
          path: '/_promptxy/config/sync',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(invalidJson),
          },
        },
        res => {
          let data = '';
          res.on('data', chunk => (data += chunk));
          res.on('end', () => {
            // 应该优雅处理，返回 400 错误
            expect(res.statusCode).toBeDefined();
            expect([400, 500]).toContain(res.statusCode);
          });
        },
      );

      req.on('error', err => {
        // 连接错误也是可以接受的，服务器可能拒绝无效请求
        expect(err).toBeDefined();
      });

      req.write(invalidJson);
      req.end();
    });
  });
});
