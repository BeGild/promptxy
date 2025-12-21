#!/usr/bin/env node

/**
 * PromptXY v2.0 Performance Test Suite
 * 测试后端性能：并发请求、规则引擎、数据库、SSE
 */

import { spawn, execSync } from 'node:child_process';
import * as http from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// 测试结果存储
const results = {
  timestamp: new Date().toISOString(),
  tests: {},
  summary: {},
  recommendations: []
};

// 测试配置
const config = {
  gatewayPort: 7070,
  apiPort: 7071,
  mockPorts: [8080, 8081, 8082],
  testDuration: 30, // seconds
  warmupDuration: 5, // seconds
};

// 工具函数
function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

function measureLatency(fn) {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  return { result, latency: end - start };
}

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
            size: data.length
          });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data, size: data.length });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// 1. 启动服务管理
class ServiceManager {
  constructor() {
    this.processes = [];
  }

  async startMockServices() {
    log('启动模拟上游服务...');
    const mockProcess = spawn('node', ['mock-upstream.js'], {
      cwd: process.cwd(),
      stdio: 'pipe'
    });

    this.processes.push(mockProcess);

    // 等待服务启动
    await sleep(2000);

    // 验证服务是否启动
    for (const port of config.mockPorts) {
      await this.waitForService(port);
    }

    log('✓ 模拟服务已启动');
  }

  async startPromptXY() {
    log('启动 PromptXY 服务...');
    const promptxyProcess = spawn('node', ['dist/main.js'], {
      cwd: process.cwd(),
      stdio: 'pipe',
      env: { ...process.env, PROMPTXY_DEBUG: 'false' }
    });

    this.processes.push(promptxyProcess);

    // 等待服务启动
    await sleep(3000);

    // 验证网关和API服务
    await this.waitForService(config.gatewayPort);
    await this.waitForService(config.apiPort);

    log('✓ PromptXY 服务已启动');
  }

  async waitForService(port, maxRetries = 10) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await makeRequest({
          hostname: '127.0.0.1',
          port: port,
          path: '/_promptxy/health',
          method: 'GET'
        });
        return true;
      } catch (e) {
        if (i === maxRetries - 1) throw new Error(`Service on port ${port} failed to start`);
        await sleep(500);
      }
    }
  }

  killAll() {
    log('停止所有服务...');
    this.processes.forEach(p => {
      try {
        p.kill('SIGTERM');
      } catch (e) {
        // 忽略
      }
    });
  }
}

// 2. 并发请求测试
async function testConcurrentRequests(serviceManager) {
  log('=== 测试 1: 并发请求性能 ===');

  const scenarios = [
    { name: '100并发', connections: 100, requests: 1000 },
    { name: '500并发', connections: 500, requests: 1000 },
    { name: '1000并发', connections: 1000, requests: 1000 }
  ];

  for (const scenario of scenarios) {
    log(`测试 ${scenario.name}...`);

    const testBody = {
      model: 'claude-3-5-sonnet-20241022',
      system: 'You are a helpful assistant. This is a test prompt for performance testing.',
      messages: [
        {
          role: 'user',
          content: 'Hello, this is a test message for performance benchmarking. Please respond with a standard greeting.'
        }
      ]
    };

    const startTime = performance.now();

    // 使用 autocannon 进行压力测试
    const autocannon = spawn('autocannon', [
      '-c', scenario.connections.toString(),
      '-n', scenario.requests.toString(),
      '-d', '10',
      '-j',
      'http://127.0.0.1:7070/v1/messages'
    ], { stdio: 'pipe' });

    let output = '';
    autocannon.stdout.on('data', (data) => {
      output += data.toString();
    });

    await new Promise((resolve) => {
      autocannon.on('close', resolve);
    });

    const endTime = performance.now();

    try {
      const result = JSON.parse(output);
      const duration = endTime - startTime;

      results.tests[`concurrent_${scenario.name}`] = {
        connections: scenario.connections,
        requests: scenario.requests,
        duration: duration,
        rps: result.requests?.perSecond || 0,
        latency: {
          avg: result.latency?.average || 0,
          p99: result.latency?.p99 || 0,
          max: result.latency?.max || 0
        },
        errors: result.errors || 0,
        timeouts: result.timeouts || 0,
        throughput: result.throughput || 0
      };

      log(`✓ ${scenario.name}: ${result.requests?.perSecond?.toFixed(0)} RPS, 平均延迟 ${result.latency?.average?.toFixed(0)}ms`);
    } catch (e) {
      log(`✗ ${scenario.name} 解析失败: ${e.message}`);
    }
  }
}

