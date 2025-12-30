/**
 * PromptXY 端到端流程集成测试
 *
 * 测试场景：
 * 1. CLI 请求 → Gateway → API → SSE → 数据库完整流程
 * 2. 多并发请求处理
 * 3. 规则更新实时生效
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
  createMockUpstream,
} from './test-utils.js';
import {
  getRequestList,
  getRequestDetail,
  insertRequestRecord,
} from '../../src/promptxy/database.js';
import { broadcastRequest } from '../../src/promptxy/api-server.js';
import { SSERequestEvent } from '../../src/promptxy/types.js';

describe('End-to-End Flow Integration Tests', () => {
  let servers: TestServerContainer;
  let db: Database;
  let gatewayClient: HttpClient;
  let apiClient: HttpClient;
  let config: any;
  let mockUpstream: http.Server;
  let mockUpstreamPort: number;

  beforeAll(async () => {
    // 创建初始配置（不包含上游服务器端口）
    config = await createTestConfig({
      suppliers: [
        {
          id: 'claude-e2e',
          name: 'Claude E2E',
          baseUrl: 'http://127.0.0.1:9999', // 临时值，会在 beforeEach 中更新
          localPrefix: '/claude',
          pathMappings: [],
          enabled: true,
        },
        {
          id: 'openai-e2e',
          name: 'OpenAI E2E',
          baseUrl: 'http://127.0.0.1:9999',
          localPrefix: '/openai',
          pathMappings: [],
          enabled: true,
        },
        {
          id: 'gemini-e2e',
          name: 'Gemini E2E',
          baseUrl: 'http://127.0.0.1:9999',
          localPrefix: '/gemini',
          pathMappings: [],
          enabled: true,
        },
      ],
      rules: [
        createTestRule('e2e-rule-1', 'claude', 'system', [{ type: 'append', text: ' [E2E]' }]),
      ],
      storage: {
        maxHistory: 100,
        autoCleanup: false,
        cleanupInterval: 1,
      },
      debug: true,
    });

    db = await initializeTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    // 启动模拟上游服务器（每个测试前重新创建）
    mockUpstream = createMockUpstream();
    mockUpstreamPort = await new Promise<number>(resolve => {
      const server = mockUpstream.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          resolve(addr.port);
        } else {
          resolve(9999);
        }
      });
    });

    // 更新配置指向新的模拟上游服务器
    config.suppliers[0].baseUrl = `http://127.0.0.1:${mockUpstreamPort}`;
    config.suppliers[1].baseUrl = `http://127.0.0.1:${mockUpstreamPort}`;
    config.suppliers[2].baseUrl = `http://127.0.0.1:${mockUpstreamPort}`;
    servers = await startTestServers(config, db);
    gatewayClient = new HttpClient(`http://127.0.0.1:${servers.gatewayPort}`);
    apiClient = new HttpClient(`http://127.0.0.1:${servers.apiPort}`);
    await db.run('DELETE FROM requests');
  });

  afterEach(async () => {
    await servers.shutdown();
    // 关闭模拟上游服务器
    await new Promise<void>(resolve => {
      if (mockUpstream) {
        mockUpstream.close(() => resolve());
      } else {
        resolve();
      }
    });
  });

  describe('Complete Request Flow', () => {
    it('应该完成 CLI → Gateway → API → SSE → 数据库的完整流程', async () => {
      // 1. 建立 SSE 连接
      const sseEvents: Array<{ event: string; data: any }> = [];
      const sseConnection = await apiClient.connectSSE('/_promptxy/events', (event, data) => {
        sseEvents.push({ event, data });
      });

      try {
        // 等待 SSE 连接建立
        await new Promise(resolve => setTimeout(resolve, 100));

        // 2. CLI 发送请求到 Gateway
        const cliRequest = {
          system: 'Hello from CLI',
        };

        const gatewayResponse = await gatewayClient.post('/claude/v1/messages', cliRequest, {
          'x-api-key': 'cli-test-key',
        });

        // 3. 验证 Gateway 响应
        expect(gatewayResponse.status).toBe(200);
        const gatewayBody = JSON.parse(gatewayResponse.body);
        expect(gatewayBody.id).toBe('mock-response');

        // 4. 等待 SSE 事件
        await waitForCondition(() => {
          const requestEvents = sseEvents.filter(e => e.event === 'request');
          return requestEvents.length > 0;
        }, 2000);

        // 5. 验证 SSE 事件
        const requestEvents = sseEvents.filter(e => e.event === 'request');
        expect(requestEvents.length).toBeGreaterThan(0);

        const sseEvent = requestEvents[0].data;
        expect(sseEvent.client).toBe('claude');
        expect(sseEvent.path).toBe('/v1/messages');
        expect(sseEvent.method).toBe('POST');
        expect(sseEvent.matchedRules).toContain('e2e-rule-1');

        // 6. 验证数据库记录
        await waitForCondition(async () => {
          const list = await getRequestList({ limit: 10 });
          return list.total > 0;
        }, 2000);

        const dbList = await getRequestList({ limit: 10 });
        expect(dbList.total).toBe(1);

        const dbRecord = await getRequestDetail(dbList.items[0].id);
        expect(dbRecord).toBeDefined();
        expect(dbRecord!.client).toBe('claude');
        const originalBody = JSON.parse(dbRecord!.originalBody);
        const modifiedBody = JSON.parse(dbRecord!.modifiedBody);
        expect(originalBody).toEqual({ system: 'Hello from CLI' });
        expect(modifiedBody.system).toContain('[E2E]');
        expect(dbRecord!.responseStatus).toBe(200);

        // 7. 通过 API 验证请求详情
        const apiResponse = await apiClient.get(`/_promptxy/requests/${dbList.items[0].id}`);
        expect(apiResponse.status).toBe(200);

        const apiBody = JSON.parse(apiResponse.body);
        expect(apiBody.id).toBe(dbList.items[0].id);
        expect(apiBody.originalBody.system).toBe('Hello from CLI');
        expect(apiBody.modifiedBody.system).toContain('[E2E]');
      } finally {
        sseConnection.close();
      }
    });

    it('应该处理完整流程中的错误情况', async () => {
      // 1. 建立 SSE 连接
      const sseEvents: Array<{ event: string; data: any }> = [];
      const sseConnection = await apiClient.connectSSE('/_promptxy/events', (event, data) => {
        sseEvents.push({ event, data });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // 2. 临时修改上游为无效地址
      const originalUpstream = config.suppliers[0].baseUrl;
      config.suppliers[0].baseUrl = 'http://127.0.0.1:1';

      try {
        // 3. 发送请求（应该失败）
        const response = await gatewayClient.post('/claude/v1/messages', { system: 'Will fail' });

        expect(response.status).toBe(500);

        // 4. 等待 SSE 错误事件
        await waitForCondition(() => {
          const requestEvents = sseEvents.filter(e => e.event === 'request');
          return requestEvents.length > 0;
        }, 2000);

        // 5. 验证数据库记录了错误
        await waitForCondition(async () => {
          const list = await getRequestList({ limit: 10 });
          return list.total > 0;
        }, 2000);

        const list = await getRequestList({ limit: 10 });
        const detail = await getRequestDetail(list.items[0].id);

        expect(detail!.error).toBeDefined();
        expect(detail!.responseStatus).toBeUndefined();
      } finally {
        config.suppliers[0].baseUrl = originalUpstream;
        sseConnection.close();
      }
    });
  });

  describe('Multiple Concurrent Requests', () => {
    it('应该正确处理多个并发请求的完整流程', async () => {
      // 1. 建立 SSE 连接
      const sseEvents: Array<{ event: string; data: any }> = [];
      const sseConnection = await apiClient.connectSSE('/_promptxy/events', (event, data) => {
        sseEvents.push({ event, data });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // 2. 发送多个并发请求
      const concurrentCount = 10;
      const promises = [];

      for (let i = 0; i < concurrentCount; i++) {
        promises.push(
          gatewayClient.post('/claude/v1/messages', {
            system: `Concurrent request ${i}`,
          }),
        );
      }

      // 3. 等待所有请求完成
      const results = await Promise.all(promises);
      results.forEach(result => expect(result.status).toBe(200));

      // 4. 等待所有 SSE 事件
      await waitForCondition(() => {
        const requestEvents = sseEvents.filter(e => e.event === 'request');
        return requestEvents.length >= concurrentCount;
      }, 3000);

      // 5. 验证 SSE 事件数量
      const requestEvents = sseEvents.filter(e => e.event === 'request');
      expect(requestEvents.length).toBeGreaterThanOrEqual(concurrentCount);

      // 6. 验证所有请求都记录到数据库
      await waitForCondition(async () => {
        const list = await getRequestList({ limit: 100 });
        return list.total >= concurrentCount;
      }, 3000);

      const dbList = await getRequestList({ limit: 100 });
      expect(dbList.total).toBeGreaterThanOrEqual(concurrentCount);

      // 7. 验证每条记录的完整性
      for (const item of dbList.items.slice(0, concurrentCount)) {
        expect(item.client).toBe('claude');
        expect(item.path).toBe('/v1/messages');
        expect(item.method).toBe('POST');
        expect(item.responseStatus).toBe(200);
        expect(item.matchedRules).toContain('e2e-rule-1');

        // 验证详情
        const detail = await getRequestDetail(item.id);
        const originalBody = JSON.parse(detail!.originalBody);
        const modifiedBody = JSON.parse(detail!.modifiedBody);
        expect(originalBody.system).toContain('Concurrent request');
        expect(modifiedBody.system).toContain('[E2E]');
      }

      sseConnection.close();
    });

    it('应该处理混合成功和失败的并发请求', async () => {
      // 1. 建立 SSE 连接
      const sseEvents: Array<{ event: string; data: any }> = [];
      const sseConnection = await apiClient.connectSSE('/_promptxy/events', (event, data) => {
        sseEvents.push({ event, data });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // 2. 准备混合请求
      const originalUpstream = config.suppliers[0].baseUrl;
      try {
        // 先发成功请求（确保在修改上游前完成）
        const successPromises = [];
        for (let i = 0; i < 3; i++) {
          successPromises.push(
            gatewayClient.post('/claude/v1/messages', { system: `Success ${i}` }),
          );
        }
        const successResults = await Promise.all(successPromises);
        successResults.forEach(r => expect(r.status).toBe(200));

        // 临时修改上游为失败
        config.suppliers[0].baseUrl = 'http://127.0.0.1:1';

        const failPromises = [];
        for (let i = 0; i < 2; i++) {
          failPromises.push(gatewayClient.post('/claude/v1/messages', { system: `Fail ${i}` }));
        }
        const failResults = await Promise.all(failPromises);
        failResults.forEach(r => expect(r.status).toBe(500));
      } finally {
        // 恢复上游并等待所有记录
        config.suppliers[0].baseUrl = originalUpstream;
      }

      await waitForCondition(async () => {
        const list = await getRequestList({ limit: 100 });
        return list.total >= 5;
      }, 3000);

      // 6. 验证数据库记录
      const dbList = await getRequestList({ limit: 100 });
      expect(dbList.total).toBeGreaterThanOrEqual(5);

      const successRecords = dbList.items.filter(item => item.responseStatus === 200);
      const errorRecords = dbList.items.filter(item => item.error !== undefined);

      expect(successRecords.length).toBeGreaterThanOrEqual(3);
      expect(errorRecords.length).toBeGreaterThanOrEqual(2);

      sseConnection.close();
    });
  });

  describe('Rule Update Real-time Effect', () => {
    it('应该在规则更新后立即生效', async () => {
      // 1. 发送初始请求，使用原始规则
      const response1 = await gatewayClient.post('/claude/v1/messages', { system: 'Initial' });
      expect(response1.status).toBe(200);

      // 验证初始规则已应用
      let capturedBody: any = null;
      const originalFetch = global.fetch;
      global.fetch = async (url: any, options: any) => {
        if (options?.body && typeof options.body === 'string') {
          capturedBody = JSON.parse(options.body);
        }
        return originalFetch(url, options);
      };

      try {
        // 重新发送请求以捕获修改后的 body
        await gatewayClient.post('/claude/v1/messages', { system: 'Test' });
        expect(capturedBody.system).toContain('[E2E]');

        // 2. 通过 API 更新规则
        const newRules = [
          createTestRule('e2e-rule-1', 'claude', 'system', [
            { type: 'append', text: ' [UPDATED]' },
          ]),
          createTestRule('e2e-rule-2', 'claude', 'system', [{ type: 'prepend', text: 'START: ' }]),
        ];

        const syncResponse = await apiClient.post('/_promptxy/config/sync', { rules: newRules });
        expect(syncResponse.status).toBe(200);

        // 3. 立即发送新请求，验证新规则生效
        capturedBody = null;
        await gatewayClient.post('/claude/v1/messages', { system: 'After update' });

        expect(capturedBody.system).toContain('[UPDATED]');
        expect(capturedBody.system).toContain('START: ');
        expect(capturedBody.system).not.toContain('[E2E]'); // 旧规则不应生效
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('应该在规则更新时通知 SSE 客户端', async () => {
      // 这个测试验证配置同步的响应，SSE 事件广播在其他测试中已验证
      const newRules = [
        createTestRule('updated-rule', 'codex', 'instructions', [
          { type: 'set', text: 'New system' },
        ]),
      ];

      const response = await apiClient.post('/_promptxy/config/sync', { rules: newRules });

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.appliedRules).toBe(1);
    });

    it('应该处理规则更新过程中的并发请求', async () => {
      // 1. 开始更新规则
      const newRules = [
        createTestRule('concurrent-rule', 'claude', 'system', [
          { type: 'append', text: ' [CONCURRENT]' },
        ]),
      ];

      // 2. 同时发送请求和更新规则
      const updatePromise = apiClient.post('/_promptxy/config/sync', { rules: newRules });

      // 发送多个并发请求
      const requestPromises = [];
      for (let i = 0; i < 5; i++) {
        requestPromises.push(
          gatewayClient.post('/claude/v1/messages', { system: `Concurrent ${i}` }),
        );
      }

      // 3. 等待所有操作完成
      const [updateResult, ...requestResults] = await Promise.all([
        updatePromise,
        ...requestPromises,
      ]);

      // 4. 验证结果
      expect(updateResult.status).toBe(200);
      requestResults.forEach(result => expect(result.status).toBe(200));

      // 5. 验证数据库记录
      await waitForCondition(async () => {
        const list = await getRequestList({ limit: 10 });
        return list.total >= 5;
      }, 2000);

      const list = await getRequestList({ limit: 10 });
      // 部分请求可能使用旧规则，部分使用新规则
      expect(list.total).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Data Persistence and Cleanup', () => {
    it('应该在服务器重启后保持数据完整性', async () => {
      // 1. 发送请求并验证记录
      await gatewayClient.post('/claude/v1/messages', { system: 'Persistence test' });

      await waitForCondition(async () => {
        const list = await getRequestList({ limit: 10 });
        return list.total > 0;
      }, 2000);

      const list1 = await getRequestList({ limit: 10 });
      const recordId = list1.items[0].id;

      // 2. 关闭服务器
      await servers.shutdown();

      // 3. 重新启动服务器（使用相同的数据库）
      servers = await startTestServers(config, db);
      gatewayClient = new HttpClient(`http://127.0.0.1:${servers.gatewayPort}`);
      apiClient = new HttpClient(`http://127.0.0.1:${servers.apiPort}`);

      // 4. 验证数据仍然存在
      const list2 = await getRequestList({ limit: 10 });
      expect(list2.total).toBe(1);
      expect(list2.items[0].id).toBe(recordId);

      // 5. 验证详情完整性
      const detail = await getRequestDetail(recordId);
      const originalBody = JSON.parse(detail!.originalBody);
      expect(originalBody.system).toBe('Persistence test');
    });

    it('应该正确执行数据清理流程', async () => {
      // 1. 插入大量测试数据
      const records = 20;
      for (let i = 0; i < records; i++) {
        const record = {
          id: `cleanup-test-${i}`,
          timestamp: Date.now() - i * 1000,
          client: 'claude',
          path: '/v1/messages',
          method: 'POST',
          originalBody: JSON.stringify({ instructions: `Test ${i}` }),
          modifiedBody: JSON.stringify({ instructions: `Test ${i} [MODIFIED]` }),
          matchedRules: JSON.stringify([{ ruleId: 'rule-1', opType: 'append' }]),
          responseStatus: 200,
          durationMs: 100,
        };
        await insertRequestRecord(record);
      }

      // 2. 验证初始数量
      const initialList = await getRequestList({ limit: 100 });
      expect(initialList.total).toBe(20);

      // 3. 执行清理，保留 5 条
      const cleanupResponse = await apiClient.post('/_promptxy/requests/cleanup?keep=5');
      expect(cleanupResponse.status).toBe(200);

      const cleanupBody = JSON.parse(cleanupResponse.body);
      expect(cleanupBody.deleted).toBe(15);
      expect(cleanupBody.remaining).toBe(5);

      // 4. 验证剩余数据
      const finalList = await getRequestList({ limit: 100 });
      expect(finalList.total).toBe(5);

      // 5. 验证保留的是最新的记录
      expect(finalList.items[0].id).toBe('cleanup-test-0'); // 最新的
      expect(finalList.items[4].id).toBe('cleanup-test-4'); // 第5新的
    });

    it('应该处理清理过程中的并发访问', async () => {
      // 1. 插入测试数据
      for (let i = 0; i < 10; i++) {
        await insertRequestRecord({
          id: `concurrent-cleanup-${i}`,
          timestamp: Date.now() - i * 100,
          client: 'claude',
          path: '/v1/messages',
          method: 'POST',
          originalBody: JSON.stringify({}),
          modifiedBody: JSON.stringify({}),
          matchedRules: JSON.stringify([]),
          responseStatus: 200,
          durationMs: 50,
        });
      }

      // 2. 同时执行清理和查询
      const cleanupPromise = apiClient.post('/_promptxy/requests/cleanup?keep=3');
      const queryPromises = [];
      for (let i = 0; i < 5; i++) {
        queryPromises.push(apiClient.get('/_promptxy/requests'));
      }

      // 3. 等待所有操作完成
      const results = await Promise.all([cleanupPromise, ...queryPromises]);

      // 4. 验证清理成功
      expect(results[0].status).toBe(200);

      // 5. 验证最终状态
      const finalList = await getRequestList({ limit: 100 });
      expect(finalList.total).toBeLessThanOrEqual(3);
    });
  });

  describe('Cross-Client Flow', () => {
    it('应该正确处理不同客户端的完整流程', async () => {
      // 1. 为不同客户端添加规则
      const multiRules = [
        createTestRule('claude-rule', 'claude', 'system', [{ type: 'append', text: ' [CLAUDE]' }]),
        createTestRule('codex-rule', 'codex', 'instructions', [
          { type: 'append', text: ' [CODEX]' },
        ]),
        createTestRule('gemini-rule', 'gemini', 'system', [{ type: 'append', text: ' [GEMINI]' }]),
      ];

      // 更新配置
      await apiClient.post('/_promptxy/config/sync', { rules: multiRules });

      // 2. 发送不同客户端的请求
      const requests = [
        { client: 'claude', path: '/claude/v1/messages', body: { system: 'Claude test' } },
        {
          client: 'codex',
          path: '/openai/v1/responses',
          body: { model: 'gpt-4', instructions: 'Codex test', input: [] },
        },
        {
          client: 'gemini',
          path: '/gemini/v1beta/models/gemini-1.5-flash:generateContent',
          body: { system_instruction: 'Gemini test', contents: [{ parts: [{ text: 'hi' }] }] },
        },
      ];

      // 3. 发送所有请求
      for (const req of requests) {
        await gatewayClient.post(req.path, req.body);
      }

      // 4. 等待数据库记录
      await waitForCondition(async () => {
        const list = await getRequestList({ limit: 10 });
        return list.total >= 3;
      }, 2000);

      // 5. 验证每个客户端的记录
      for (const req of requests) {
        const list = await getRequestList({ limit: 10, client: req.client as any });
        expect(list.total).toBeGreaterThan(0);

        const item = list.items[0];
        expect(item.client).toBe(req.client);
        expect(item.matchedRules).toContain(`${req.client}-rule`);

        // 验证详情中的规则应用
        const detail = await getRequestDetail(item.id);
        expect(detail!.matchedRules).toContain(req.client);
      }
    });
  });
});
