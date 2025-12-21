/**
 * PromptXY Gateway 集成测试
 *
 * 测试场景：
 * 1. 请求捕获和转发
 * 2. 规则应用验证
 * 3. 数据库记录验证
 * 4. SSE 事件广播验证
 * 5. 错误处理（上游错误、网络问题）
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
import { getRequestList, getRequestDetail } from '../../src/promptxy/database.js';

describe('Gateway Integration Tests', () => {
  let servers: TestServerContainer;
  let db: Database;
  let gatewayClient: HttpClient;
  let apiClient: HttpClient;
  let config: any;
  let mockUpstream: http.Server;
  let mockUpstreamPort: number;

  beforeAll(async () => {
    // 初始化测试配置（不包含上游服务器端口）
    config = await createTestConfig({
      upstreams: {
        anthropic: 'http://127.0.0.1:9999', // 临时值，会在 beforeEach 中更新
        openai: 'http://127.0.0.1:9999',
        gemini: 'http://127.0.0.1:9999',
      },
      rules: [
        createTestRule('gateway-rule-1', 'claude', 'instructions', [
          { type: 'append', text: ' [GATEWAY-MODIFIED]' },
        ]),
        createTestRule('gateway-rule-2', 'codex', 'instructions', [
          { type: 'prepend', text: 'PREFIX: ' },
        ]),
      ],
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
    config.upstreams = {
      anthropic: `http://127.0.0.1:${mockUpstreamPort}`,
      openai: `http://127.0.0.1:${mockUpstreamPort}`,
      gemini: `http://127.0.0.1:${mockUpstreamPort}`,
    };

    // 启动服务器
    servers = await startTestServers(config, db);
    gatewayClient = new HttpClient(`http://127.0.0.1:${servers.gatewayPort}`);
    apiClient = new HttpClient(`http://127.0.0.1:${servers.apiPort}`);

    // 清空数据库
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

  describe('Request Forwarding', () => {
    it('应该转发 Claude 请求到上游', async () => {
      const requestBody = {
        instructions: 'Hello world',
        model: 'claude-3-5-sonnet-20241022',
      };

      const response = await gatewayClient.post('/v1/messages', requestBody, {
        'x-api-key': 'test-key',
        'anthropic-version': '2023-06-01',
      });

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);

      // 验证从模拟上游返回的数据
      expect(body.id).toBe('mock-response');
      expect(body.content).toBeDefined();
    });

    it('应该转发 Codex 请求到上游', async () => {
      const requestBody = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Test' }],
      };

      const response = await gatewayClient.post('/openai/v1/chat/completions', requestBody, {
        authorization: 'Bearer test-key',
      });

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe('mock-response');
    });

    it('应该转发 Gemini 请求到上游', async () => {
      const requestBody = {
        contents: [{ parts: [{ text: 'Hello' }] }],
      };

      const response = await gatewayClient.post(
        '/gemini/v1beta/models/gemini-1.5-flash:generateContent',
        requestBody,
        {
          'x-goog-api-key': 'test-key',
        },
      );

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe('mock-response');
    });

    it('应该保留上游响应头', async () => {
      const response = await gatewayClient.post('/v1/messages', {
        instructions: 'test',
      });

      expect(response.status).toBe(200);
      // 模拟上游返回 content-type: application/json
      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  describe('Rule Application', () => {
    it('应该应用规则修改请求体', async () => {
      const originalBody = {
        instructions: 'Hello world',
      };

      // 捕获实际发送到上游的请求体
      let capturedUpstreamBody: any = null;
      const originalFetch = global.fetch;
      global.fetch = async (url: any, options: any) => {
        if (options?.body && typeof options.body === 'string') {
          capturedUpstreamBody = JSON.parse(options.body);
        }
        return originalFetch(url, options);
      };

      try {
        await gatewayClient.post('/v1/messages', originalBody);

        // 验证规则已应用
        expect(capturedUpstreamBody).toBeDefined();
        expect(capturedUpstreamBody.instructions).toContain('[GATEWAY-MODIFIED]');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('应该为不同客户端应用对应规则', async () => {
      // Codex 规则应该添加前缀
      let capturedBody: any = null;
      const originalFetch = global.fetch;
      global.fetch = async (url: any, options: any) => {
        if (options?.body && typeof options.body === 'string') {
          capturedBody = JSON.parse(options.body);
        }
        return originalFetch(url, options);
      };

      try {
        await gatewayClient.post('/openai/v1/chat/completions', {
          messages: [{ role: 'user', content: 'Test' }],
        });

        // 验证 Codex 规则已应用（添加前缀）
        expect(capturedBody.messages[0].content).toContain('PREFIX: ');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('应该记录匹配的规则到数据库', async () => {
      const requestBody = { instructions: 'Test' };

      await gatewayClient.post('/v1/messages', requestBody);

      // 等待数据库记录完成
      await waitForCondition(async () => {
        const list = await getRequestList({ limit: 10 });
        return list.total > 0;
      }, 2000);

      const list = await getRequestList({ limit: 10 });
      expect(list.total).toBeGreaterThan(0);

      const recordId = list.items[0].id;
      const detail = await getRequestDetail(recordId);

      expect(detail).toBeDefined();
      expect(detail!.matchedRules).toBeDefined();

      const matchedRules = JSON.parse(detail!.matchedRules);
      expect(matchedRules.length).toBeGreaterThan(0);
      expect(matchedRules[0].ruleId).toBe('gateway-rule-1');
      expect(matchedRules[0].opType).toBe('append');
    });
  });

  describe('Database Recording', () => {
    it('应该记录成功请求到数据库', async () => {
      const requestBody = { instructions: 'Record me' };

      await gatewayClient.post('/v1/messages', requestBody);

      // 等待异步记录
      await waitForCondition(async () => {
        const list = await getRequestList({ limit: 10 });
        return list.total > 0;
      }, 2000);

      const list = await getRequestList({ limit: 10 });
      const item = list.items[0];

      expect(item.client).toBe('claude');
      expect(item.path).toBe('/v1/messages');
      expect(item.method).toBe('POST');
      expect(item.responseStatus).toBe(200);
      expect(item.durationMs).toBeDefined();
      expect(item.matchedRules).toContain('gateway-rule-1');
    });

    it('应该记录原始和修改后的请求体', async () => {
      const requestBody = { instructions: 'Original' };

      await gatewayClient.post('/v1/messages', requestBody);

      await waitForCondition(async () => {
        const list = await getRequestList({ limit: 10 });
        return list.total > 0;
      }, 2000);

      const list = await getRequestList({ limit: 10 });
      const detail = await getRequestDetail(list.items[0].id);

      expect(detail).toBeDefined();
      expect(detail!.originalBody).toEqual({ instructions: 'Original' });
      expect(detail!.modifiedBody.instructions).toContain('[GATEWAY-MODIFIED]');
    });

    it('应该记录响应头信息', async () => {
      await gatewayClient.post('/v1/messages', { instructions: 'Test' });

      await waitForCondition(async () => {
        const list = await getRequestList({ limit: 10 });
        return list.total > 0;
      }, 2000);

      const list = await getRequestList({ limit: 10 });
      const detail = await getRequestDetail(list.items[0].id);

      expect(detail!.responseHeaders).toBeDefined();
      const headers = JSON.parse(detail!.responseHeaders!);
      expect(headers['content-type']).toBeDefined();
    });
  });

  describe('SSE Broadcasting', () => {
    it('应该广播请求事件到 SSE 连接', async () => {
      // 连接 SSE
      const events: Array<{ event: string; data: any }> = [];
      const sseConnection = await apiClient.connectSSE('/_promptxy/events', (event, data) => {
        events.push({ event, data });
      });

      // 等待连接建立
      await new Promise(resolve => setTimeout(resolve, 100));

      // 发送请求
      await gatewayClient.post('/v1/messages', { instructions: 'SSE Test' });

      // 等待事件广播
      await waitForCondition(() => {
        const requestEvents = events.filter(e => e.event === 'request');
        return requestEvents.length > 0;
      }, 2000);

      // 验证事件
      const requestEvents = events.filter(e => e.event === 'request');
      expect(requestEvents.length).toBeGreaterThan(0);

      const eventData = requestEvents[0].data;
      expect(eventData.id).toBeDefined();
      expect(eventData.client).toBe('claude');
      expect(eventData.path).toBe('/v1/messages');
      expect(eventData.method).toBe('POST');
      expect(Array.isArray(eventData.matchedRules)).toBe(true);
      expect(eventData.matchedRules).toContain('gateway-rule-1');

      sseConnection.close();
    });

    it('应该为错误请求广播事件', async () => {
      // 模拟一个会失败的请求
      const originalFetch = global.fetch;
      global.fetch = async () => {
        throw new Error('Network error');
      };

      const events: Array<{ event: string; data: any }> = [];
      const sseConnection = await apiClient.connectSSE('/_promptxy/events', (event, data) => {
        events.push({ event, data });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        await gatewayClient.post('/v1/messages', { instructions: 'Error test' });
      } catch {
        // 预期会失败
      }

      await waitForCondition(() => {
        const requestEvents = events.filter(e => e.event === 'request');
        return requestEvents.length > 0;
      }, 2000);

      global.fetch = originalFetch;

      const requestEvents = events.filter(e => e.event === 'request');
      expect(requestEvents.length).toBeGreaterThan(0);

      sseConnection.close();
    });
  });

  describe('Error Handling', () => {
    it('应该处理上游服务器错误', async () => {
      // 临时修改上游 URL 为不存在的地址
      const originalUpstream = config.upstreams.anthropic;
      config.upstreams.anthropic = 'http://127.0.0.1:1'; // 不可能连接的端口

      try {
        const response = await gatewayClient.post('/v1/messages', { instructions: 'Test' });

        expect(response.status).toBe(500);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('promptxy_error');
        expect(body.message).toBeDefined();
      } finally {
        config.upstreams.anthropic = originalUpstream;
      }
    });

    it('应该记录错误请求到数据库', async () => {
      const originalUpstream = config.upstreams.anthropic;
      config.upstreams.anthropic = 'http://127.0.0.1:1';

      try {
        await gatewayClient.post('/v1/messages', { instructions: 'Error test' });

        await waitForCondition(async () => {
          const list = await getRequestList({ limit: 10 });
          return list.total > 0;
        }, 2000);

        const list = await getRequestList({ limit: 10 });
        const detail = await getRequestDetail(list.items[0].id);

        expect(detail!.error).toBeDefined();
        expect(detail!.responseStatus).toBeUndefined();
      } finally {
        config.upstreams.anthropic = originalUpstream;
      }
    });

    it('应该处理无效的 JSON 请求体', async () => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: servers.gatewayPort,
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': 10,
          },
        },
        res => {
          // 即使 JSON 无效，也应该传递给上游或优雅处理
          expect(res.statusCode).toBeDefined();
        },
      );

      req.write('invalid');
      req.end();

      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('应该处理缺少必要头的请求', async () => {
      const response = await gatewayClient.post('/v1/messages', { instructions: 'Test' }, {});

      // 应该仍然尝试转发（可能失败，但不应该崩溃）
      expect(response.status).toBeDefined();
    });
  });

  describe('Health Check', () => {
    it('应该返回网关健康状态', async () => {
      const response = await gatewayClient.get('/_promptxy/health');

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
    });
  });

  describe('Multiple Concurrent Requests', () => {
    it('应该处理并发请求', async () => {
      const promises = [];

      for (let i = 0; i < 5; i++) {
        promises.push(gatewayClient.post('/v1/messages', { instructions: `Concurrent ${i}` }));
      }

      const results = await Promise.all(promises);

      // 所有请求都应该成功
      results.forEach(result => {
        expect(result.status).toBe(200);
      });

      // 等待所有记录都保存到数据库
      await waitForCondition(async () => {
        const list = await getRequestList({ limit: 10 });
        return list.total >= 5;
      }, 3000);

      const list = await getRequestList({ limit: 10 });
      expect(list.total).toBeGreaterThanOrEqual(5);
    });

    it('应该正确记录并发请求的匹配规则', async () => {
      const promises = [];

      for (let i = 0; i < 3; i++) {
        promises.push(gatewayClient.post('/v1/messages', { instructions: `Test ${i}` }));
      }

      await Promise.all(promises);

      await waitForCondition(async () => {
        const list = await getRequestList({ limit: 10 });
        return list.total >= 3;
      }, 2000);

      const list = await getRequestList({ limit: 10 });

      // 验证每条记录都有正确的规则匹配
      for (const item of list.items.slice(0, 3)) {
        expect(item.matchedRules).toContain('gateway-rule-1');
      }
    });
  });

  describe('Path Routing', () => {
    it('应该正确路由不同前缀的请求', async () => {
      // 测试不同客户端的路由
      const tests = [
        { path: '/v1/messages', expectedClient: 'claude' },
        { path: '/openai/v1/chat/completions', expectedClient: 'codex' },
        {
          path: '/gemini/v1beta/models/gemini-1.5-flash:generateContent',
          expectedClient: 'gemini',
        },
      ];

      for (const test of tests) {
        await gatewayClient.post(test.path, { test: 'data' });

        await waitForCondition(async () => {
          const list = await getRequestList({ limit: 10 });
          return list.items.some(item => item.path === test.path);
        }, 1000);

        const list = await getRequestList({ limit: 10, client: test.expectedClient });
        const item = list.items.find(i => i.path === test.path);
        expect(item).toBeDefined();
        expect(item!.client).toBe(test.expectedClient);
      }
    });

    it('应该处理根路径请求', async () => {
      const response = await gatewayClient.post('/', { test: 'data' });

      // 应该路由到 claude
      expect(response.status).toBeDefined();

      await waitForCondition(async () => {
        const list = await getRequestList({ limit: 10 });
        return list.total > 0;
      }, 1000);

      const list = await getRequestList({ limit: 10 });
      const item = list.items[0];
      expect(item.client).toBe('claude');
    });
  });
});