// 3. 规则引擎性能测试
async function testRuleEnginePerformance(serviceManager) {
  log('=== 测试 2: 规则引擎处理性能 ===');

  const testCases = [
    { name: '简单文本替换', text: 'This is important text to replace', rules: 1 },
    { name: '多规则匹配', text: 'Important and critical content', rules: 3 },
    { name: '复杂正则', text: 'User: john@example.com, Admin: admin@company.com', rules: 2 }
  ];

  const testRules = [
    {
      id: 'rule1',
      enabled: true,
      when: { client: 'claude', field: 'system' },
      ops: [{ type: 'replace', match: 'important', replacement: 'CRITICAL' }]
    },
    {
      id: 'rule2',
      enabled: true,
      when: { client: 'claude', field: 'system' },
      ops: [{ type: 'append', text: '\n[PROCESSED]' }]
    },
    {
      id: 'rule3',
      enabled: true,
      when: { client: 'claude', field: 'system' },
      ops: [{ type: 'replace', regex: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b', replacement: '[EMAIL]' }]
    }
  ];

  for (const testCase of testCases) {
    const rules = testRules.slice(0, testCase.rules);

    // 更新配置中的规则
    await makeRequest({
      hostname: '127.0.0.1',
      port: config.apiPort,
      path: '/_promptxy/config/sync',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { rules });

    // 测试预览端点性能
    const iterations = 100;
    const latencies = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      await makeRequest({
        hostname: '127.0.0.1',
        port: config.apiPort,
        path: '/_promptxy/preview',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        client: 'claude',
        field: 'system',
        body: { system: testCase.text },
        method: 'POST',
        path: '/v1/messages',
        model: 'claude-3-5-sonnet-20241022'
      });

      latencies.push(performance.now() - start);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);
    const minLatency = Math.min(...latencies);

    results.tests[`rule_engine_${testCase.name}`] = {
      rules: testCase.rules,
      iterations,
      avgLatency,
      maxLatency,
      minLatency,
      throughput: (iterations / (avgLatency / 1000)).toFixed(0)
    };

    log(`✓ ${testCase.name} (${testCase.rules}规则): 平均 ${avgLatency.toFixed(2)}ms, 最高 ${maxLatency.toFixed(2)}ms`);
  }
}

// 4. 数据库写入性能测试
async function testDatabasePerformance(serviceManager) {
  log('=== 测试 3: SQLite 数据库写入性能 ===');

  const iterations = 500;
  const latencies = [];
  const recordTemplate = {
    id: 'test-req-',
    timestamp: Date.now(),
    client: 'claude',
    path: '/v1/messages',
    method: 'POST',
    originalBody: JSON.stringify({ model: 'test', messages: [{ role: 'user', content: 'test' }] }),
    modifiedBody: JSON.stringify({ model: 'test', messages: [{ role: 'user', content: 'test-modified' }] }),
    matchedRules: JSON.stringify([{ ruleId: 'rule1', opType: 'append' }]),
    responseStatus: 200,
    durationMs: 150,
    responseHeaders: JSON.stringify({ 'content-type': 'application/json' }),
    error: undefined
  };

  // 通过网关发送请求来触发数据库写入
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();

    try {
      await makeRequest({
        hostname: '127.0.0.1',
        port: config.gatewayPort,
        path: '/v1/messages',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        model: 'claude-3-5-sonnet-20241022',
        system: `Test prompt ${i}`,
        messages: [{ role: 'user', content: `Test message ${i}` }]
      });

      latencies.push(performance.now() - start);
    } catch (e) {
      // 忽略请求错误，只关注数据库写入
    }

    if (i % 100 === 0 && i > 0) {
      log(`  已完成 ${i}/${iterations} 次写入`);
    }
  }

  // 等待所有异步写入完成
  await sleep(2000);

  // 获取数据库统计
  const stats = await makeRequest({
    hostname: '127.0.0.1',
    port: config.apiPort,
    path: '/_promptxy/database',
    method: 'GET'
  });

  const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

  results.tests.database_write = {
    iterations,
    successfulWrites: latencies.length,
    avgLatency,
    totalRecords: stats.body.recordCount,
    dbSize: (stats.body.size / 1024).toFixed(2) + ' KB'
  };

  log(`✓ 数据库写入: ${latencies.length}/${iterations} 次, 平均 ${avgLatency.toFixed(2)}ms/次, 总记录 ${stats.body.recordCount}`);
}

// 5. SSE 连接稳定性测试
async function testSSEStability(serviceManager) {
  log('=== 测试 4: SSE 连接稳定性 ===');

  const concurrentConnections = 15;
  const connections = [];
  const receivedEvents = [];
  const errors = [];
  const startTime = Date.now();

  // 建立多个 SSE 连接
  for (let i = 0; i < concurrentConnections; i++) {
    const req = http.request({
      hostname: '127.0.0.1',
      port: config.apiPort,
      path: '/_promptxy/events',
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Connection': 'keep-alive'
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        errors.push(`Connection ${i}: HTTP ${res.statusCode}`);
        return;
      }

      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString();

        // 解析 SSE 事件
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        events.forEach(event => {
          if (event.trim()) {
            const lines = event.split('\n');
            const eventData = lines.find(line => line.startsWith('data:'));
            if (eventData) {
              try {
                const json = JSON.parse(eventData.substring(5));
                receivedEvents.push({ connection: i, data: json, timestamp: Date.now() });
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        });
      });

      res.on('error', (err) => {
        errors.push(`Connection ${i}: ${err.message}`);
      });
    });

    req.on('error', (err) => {
      errors.push(`Connection ${i} request: ${err.message}`);
    });

    req.end();
    connections.push(req);

    // 小间隔建立连接
    await sleep(50);
  }

  log(`✓ 建立了 ${concurrentConnections} 个 SSE 连接`);

  // 等待一段时间接收事件
  await sleep(5000);

  // 通过网关触发一些请求来产生 SSE 事件
  for (let i = 0; i < 5; i++) {
    try {
      await makeRequest({
        hostname: '127.0.0.1',
        port: config.gatewayPort,
        path: '/v1/messages',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        model: 'claude-3-5-sonnet-20241022',
        system: 'Test',
        messages: [{ role: 'user', content: `SSE test ${i}` }]
      });
    } catch (e) {
      // 忽略错误
    }
    await sleep(100);
  }

  // 等待更多事件
  await sleep(2000);

  const duration = Date.now() - startTime;

  results.tests.sse_stability = {
    concurrentConnections,
    activeConnections: concurrentConnections - errors.length,
    eventsReceived: receivedEvents.length,
    errors: errors.length,
    duration,
    avgEventsPerConnection: receivedEvents.length / concurrentConnections,
    stabilityRate: ((concurrentConnections - errors.length) / concurrentConnections * 100).toFixed(1) + '%'
  };

  log(`✓ SSE 稳定性: ${results.tests.sse_stability.stabilityRate} 稳定率, ${receivedEvents.length} 事件, ${errors.length} 错误`);

  // 清理连接
  connections.forEach(req => req.destroy());
}

// 6. 内存和资源监控
async function monitorResources(serviceManager) {
  log('=== 测试 5: 内存和资源监控 ===');

  const samples = [];
  const duration = 30000; // 30秒监控
  const interval = 1000; // 每秒采样

  const startTime = Date.now();

  while (Date.now() - startTime < duration) {
    try {
      // 获取进程内存信息
      const memUsage = process.memoryUsage();

      // 获取系统负载（如果可用）
      let loadAvg = null;
      try {
        const os = await import('node:os');
        loadAvg = os.loadavg();
      } catch (e) {
        // 忽略
      }

      samples.push({
        timestamp: Date.now() - startTime,
        memory: {
          rss: (memUsage.rss / 1024 / 1024).toFixed(2) + ' MB',
          heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
          external: (memUsage.external / 1024 / 1024).toFixed(2) + ' MB'
        },
        loadAvg
      });

      await sleep(interval);
    } catch (e) {
      break;
    }
  }

  // 分析内存趋势
  const memSamples = samples.map(s => parseFloat(s.memory.rss));
  const maxMem = Math.max(...memSamples);
  const avgMem = memSamples.reduce((a, b) => a + b, 0) / memSamples.length;
  const trend = memSamples[memSamples.length - 1] - memSamples[0];

  results.tests.resource_monitor = {
    duration: duration / 1000,
    samples: samples.length,
    memory: {
      max: maxMem.toFixed(2) + ' MB',
      avg: avgMem.toFixed(2) + ' MB',
      trend: (trend > 0 ? '+' : '') + trend.toFixed(2) + ' MB'
    },
    hasLeak: trend > 10, // 如果30秒内增长超过10MB，可能存在泄漏
    samples
  };

  log(`✓ 资源监控: 最大内存 ${maxMem.toFixed(2)}MB, 趋势 ${trend.toFixed(2)}MB, 泄漏风险: ${trend > 10 ? '是' : '否'}`);
}

// 7. 生成报告
function generateReport() {
  log('=== 生成性能报告 ===');

  // 计算总结
  const concurrentTests = Object.keys(results.tests).filter(k => k.startsWith('concurrent_'));
  if (concurrentTests.length > 0) {
    const totalRps = concurrentTests.reduce((sum, key) => sum + (results.tests[key].rps || 0), 0);
    const avgLatency = concurrentTests.reduce((sum, key) => sum + (results.tests[key].latency.avg || 0), 0) / concurrentTests.length;

    results.summary.overall = {
      totalRps: totalRps.toFixed(0),
      avgLatency: avgLatency.toFixed(2) + 'ms',
      testCount: Object.keys(results.tests).length
    };
  }

  // 识别瓶颈和建议
  const recommendations = [];

  // 并发测试分析
  const highConcurrency = results.tests.concurrent_['1000并发'];
  if (highConcurrency && highConcurrency.errors > 0) {
    recommendations.push({
      priority: '高',
      issue: `高并发下出现 ${highConcurrency.errors} 个错误`,
      suggestion: '考虑增加连接池大小或优化请求队列处理'
    });
  }

  // 规则引擎分析
  const ruleEngine = results.tests.rule_engine_['复杂正则'];
  if (ruleEngine && ruleEngine.avgLatency > 50) {
    recommendations.push({
      priority: '中',
      issue: `复杂正则规则处理延迟较高 (${ruleEngine.avgLatency.toFixed(2)}ms)`,
      suggestion: '优化正则表达式，考虑预编译或缓存'
    });
  }

  // 数据库分析
  const dbTest = results.tests.database_write;
  if (dbTest && dbTest.avgLatency > 10) {
    recommendations.push({
      priority: '中',
      issue: `数据库写入延迟较高 (${dbTest.avgLatency.toFixed(2)}ms)`,
      suggestion: '考虑批量写入或异步队列处理'
    });
  }

  // SSE 稳定性分析
  const sseTest = results.tests.sse_stability;
  if (sseTest && sseTest.errors > 0) {
    recommendations.push({
      priority: '高',
      issue: `SSE 连接不稳定，${sseTest.errors} 个错误`,
      suggestion: '检查连接超时设置和资源清理机制'
    });
  }

  // 内存分析
  const resourceTest = results.tests.resource_monitor;
  if (resourceTest && resourceTest.hasLeak) {
    recommendations.push({
      priority: '高',
      issue: '检测到潜在内存泄漏',
      suggestion: '检查事件监听器清理、数据库连接池、SSE 连接管理'
    });
  }

  results.recommendations = recommendations;

  // 保存报告
  const reportDir = join(process.cwd(), 'performance-reports');
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }

  const reportFile = join(reportDir, `performance-report-${Date.now()}.json`);
  const reportStream = createWriteStream(reportFile);
  reportStream.write(JSON.stringify(results, null, 2));
  reportStream.end();

  log(`✓ 报告已保存: ${reportFile}`);

  return reportFile;
}

