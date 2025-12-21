/**
 * PromptXY v2.0 后端性能基准测试
 * 包含：吞吐量、规则引擎、数据库、SSE 测试
 */

import * as http from 'node:http';
import * as os from 'node:os';
import { PerformanceTimer, ResourceMonitor, DataGenerator, PerformanceBenchmark, TestScenario, SuccessCriteria } from './performance-benchmark-framework.js';

// ==================== 后端测试配置 ====================

interface BackendTestConfig {
  gatewayPort: number;
  apiPort: number;
  baseUrl: string;
  testDuration: number;
  warmupDuration: number;
}

const defaultBackendConfig: BackendTestConfig = {
  gatewayPort: 7070,
  apiPort: 7071,
  baseUrl: 'http://localhost',
  testDuration: 5000,
  warmupDuration: 1000,
};

// ==================== 吞吐量测试 ====================

export class ThroughputBenchmark {
  private timer: PerformanceTimer;
  private monitor: ResourceMonitor;
  private config: BackendTestConfig;

  constructor(config: BackendTestConfig = defaultBackendConfig) {
    this.timer = new PerformanceTimer();
    this.monitor = new ResourceMonitor();
    this.config = config;
  }

  /**
   * 并发请求测试
   * @param concurrency 并发连接数
   * @param requestsPerConnection 每个连接的请求数
   */
  async testConcurrency(concurrency: number, requestsPerConnection: number = 1000): Promise<any> {
    console.log(`📊 测试并发: ${concurrency} 连接, ${requestsPerConnection} 请求/连接`);

    const url = `${this.config.baseUrl}:${this.config.gatewayPort}/_promptxy/health`;
    const startTime = Date.now();
    const results: Array<{ success: boolean; duration: number; error?: string }> = [];

    // 创建并发请求
    const promises = Array.from({ length: concurrency }, async (_, index) => {
      const connectionResults = [];

      for (let i = 0; i < requestsPerConnection; i++) {
        const reqStart = performance.now();
        try {
          const response = await this.makeRequest(url);
          const duration = performance.now() - reqStart;
          connectionResults.push({ success: true, duration });
        } catch (error: any) {
          const duration = performance.now() - reqStart;
          connectionResults.push({ success: false, duration, error: error.message });
        }

        // 小延迟避免瞬间压力过大
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      return connectionResults;
    });

    // 等待所有并发完成
    const allResults = await Promise.all(promises);
    const flatResults = allResults.flat();

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // 计算指标
    const successful = flatResults.filter(r => r.success).length;
    const failed = flatResults.filter(r => !r.success).length;
    const totalRequests = flatResults.length;
    const rps = (totalRequests / totalDuration) * 1000;

    const durations = flatResults.map(r => r.duration).sort((a, b) => a - b);
    const avgLatency = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minLatency = durations[0];
    const maxLatency = durations[durations.length - 1];
    const p95 = durations[Math.floor(durations.length * 0.95)];
    const p99 = durations[Math.floor(durations.length * 0.99)];

    return {
      concurrency,
      requestsPerConnection,
      totalRequests,
      successful,
      failed,
      successRate: (successful / totalRequests) * 100,
      rps,
      latency: {
        min: minLatency,
        max: maxLatency,
        avg: avgLatency,
        p95,
        p99,
      },
      totalDuration,
    };
  }

  /**
   * 批量并发测试（多个并发级别）
   */
  async runBatchTests(): Promise<any[]> {
    const concurrencyLevels = [10, 50, 100, 500];
    const results = [];

    for (const concurrency of concurrencyLevels) {
      try {
        const result = await this.testConcurrency(concurrency, 1000);
        results.push(result);
        console.log(`✅ ${concurrency} 并发: RPS=${result.rps.toFixed(2)}, 成功率=${result.successRate.toFixed(1)}%`);
      } catch (error) {
        console.error(`❌ ${concurrency} 并发测试失败:`, error);
        results.push({ concurrency, error: String(error) });
      }

      // 间隔时间，让系统恢复
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return results;
  }

  private async makeRequest(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(data);
            }
          });
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      }).on('error', reject);
    });
  }
}

