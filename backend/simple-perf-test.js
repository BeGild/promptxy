#!/usr/bin/env node

/**
 * 简化版性能测试 - 直接测试已启动的服务
 */

import * as http from 'node:http';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const results = {
  timestamp: new Date().toISOString(),
  tests: {},
  summary: {},
  recommendations: []
};

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

// 1. 基础连通性测试
async function testConnectivity() {
  console.log('=== 测试 1: 基础连通性 ===');

  try {
    const gateway = await makeRequest({
      hostname: '127.0.0.1',
      port: 7070,
      path: '/_promptxy/health',
      method: 'GET'
    });

    const api = await makeRequest({
      hostname: '127.0.0.1',
      port: 7071,
      path: '/_promptxy/health',
      method: 'GET'
    });

    results.tests.connectivity = {
      gateway: gateway.status === 200,
      api: api.status === 200,
      gatewayResponse: gateway.body,
      apiResponse: api.body
    };

    console.log(`✓ 网关: ${gateway.status}, API: ${api.status}`);
  } catch (e) {
    console.log(`✗ 连接失败: ${e.message}`);
    results.tests.connectivity = { error: e.message };
  }
}

// 2. 并发请求测试
async function testConcurrentRequests() {
  console.log('\n=== 测试 2: 并发请求性能 ===');

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

  const scenarios = [
    { name: '100并发', connections: 100, requests: 500 },
    { name: '500并发', connections: 500, requests: 500 },
    { name: '1000并发', connections: 1000, requests: 500 }
  ];

  for (const scenario of scenarios) {
    console.log(`  测试 ${scenario.name}...`);

    const promises = [];
    const start = performance.now();

    // 创建并发请求
    for (let i = 0; i < scenario.requests; i++) {
      promises.push(
        makeRequest({
          hostname: '127.0.0.1',
          port: 7070,
          path: '/v1/messages',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, testBody).catch(e => ({ error: e.message }))
      );

      // 控制并发速率
      if (promises.length >= scenario.connections) {
        await Promise.allSettled(promises.splice(0, scenario.connections));
      }
    }

    // 等待剩余请求完成
    const resultsAll = await Promise.allSettled(promises);
    const end = performance.now();

    const successful = resultsAll.filter(r => r.status === 'fulfilled' && !r.value.error).length;
    const failed = resultsAll.filter(r => r.status === 'rejected' || r.value.error).length;
    const duration = end - start;
    const rps = (successful / duration) * 1000;

    // 获取一些延迟样本
    const latencies = [];
    for (const r of resultsAll.slice(0, 20)) {
      if (r.status === 'fulfilled' && !r.value.error) {
        latencies.push(r.value.latency || 0);
      }
    }
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    results.tests[`concurrent_${scenario.name}`] = {
      connections: scenario.connections,
      requests: scenario.requests,
      successful,
      failed,
      duration: duration.toFixed(2) + 'ms',
      rps: rps.toFixed(2),
      avgLatency: avgLatency.toFixed(2) + 'ms'
    };

    console.log(`    ✓ ${successful}/${scenario.requests} 成功, ${rps.toFixed(0)} RPS, 延迟 ${avgLatency.toFixed(0)}ms`);
  }
}

// 3. 规则引擎性能测试
async function testRuleEngine() {
  console.log('\n=== 测试 3: 规则引擎性能 ===');

  // 先获取当前配置
  const config = await makeRequest({
    hostname: '127.0.0.1',
    port: 7071,
    path: '/_promptxy/config',
    method: 'GET'
  });

  // 测试预览端点
  const testCases = [
    { name: '简单替换', text: 'This is important text' },
    { name: '复杂文本', text: 'Important and critical content with multiple words' }
  ];

  for (const testCase of testCases) {
    const iterations = 100;
    const latencies = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      await makeRequest({
        hostname: '127.0.0.1',
        port: 7071,
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
    const throughput = (iterations / (avgLatency / 1000)).toFixed(0);

    results.tests[`rule_engine_${testCase.name}`] = {
      iterations,
      avgLatency: avgLatency.toFixed(2) + 'ms',
      maxLatency: maxLatency.toFixed(2) + 'ms',
      throughput: throughput + ' req/s'
    };

    console.log(`    ✓ ${testCase.name}: ${avgLatency.toFixed(2)}ms, ${throughput} req/s`);
  }
}

// 4. 数据库写入性能测试
async function testDatabase() {
  console.log('\n=== 测试 4: 数据库写入性能 ===');

  const iterations = 100;
  const latencies = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();

    try {
      await makeRequest({
        hostname: '127.0.0.1',
        port: 7070,
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
      // 忽略错误
    }

    if (i % 20 === 0 && i > 0) {
      console.log(`    已完成 ${i}/${iterations}`);
    }
  }

  // 等待异步写入
  await sleep(1000);

  // 获取数据库统计
  const stats = await makeRequest({
    hostname: '127.0.0.1',
    port: 7071,
    path: '/_promptxy/database',
    method: 'GET'
  });

  const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

  results.tests.database_write = {
    iterations,
    successful: latencies.length,
    avgLatency: avgLatency.toFixed(2) + 'ms',
    totalRecords: stats.body.recordCount,
    dbSize: (stats.body.size / 1024).toFixed(2) + ' KB'
  };

  console.log(`    ✓ ${latencies.length}/${iterations} 次写入, 平均 ${avgLatency.toFixed(2)}ms, 记录数: ${stats.body.recordCount}`);
}

// 5. SSE 连接稳定性测试
async function testSSE() {
  console.log('\n=== 测试 5: SSE 连接稳定性 ===');

  const concurrentConnections = 10;
  const connections = [];
  const events = [];
  const errors = [];

  // 建立连接
  for (let i = 0; i < concurrentConnections; i++) {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 7071,
      path: '/_promptxy/events',
      method: 'GET',
      headers: { 'Accept': 'text/event-stream' }
    }, (res) => {
      if (res.statusCode !== 200) {
        errors.push(`HTTP ${res.statusCode}`);
        return;
      }

      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const eventParts = buffer.split('\n\n');
        buffer = eventParts.pop() || '';

        eventParts.forEach(part => {
          if (part.includes('data:')) {
            const dataLine = part.split('\n').find(line => line.startsWith('data:'));
            if (dataLine) {
              try {
                const json = JSON.parse(dataLine.substring(5));
                events.push({ connection: i, data: json });
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        });
      });

      res.on('error', (err) => {
        errors.push(err.message);
      });
    });

    req.on('error', (err) => {
      errors.push(err.message);
    });

    req.end();
    connections.push(req);
  }

  console.log(`    ✓ 建立了 ${concurrentConnections} 个连接`);

  // 触发一些请求产生事件
  for (let i = 0; i < 3; i++) {
    try {
      await makeRequest({
        hostname: '127.0.0.1',
        port: 7070,
        path: '/v1/messages',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        model: 'claude-3-5-sonnet-20241022',
        system: 'SSE test',
        messages: [{ role: 'user', content: `SSE event ${i}` }]
      });
    } catch (e) {
      // 忽略
    }
    await sleep(200);
  }

  await sleep(2000);

  // 清理连接
  connections.forEach(req => req.destroy());

  const stabilityRate = ((concurrentConnections - errors.length) / concurrentConnections * 100).toFixed(1);

  results.tests.sse_stability = {
    connections: concurrentConnections,
    active: concurrentConnections - errors.length,
    events: events.length,
    errors: errors.length,
    stabilityRate: stabilityRate + '%'
  };

  console.log(`    ✓ 稳定率: ${stabilityRate}%, 事件: ${events.length}, 错误: ${errors.length}`);
}

// 6. 内存监控
async function monitorMemory() {
  console.log('\n=== 测试 6: 内存监控 (30秒) ===');

  const samples = [];
  const duration = 30000;
  const interval = 1000;

  const startTime = Date.now();

  while (Date.now() - startTime < duration) {
    const memUsage = process.memoryUsage();
    samples.push({
      timestamp: Date.now() - startTime,
      rss: (memUsage.rss / 1024 / 1024).toFixed(2),
      heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2)
    });
    await sleep(interval);
  }

  const memSamples = samples.map(s => parseFloat(s.rss));
  const maxMem = Math.max(...memSamples);
  const avgMem = memSamples.reduce((a, b) => a + b, 0) / memSamples.length;
  const trend = memSamples[memSamples.length - 1] - memSamples[0];

  results.tests.memory = {
    duration: '30s',
    samples: samples.length,
    max: maxMem.toFixed(2) + ' MB',
    avg: avgMem.toFixed(2) + ' MB',
    trend: (trend > 0 ? '+' : '') + trend.toFixed(2) + ' MB',
    leakRisk: trend > 10 ? '高' : '低'
  };

  console.log(`    ✓ 最大: ${maxMem.toFixed(2)}MB, 平均: ${avgMem.toFixed(2)}MB, 趋势: ${trend.toFixed(2)}MB, 泄漏风险: ${trend > 10 ? '⚠️' : '✅'}`);
}

// 生成报告
function generateReport() {
  // 分析瓶颈
  const recommendations = [];

  // 并发测试分析
  const highConcurrency = results.tests['concurrent_1000并发'];
  if (highConcurrency && parseInt(highConcurrency.failed) > 0) {
    recommendations.push({
      priority: '高',
      issue: `高并发下 ${highConcurrency.failed} 个请求失败`,
      suggestion: '增加连接池大小，优化请求队列处理'
    });
  }

  // 规则引擎分析
  const ruleTests = Object.keys(results.tests).filter(k => k.startsWith('rule_engine_'));
  ruleTests.forEach(key => {
    const test = results.tests[key];
    const latency = parseFloat(test.avgLatency);
    if (latency > 20) {
      recommendations.push({
        priority: '中',
        issue: `规则引擎延迟较高: ${test.avgLatency}`,
        suggestion: '优化正则表达式，考虑预编译缓存'
      });
    }
  });

  // 数据库分析
  if (results.tests.database_write) {
    const latency = parseFloat(results.tests.database_write.avgLatency);
    if (latency > 5) {
      recommendations.push({
        priority: '中',
        issue: `数据库写入延迟: ${results.tests.database_write.avgLatency}`,
        suggestion: '考虑批量写入或异步队列'
      });
    }
  }

  // SSE 分析
  if (results.tests.sse_stability) {
    const sse = results.tests.sse_stability;
    if (sse.errors > 0) {
      recommendations.push({
        priority: '高',
        issue: `SSE 连接不稳定，${sse.errors} 个错误`,
        suggestion: '检查连接超时设置和资源清理'
      });
    }
  }

  // 内存分析
  if (results.tests.memory) {
    const mem = results.tests.memory;
    if (mem.leakRisk === '高') {
      recommendations.push({
        priority: '高',
        issue: '检测到潜在内存泄漏',
        suggestion: '检查事件监听器、数据库连接池、SSE 连接管理'
      });
    }
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

  return reportFile;
}

// 显示摘要
function displaySummary() {
  console.log('\n' + '='.repeat(80));
  console.log('PROMPTXY v2.0 性能测试报告');
  console.log('='.repeat(80));
  console.log(`测试时间: ${new Date().toLocaleString()}`);
  console.log('');

  // 并发测试
  console.log('【并发请求测试】');
  const concurrentTests = Object.keys(results.tests).filter(k => k.startsWith('concurrent_'));
  concurrentTests.forEach(key => {
    const test = results.tests[key];
    console.log(`  ${key.replace('concurrent_', '')}: ${test.rps} RPS, ` +
                `延迟: ${test.avgLatency}, ` +
                `成功: ${test.successful}/${test.requests}`);
  });
  console.log('');

  // 规则引擎
  console.log('【规则引擎性能】');
  const ruleTests = Object.keys(results.tests).filter(k => k.startsWith('rule_engine_'));
  ruleTests.forEach(key => {
    const test = results.tests[key];
    console.log(`  ${key.replace('rule_engine_', '')}: ${test.avgLatency}, ` +
                `吞吐量: ${test.throughput}`);
  });
  console.log('');

  // 数据库
  if (results.tests.database_write) {
    const db = results.tests.database_write;
    console.log('【数据库写入性能】');
    console.log(`  写入: ${db.successful}/${db.iterations}`);
    console.log(`  平均延迟: ${db.avgLatency}`);
    console.log(`  总记录: ${db.totalRecords}, 大小: ${db.dbSize}`);
  }
  console.log('');

  // SSE
  if (results.tests.sse_stability) {
    const sse = results.tests.sse_stability;
    console.log('【SSE 连接稳定性】');
    console.log(`  连接: ${sse.active}/${sse.connections}`);
    console.log(`  稳定率: ${sse.stabilityRate}`);
    console.log(`  事件: ${sse.events}, 错误: ${sse.errors}`);
  }
  console.log('');

  // 内存
  if (results.tests.memory) {
    const mem = results.tests.memory;
    console.log('【内存监控】');
    console.log(`  使用: ${mem.avg} (峰值: ${mem.max})`);
    console.log(`  趋势: ${mem.trend}`);
    console.log(`  泄漏风险: ${mem.leakRisk === '高' ? '⚠️' : '✅'} ${mem.leakRisk}`);
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

  console.log('\n' + '='.repeat(80));
}

// 主测试流程
async function runTests() {
  console.log('🚀 PromptXY v2.0 性能测试开始\n');

  try {
    await testConnectivity();
    await testConcurrentRequests();
    await testRuleEngine();
    await testDatabase();
    await testSSE();
    await monitorMemory();

    const reportFile = generateReport();
    displaySummary();

    console.log(`\n✅ 测试完成！详细报告: ${reportFile}`);

  } catch (error) {
    console.log(`\n❌ 测试失败: ${error.message}`);
    console.error(error);
  }
}

runTests();