// 8. 显示报告摘要
function displaySummary() {
  console.log('\n' + '='.repeat(80));
  console.log('PROMPTXY v2.0 性能测试报告');
  console.log('='.repeat(80));
  console.log(`测试时间: ${results.timestamp}`);
  console.log('');

  // 并发测试
  console.log('【并发请求测试】');
  const concurrentTests = Object.keys(results.tests).filter(k => k.startsWith('concurrent_'));
  concurrentTests.forEach(key => {
    const test = results.tests[key];
    console.log(`  ${key.replace('concurrent_', '')}: ${test.rps?.toFixed(0) || 'N/A'} RPS, ` +
                `延迟: ${test.latency.avg?.toFixed(0) || 'N/A'}ms, ` +
                `错误: ${test.errors || 0}`);
  });
  console.log('');

  // 规则引擎
  console.log('【规则引擎性能】');
  const ruleTests = Object.keys(results.tests).filter(k => k.startsWith('rule_engine_'));
  ruleTests.forEach(key => {
    const test = results.tests[key];
    console.log(`  ${key.replace('rule_engine_', '')}: ${test.avgLatency.toFixed(2)}ms, ` +
                `吞吐量: ${test.throughput} req/s`);
  });
  console.log('');

  // 数据库
  if (results.tests.database_write) {
    const db = results.tests.database_write;
    console.log('【数据库写入性能】');
    console.log(`  写入次数: ${db.successfulWrites}/${db.iterations}`);
    console.log(`  平均延迟: ${db.avgLatency.toFixed(2)}ms`);
    console.log(`  总记录: ${db.totalRecords}, 大小: ${db.dbSize}`);
  }
  console.log('');

  // SSE
  if (results.tests.sse_stability) {
    const sse = results.tests.sse_stability;
    console.log('【SSE 连接稳定性】');
    console.log(`  连接数: ${sse.activeConnections}/${sse.concurrentConnections}`);
    console.log(`  稳定率: ${sse.stabilityRate}`);
    console.log(`  接收事件: ${sse.eventsReceived}, 错误: ${sse.errors}`);
  }
  console.log('');

  // 资源监控
  if (results.tests.resource_monitor) {
    const res = results.tests.resource_monitor;
    console.log('【资源监控】');
    console.log(`  内存使用: ${res.memory.avg} (峰值: ${res.memory.max})`);
    console.log(`  内存趋势: ${res.memory.trend}`);
    console.log(`  泄漏风险: ${res.hasLeak ? '⚠️ 检测到潜在泄漏' : '✅ 正常'}`);
  }
  console.log('');

  // 建议
  if (results.recommendations.length > 0) {
    console.log('【优化建议】');
    results.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. [${rec.priority}] ${rec.issue}`);
      console.log(`     → ${rec.suggestion}`);
    });
  } else {
    console.log('【优化建议】');
    console.log('  ✅ 性能表现良好，暂无重大问题');
  }

  if (results.summary.overall) {
    console.log('');
    console.log('【总体总结】');
    console.log(`  总吞吐量: ${results.summary.overall.totalRps} RPS`);
    console.log(`  平均延迟: ${results.summary.overall.avgLatency}`);
    console.log(`  测试项目: ${results.summary.overall.testCount} 项`);
  }

  console.log('\n' + '='.repeat(80));
}

// 主测试流程
async function runPerformanceTests() {
  const serviceManager = new ServiceManager();

  try {
    log('🚀 PromptXY v2.0 性能测试开始');

    // 1. 启动服务
    await serviceManager.startMockServices();
    await serviceManager.startPromptXY();

    // 2. 运行测试
    await testConcurrentRequests(serviceManager);
    await testRuleEnginePerformance(serviceManager);
    await testDatabasePerformance(serviceManager);
    await testSSEStability(serviceManager);
    await monitorResources(serviceManager);

    // 3. 生成报告
    const reportFile = generateReport();

    // 4. 显示摘要
    displaySummary();

    log(`✅ 所有测试完成！详细报告: ${reportFile}`);

  } catch (error) {
    log(`❌ 测试失败: ${error.message}`);
    console.error(error);
  } finally {
    serviceManager.killAll();
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceTests();
}

export { runPerformanceTests };