// ==================== 规则引擎基准测试 ====================

export class RuleEngineBenchmark {
  private timer: PerformanceTimer;

  constructor() {
    this.timer = new PerformanceTimer();
  }

  /**
   * 单条规则应用测试
   */
  async testSingleRule(iterations: number = 10000): Promise<any> {
    console.log(`⚙️ 测试单条规则: ${iterations} 次迭代`);

    // 导入规则引擎
    const { applyPromptRules } = await import('../backend/src/promptxy/rules/engine.js');

    const rule = {
      id: 'test-rule-1',
      enabled: true,
      when: {
        client: 'claude',
        field: 'system',
        method: 'POST',
        pathRegex: '/v1/chat',
      },
      ops: [{
        type: 'append',
        text: '\n\nAdditional context: This is a test rule.',
      }],
    };

    const ctx = {
      client: 'claude' as const,
      field: 'system' as const,
      method: 'POST',
      path: '/v1/chat',
      model: 'claude-3-5-sonnet',
    };

    const inputText = 'You are a helpful assistant.';

    // 预热
    for (let i = 0; i < 100; i++) {
      applyPromptRules(inputText, ctx, [rule]);
    }

    // 正式测试
    const durations: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const result = applyPromptRules(inputText, ctx, [rule]);
      const duration = performance.now() - start;
      durations.push(duration);

      // 验证结果
      if (!result.text.includes('Additional context')) {
        throw new Error('规则应用失败');
      }
    }

    return this.calculateStats(durations, '单条规则');
  }

  /**
   * 多条规则组合测试
   */
  async testMultipleRules(ruleCount: number = 5, iterations: number = 5000): Promise<any> {
    console.log(`⚙️ 测试多条规则: ${ruleCount} 条规则, ${iterations} 次迭代`);

    const { applyPromptRules } = await import('../backend/src/promptxy/rules/engine.js');

    // 生成测试规则
    const rules = DataGenerator.generateRules(ruleCount);
    const ctx = {
      client: 'claude' as const,
      field: 'system' as const,
      method: 'POST',
      path: '/v1/chat',
      model: 'claude-3-5-sonnet',
    };

    const inputText = 'You are a helpful assistant. Please provide detailed responses.';

    // 预热
    for (let i = 0; i < 100; i++) {
      applyPromptRules(inputText, ctx, rules);
    }

    // 正式测试
    const durations: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const result = applyPromptRules(inputText, ctx, rules);
      const duration = performance.now() - start;
      durations.push(duration);
    }

    return this.calculateStats(durations, `${ruleCount}条规则`);
  }

  /**
   * 不同规则类型性能对比
   */
  async testRuleTypes(iterations: number = 2000): Promise<any> {
    console.log(`⚙️ 测试不同规则类型: ${iterations} 次迭代/类型`);

    const { applyPromptRules } = await import('../backend/src/promptxy/rules/engine.js');

    const ctx = {
      client: 'claude' as const,
      field: 'system' as const,
      method: 'POST',
      path: '/v1/chat',
      model: 'claude-3-5-sonnet',
    };

    const inputText = 'Original text with test content.';

    const ruleTypes = [
      {
        name: 'append',
        rule: {
          id: 'append-rule',
          enabled: true,
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append' as const, text: ' Appended.' }],
        },
      },
      {
        name: 'replace',
        rule: {
          id: 'replace-rule',
          enabled: true,
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'replace' as const, match: 'test', replacement: 'replaced' }],
        },
      },
      {
        name: 'delete',
        rule: {
          id: 'delete-rule',
          enabled: true,
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'delete' as const, match: 'test' }],
        },
      },
      {
        name: 'insert_before',
        rule: {
          id: 'insert-before-rule',
          enabled: true,
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'insert_before' as const, regex: 'Original', text: 'Modified: ' }],
        },
      },
      {
        name: 'regex_replace',
        rule: {
          id: 'regex-replace-rule',
          enabled: true,
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'replace' as const, regex: '\\w+', replacement: 'word' }],
        },
      },
    ];

    const results: any[] = [];

    for (const { name, rule } of ruleTypes) {
      // 预热
      for (let i = 0; i < 100; i++) {
        applyPromptRules(inputText, ctx, [rule]);
      }

      // 测试
      const durations: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        applyPromptRules(inputText, ctx, [rule]);
        const duration = performance.now() - start;
        durations.push(duration);
      }

      const stats = this.calculateStats(durations, name);
      results.push({ type: name, ...stats });
    }

    return results;
  }

  /**
   * 吞吐量测试（每秒操作数）
   */
  async testThroughput(duration: number = 5000): Promise<any> {
    console.log(`⚙️ 测试规则引擎吞吐量: ${duration}ms`);

    const { applyPromptRules } = await import('../backend/src/promptxy/rules/engine.js');

    const rule = {
      id: 'throughput-test',
      enabled: true,
      when: { client: 'claude', field: 'system' },
      ops: [{ type: 'append' as const, text: ' Throughput test.' }],
    };

    const ctx = {
      client: 'claude' as const,
      field: 'system' as const,
      method: 'POST',
      path: '/v1/chat',
      model: 'claude-3-5-sonnet',
    };

    const inputText = 'Test text for throughput measurement.';

    // 预热
    for (let i = 0; i < 1000; i++) {
      applyPromptRules(inputText, ctx, [rule]);
    }

    // 吞吐量测试
    const start = performance.now();
    let operations = 0;

    while (performance.now() - start < duration) {
      applyPromptRules(inputText, ctx, [rule]);
      operations++;
    }

    const actualDuration = performance.now() - start;
    const throughput = (operations / actualDuration) * 1000; // ops/s

    return {
      operations,
      duration: actualDuration,
      throughput,
    };
  }

  private calculateStats(durations: number[], label: string): any {
    const sorted = durations.sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      label,
      iterations: durations.length,
      latency: { min, max, avg, p50, p95, p99 },
      throughput: (durations.length / (sorted.reduce((a, b) => a + b, 0) / 1000)), // req/s
    };
  }
}

// ==================== 数据库基准测试 ====================

export class DatabaseBenchmark {
  private timer: PerformanceTimer;
  private monitor: ResourceMonitor;

  constructor() {
    this.timer = new PerformanceTimer();
    this.monitor = new ResourceMonitor();
  }

  /**
   * 单条记录写入测试
   */
  async testSingleWrite(iterations: number = 100): Promise<any> {
    console.log(`🗄️ 测试单条记录写入: ${iterations} 次`);

    const { initializeDatabase, insertRequestRecord, resetDatabaseForTest, getDatabaseInfo } = await import('../backend/src/promptxy/database.js');

    // 初始化测试数据库
    await resetDatabaseForTest();
    const db = await initializeDatabase();

    // 预热
    for (let i = 0; i < 5; i++) {
      await insertRequestRecord(this.generateTestRecord(i));
    }

    // 正式测试
    const durations: number[] = [];
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await insertRequestRecord(this.generateTestRecord(i + 100));
      const duration = performance.now() - start;
      durations.push(duration);

      // 小延迟避免磁盘压力过大
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    const stats = this.calculateStats(durations, '单条写入');
    const dbInfo = await getDatabaseInfo();

    return {
      ...stats,
      databaseInfo: dbInfo,
    };
  }

  /**
   * 批量写入测试
   */
  async testBatchWrite(batchSizes: number[] = [10, 100, 1000]): Promise<any> {
    console.log(`🗄️ 测试批量写入: ${batchSizes.join(', ')} 条/批`);

    const { initializeDatabase, insertRequestRecord, resetDatabaseForTest, getDatabaseInfo } = await import('../backend/src/promptxy/database.js');

    await resetDatabaseForTest();
    const db = await initializeDatabase();

    const results: any[] = [];

    for (const batchSize of batchSizes) {
      // 预热
      for (let i = 0; i < Math.min(5, batchSize); i++) {
        await insertRequestRecord(this.generateTestRecord(i));
      }

      // 批量测试
      const records = Array.from({ length: batchSize }, (_, i) => this.generateTestRecord(i + 1000));

      const start = performance.now();
      const startTime = Date.now();

      // 使用事务批量写入
      const dbInstance = db;
      await dbInstance.run('BEGIN TRANSACTION');

      try {
        for (const record of records) {
          await insertRequestRecord(record);
        }
        await dbInstance.run('COMMIT');
      } catch (error) {
        await dbInstance.run('ROLLBACK');
        throw error;
      }

      const duration = performance.now() - start;
      const dbInfo = await getDatabaseInfo();

      results.push({
        batchSize,
        duration,
        avgLatency: duration / batchSize,
        throughput: (batchSize / duration) * 1000, // records/s
        databaseInfo: dbInfo,
      });

      // 间隔
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }

  /**
   * 查询性能测试
   */
  async testQueryPerformance(): Promise<any> {
    console.log(`🗄️ 测试查询性能`);

    const { initializeDatabase, getRequestList, resetDatabaseForTest, insertRequestRecord } = await import('../backend/src/promptxy/database.js');

    await resetDatabaseForTest();
    const db = await initializeDatabase();

    // 准备测试数据
    const recordCount = 1000;
    console.log(`  准备 ${recordCount} 条测试数据...`);

    for (let i = 0; i < recordCount; i++) {
      await insertRequestRecord(this.generateTestRecord(i));
      if (i % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    // 测试不同查询场景
    const testScenarios = [
      { name: '全表扫描', params: { limit: 100, offset: 0 } },
      { name: '带分页', params: { limit: 50, offset: 500 } },
      { name: '带客户端筛选', params: { limit: 50, client: 'claude' } },
      { name: '带搜索', params: { limit: 50, search: 'test' } },
    ];

    const results: any[] = [];

    for (const scenario of testScenarios) {
      // 预热
      await getRequestList(scenario.params);

      // 测试
      const durations: number[] = [];
      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        await getRequestList(scenario.params);
        const duration = performance.now() - start;
        durations.push(duration);
      }

      const stats = this.calculateStats(durations, scenario.name);
      results.push({ scenario: scenario.name, ...stats });
    }

    return results;
  }

  /**
   * 并发写入稳定性测试
   */
  async testConcurrentWrite(): Promise<any> {
    console.log(`🗄️ 测试并发写入稳定性`);

    const { initializeDatabase, insertRequestRecord, resetDatabaseForTest, getRequestStats } = await import('../backend/src/promptxy/database.js');

    await resetDatabaseForTest();
    const db = await initializeDatabase();

    const concurrency = 10;
    const perConnection = 50;
    const totalRequests = concurrency * perConnection;

    console.log(`  ${concurrency} 并发, 每连接 ${perConnection} 请求, 总计 ${totalRequests}`);

    const startTime = Date.now();

    // 并发写入
    const promises = Array.from({ length: concurrency }, async (_, connId) => {
      const results = [];
      for (let i = 0; i < perConnection; i++) {
        const record = this.generateTestRecord(connId * 1000 + i);
        const start = performance.now();

        try {
          await insertRequestRecord(record);
          const duration = performance.now() - start;
          results.push({ success: true, duration });
        } catch (error) {
          const duration = performance.now() - start;
          results.push({ success: false, duration, error: String(error) });
        }

        // 小延迟
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
      return results;
    });

    const allResults = await Promise.all(promises);
    const flatResults = allResults.flat();

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // 统计
    const successful = flatResults.filter(r => r.success).length;
    const failed = flatResults.filter(r => !r.success).length;
    const durations = flatResults.filter(r => r.success).map(r => r.duration).sort((a, b) => a - b);

    const stats = this.calculateStats(durations, '并发写入');
    const dbStats = await getRequestStats();

    return {
      ...stats,
      totalDuration,
      successful,
      failed,
      successRate: (successful / totalRequests) * 100,
      dbStats,
    };
  }

  private generateTestRecord(index: number): any {
    return {
      id: `test-${Date.now()}-${index}`,
      timestamp: Date.now(),
      client: ['claude', 'codex', 'gemini'][index % 3],
      path: index % 2 === 0 ? '/v1/chat' : '/v1/completions',
      method: 'POST',
      originalBody: JSON.stringify({ test: `original-${index}` }),
      modifiedBody: JSON.stringify({ test: `modified-${index}` }),
      matchedRules: JSON.stringify([{ ruleId: 'test-rule', opType: 'append' }]),
      responseStatus: 200,
      durationMs: Math.random() * 100 + 10,
      responseHeaders: JSON.stringify({ 'content-type': 'application/json' }),
      error: undefined,
    };
  }

  private calculateStats(durations: number[], label: string): any {
    if (durations.length === 0) {
      return { label, iterations: 0, latency: { min: 0, max: 0, avg: 0, p95: 0, p99: 0 } };
    }

    const sorted = durations.sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      label,
      iterations: durations.length,
      latency: { min, max, avg, p95, p99 },
    };
  }
}

// ==================== SSE 基准测试 ====================

export class SSEBenchmark {
  private timer: PerformanceTimer;

  constructor() {
    this.timer = new PerformanceTimer();
  }

  /**
   * 连接建立时间测试
   */
  async testConnectionTime(iterations: number = 20): Promise<any> {
    console.log(`📡 测试 SSE 连接建立时间: ${iterations} 次`);

    const url = `http://localhost:7071/_promptxy/events`;
    const durations: number[] = [];
    const errors: string[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      try {
        await this.connectSSE(url, 1000); // 1秒超时
        const duration = performance.now() - start;
        durations.push(duration);
      } catch (error: any) {
        errors.push(error.message);
        durations.push(9999); // 标记失败
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const successful = durations.filter(d => d < 9999);
    const failed = durations.filter(d => d >= 9999).length;

    return {
      iterations,
      successful: successful.length,
      failed,
      successRate: (successful.length / iterations) * 100,
      latency: successful.length > 0 ? this.calculateLatencyStats(successful) : null,
      errors,
    };
  }

  /**
   * 并发连接数上限测试
   */
  async testMaxConnections(maxConnections: number = 100): Promise<any> {
    console.log(`📡 测试最大并发连接数: ${maxConnections}`);

    const url = `http://localhost:7071/_promptxy/events`;
    const connections: Array<{ id: number; socket: any; connected: boolean }> = [];
    const startTime = Date.now();

    // 逐步建立连接
    for (let i = 0; i < maxConnections; i++) {
      try {
        const socket = await this.connectSSE(url, 2000);
        connections.push({ id: i, socket, connected: true });

        // 小延迟
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        console.log(`  已建立连接: ${i + 1}/${maxConnections}`);
      } catch (error: any) {
        console.log(`  连接失败 at ${i + 1}: ${error.message}`);
        return {
          maxReached: i,
          totalAttempted: maxConnections,
          successRate: (i / maxConnections) * 100,
          error: error.message,
        };
      }
    }

    const connectTime = Date.now() - startTime;

    // 保持连接一段时间
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 清理连接
    for (const conn of connections) {
      if (conn.socket && conn.socket.destroy) {
        conn.socket.destroy();
      }
    }

    return {
      maxReached: connections.length,
      totalAttempted: maxConnections,
      successRate: (connections.length / maxConnections) * 100,
      connectTime,
      activeConnections: connections.length,
    };
  }

  /**
   * 事件推送延迟测试
   */
  async testEventLatency(events: number = 50): Promise<any> {
    console.log(`📡 测试事件推送延迟: ${events} 个事件`);

    const url = `http://localhost:7071/_promptxy/events`;
    const receivedEvents: Array<{ timestamp: number; data: any }> = [];

    // 连接 SSE
    const socket = await this.connectSSE(url, 5000);

    // 监听事件
    return new Promise<any>(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({
          events: receivedEvents.length,
          latency: receivedEvents.length > 0 ? this.calculateEventLatency(receivedEvents) : null,
          timeout: true,
        });
      }, 10000);

      socket.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5));
              receivedEvents.push({ timestamp: Date.now(), data });
            } catch {
              // 忽略解析错误
            }
          }
        }

        if (receivedEvents.length >= events) {
          clearTimeout(timeout);
          socket.destroy();
          resolve({
            events: receivedEvents.length,
            latency: this.calculateEventLatency(receivedEvents),
            timeout: false,
          });
        }
      });

      socket.on('error', (error: any) => {
        clearTimeout(timeout);
        reject(error);
      });

      // 触发一些请求来产生事件
      await this.triggerRequests(Math.min(events, 10));
    });
  }

  /**
   * 断线重连时间测试
   */
  async testReconnectionTime(): Promise<any> {
    console.log(`📡 测试断线重连时间`);

    const url = `http://localhost:7071/_promptxy/events`;

    // 第一次连接
    const socket1 = await this.connectSSE(url, 2000);
    const connectTime1 = performance.now();

    // 断开连接
    socket1.destroy();
    await new Promise(resolve => setTimeout(resolve, 100));

    // 第二次连接（重连）
    const start = performance.now();
    const socket2 = await this.connectSSE(url, 2000);
    const reconnectTime = performance.now() - start;

    socket2.destroy();

    return {
      initialConnect: connectTime1,
      reconnectTime,
      success: reconnectTime < 1000, // 1秒内重连成功
    };
  }

  private connectSSE(url: string, timeout: number = 2000): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          // SSE 连接成功
          resolve(res);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });

      req.on('error', reject);

      // 超时处理
      setTimeout(() => {
        req.destroy();
        reject(new Error('Connection timeout'));
      }, timeout);
    });
  }

  private async triggerRequests(count: number): Promise<void> {
    // 模拟触发请求来产生 SSE 事件
    const url = `http://localhost:7070/_promptxy/health`;

    for (let i = 0; i < count; i++) {
      http.get(url, () => {}).on('error', () => {});
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  private calculateLatencyStats(durations: number[]): any {
    const sorted = durations.sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    return { min, max, avg, p95 };
  }

  private calculateEventLatency(events: Array<{ timestamp: number; data: any }>): any {
    if (events.length < 2) return null;

    const latencies: number[] = [];
    for (let i = 1; i < events.length; i++) {
      const latency = events[i].timestamp - events[i - 1].timestamp;
      latencies.push(latency);
    }

    return this.calculateLatencyStats(latencies);
  }
}

// ==================== 资源监控测试 ====================

export class ResourceBenchmark {
  private monitor: ResourceMonitor;

  constructor() {
    this.monitor = new ResourceMonitor();
  }

  /**
   * 内存泄漏测试
   */
  async testMemoryLeak(duration: number = 30000): Promise<any> {
    console.log(`💾 测试内存泄漏: ${duration}ms`);

    this.monitor.reset();
    this.monitor.setBaseline();

    const startTime = Date.now();
    const snapshots: Array<{ time: number; memory: number }> = [];

    // 持续监控内存
    while (Date.now() - startTime < duration) {
      const snapshot = await this.monitor.snapshot();
      snapshots.push({ time: Date.now() - startTime, memory: snapshot.memory });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const stats = this.monitor.getStats();
    const delta = this.monitor.getMemoryDelta();
    const leakRate = this.monitor.getMemoryLeakRate();

    return {
      duration,
      snapshots,
      memory: {
        initial: snapshots[0]?.memory || 0,
        peak: stats.peakMemory,
        final: snapshots[snapshots.length - 1]?.memory || 0,
        delta,
        leakRate,
      },
      cpu: {
        avg: stats.avgCpu,
        peak: stats.peakCpu,
      },
      hasLeak: leakRate > 0.5, // 每分钟超过 0.5MB 视为泄漏
    };
  }

  /**
   * 组件生命周期测试（模拟）
   */
  async testComponentLifecycle(iterations: number = 100): Promise<any> {
    console.log(`🔄 测试组件生命周期: ${iterations} 次`);

    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      // 模拟组件挂载
      const component = this.simulateComponentMount();
      await new Promise(resolve => setTimeout(resolve, 1));

      // 模拟组件更新
      this.simulateComponentUpdate(component);
      await new Promise(resolve => setTimeout(resolve, 1));

      // 模拟组件卸载
      this.simulateComponentUnmount(component);

      const duration = performance.now() - start;
      durations.push(duration);

      if (i % 20 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    const stats = this.calculateStats(durations, '组件生命周期');

    return {
      iterations,
      ...stats,
    };
  }

  private simulateComponentMount(): any {
    return {
      id: Math.random(),
      data: Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item-${i}` })),
      mounted: true,
    };
  }

  private simulateComponentUpdate(component: any): void {
    component.data = component.data.map((item: any) => ({
      ...item,
      updated: true,
      timestamp: Date.now(),
    }));
  }

  private simulateComponentUnmount(component: any): void {
    component.mounted = false;
    component.data = null;
  }

  private calculateStats(durations: number[], label: string): any {
    const sorted = durations.sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    return {
      label,
      latency: { min, max, avg },
    };
  }
}

// ==================== 后端基准测试主类 ====================

export class BackendBenchmarkSuite {
  private throughput: ThroughputBenchmark;
  private rules: RuleEngineBenchmark;
  private database: DatabaseBenchmark;
  private sse: SSEBenchmark;
  private resources: ResourceBenchmark;

  constructor(config: BackendTestConfig = defaultBackendConfig) {
    this.throughput = new ThroughputBenchmark(config);
    this.rules = new RuleEngineBenchmark();
    this.database = new DatabaseBenchmark();
    this.sse = new SSEBenchmark();
    this.resources = new ResourceBenchmark();
  }

  /**
   * 运行完整后端基准测试
   */
  async runCompleteSuite(): Promise<any> {
    console.log('🚀 开始完整后端基准测试\n');

    const results: any = {};

    // 1. 吞吐量测试
    console.log('=== 1. 吞吐量测试 ===');
    results.throughput = await this.throughput.runBatchTests();

    // 2. 规则引擎测试
    console.log('\n=== 2. 规则引擎测试 ===');
    results.rules = {
      single: await this.rules.testSingleRule(),
      multiple: await this.rules.testMultipleRules(3),
      types: await this.rules.testRuleTypes(),
      throughput: await this.rules.testThroughput(),
    };

    // 3. 数据库测试
    console.log('\n=== 3. 数据库测试 ===');
    results.database = {
      singleWrite: await this.database.testSingleWrite(),
      batchWrite: await this.database.testBatchWrite(),
      query: await this.database.testQueryPerformance(),
      concurrent: await this.database.testConcurrentWrite(),
    };

    // 4. SSE 测试
    console.log('\n=== 4. SSE 测试 ===');
    results.sse = {
      connectionTime: await this.sse.testConnectionTime(),
      maxConnections: await this.sse.testMaxConnections(50), // 降低数量以避免资源耗尽
      eventLatency: await this.sse.testEventLatency(20),
      reconnection: await this.sse.testReconnectionTime(),
    };

    // 5. 资源监控测试
    console.log('\n=== 5. 资源监控测试 ===');
    results.resources = {
      memoryLeak: await this.resources.testMemoryLeak(30000), // 30秒
      lifecycle: await this.resources.testComponentLifecycle(50),
    };

    console.log('\n✅ 所有后端基准测试完成\n');
    return results;
  }

  /**
   * 生成简化的测试报告
   */
  generateSummary(results: any): string {
    let report = '# 后端性能基准测试总结\n\n';

    // 吞吐量
    report += '## 吞吐量测试\n';
    if (results.throughput) {
      results.throughput.forEach((r: any) => {
        if (r.error) {
          report += `- ${r.concurrency} 并发: ❌ 失败 - ${r.error}\n`;
        } else {
          report += `- ${r.concurrency} 并发: ✅ RPS=${r.rps.toFixed(1)}, 成功率=${r.successRate.toFixed(1)}%, 延迟=${r.latency.avg.toFixed(2)}ms\n`;
        }
      });
    }

    // 规则引擎
    report += '\n## 规则引擎\n';
    if (results.rules) {
      if (results.rules.single) {
        const s = results.rules.single;
        report += `- 单条规则: ${s.latency.avg.toFixed(3)}ms (avg), 吞吐量 ${s.throughput.toFixed(0)} req/s\n`;
      }
      if (results.rules.multiple) {
        const m = results.rules.multiple;
        report += `- 多条规则: ${m.latency.avg.toFixed(3)}ms (avg), 吞吐量 ${m.throughput.toFixed(0)} req/s\n`;
      }
      if (results.rules.throughput) {
        const t = results.rules.throughput;
        report += `- 吞吐量: ${t.throughput.toFixed(0)} ops/s\n`;
      }
    }

    // 数据库
    report += '\n## 数据库\n';
    if (results.database) {
      if (results.database.singleWrite) {
        const s = results.database.singleWrite;
        report += `- 单条写入: ${s.latency.avg.toFixed(2)}ms (avg)\n`;
      }
      if (results.database.batchWrite) {
        results.database.batchWrite.forEach((b: any) => {
          report += `- 批量 ${b.batchSize}: ${b.avgLatency.toFixed(2)}ms/条, ${b.throughput.toFixed(0)} 条/s\n`;
        });
      }
      if (results.database.concurrent) {
        const c = results.database.concurrent;
        report += `- 并发写入: 成功率 ${c.successRate.toFixed(1)}%, ${c.latency.avg.toFixed(2)}ms (avg)\n`;
      }
    }

    // SSE
    report += '\n## SSE\n';
    if (results.sse) {
      if (results.sse.connectionTime) {
        const c = results.sse.connectionTime;
        report += `- 连接建立: ${c.latency?.avg.toFixed(1)}ms (avg), 成功率 ${c.successRate.toFixed(1)}%\n`;
      }
      if (results.sse.maxConnections) {
        const m = results.sse.maxConnections;
        report += `- 最大连接: ${m.maxReached}/${m.totalAttempted} (${m.successRate.toFixed(1)}%)\n`;
      }
      if (results.sse.eventLatency) {
        const e = results.sse.eventLatency;
        report += `- 事件延迟: ${e.latency?.avg.toFixed(1)}ms (avg)\n`;
      }
    }

    // 资源
    report += '\n## 资源使用\n';
    if (results.resources) {
      if (results.resources.memoryLeak) {
        const m = results.resources.memoryLeak;
        report += `- 内存: 峰值 ${m.memory.peak.toFixed(2)}MB, 增长 ${m.memory.delta.toFixed(2)}MB, 泄漏率 ${m.memory.leakRate.toFixed(3)} MB/min\n`;
        report += `- CPU: 平均 ${m.cpu.avg.toFixed(1)}%, 峰值 ${m.cpu.peak.toFixed(1)}%\n`;
      }
    }

    return report;
  }
}

// ==================== 主程序入口 ====================


// ==================== 主程序入口 ====================

async function main() {
	console.log('PromptXY v2.0 后端性能基准测试\\n');

	const suite = new BackendBenchmarkSuite();
	const results = await suite.runCompleteSuite();
	const summary = suite.generateSummary(results);

	console.log('\\n' + summary);

	// 保存结果到文件
	const fs = await import('fs/promises');
	const path = await import('path');

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const resultFile = path.join(process.cwd(), 'benchmark', `backend-results-${timestamp}.json`);
	const summaryFile = path.join(process.cwd(), 'benchmark', `backend-summary-${timestamp}.md`);

	await fs.mkdir(path.dirname(resultFile), { recursive: true });
	await fs.writeFile(resultFile, JSON.stringify(results, null, 2));
	await fs.writeFile(summaryFile, summary);

	console.log(`\\n📁 结果已保存:`);
	console.log(`  - 详细数据: ${resultFile}`);
	console.log(`  - 总结报告: ${summaryFile}`);
}

main().catch(console.error);
