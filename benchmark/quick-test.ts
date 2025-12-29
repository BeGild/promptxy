/**
 * 快速验证基准测试框架
 * 用于快速检查测试框架是否正常工作
 */

import * as os from 'node:os';
import {
  PerformanceBenchmark,
  TestScenario,
  SuccessCriteria,
} from './performance-benchmark-framework.js';

// 简单的测试场景
const quickTestScenarios: TestScenario[] = [
  {
    name: '快速延迟测试',
    description: '测试基本延迟指标',
    config: {
      duration: {
        warmup: 100,
        test: 500,
        cooldown: 100,
      },
    },
    criteria: {
      latency: {
        maxAvgLatency: 50,
        maxP95Latency: 100,
        maxP99Latency: 200,
      },
      throughput: {
        minRPS: 10,
        minSuccessRate: 95,
      },
      resources: {
        maxMemoryIncrease: 10,
        maxMemoryLeakRate: 1,
      },
      stability: {
        maxErrorRate: 5,
        maxConnectionFailures: 2,
      },
    },
  },
];

async function runQuickTest() {
  console.log('🧪 快速基准测试验证\n');

  const config = {
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: Math.floor(os.totalmem() / 1024 / 1024),
      cpuCores: os.cpus().length,
    },
    services: {
      gateway: { host: 'localhost', port: 7070 },
      api: { host: 'localhost', port: 7071 },
    },
    parameters: {
      warmupIterations: 5,
      testIterations: 10,
      cooldownDelay: 100,
      timeout: 5000,
    },
    report: {
      outputDir: './benchmark-results',
      formats: ['md', 'json'],
      includeMetrics: ['latency', 'throughput', 'resources'],
    },
  };

  const benchmark = new PerformanceBenchmark(config);

  try {
    // 执行测试
    const results = await benchmark.executeAll(quickTestScenarios);

    // 生成报告
    const report = await benchmark.generateReport(results);

    console.log('✅ 快速测试完成');
    console.log(`\n测试结果: ${report.summary.passed}/${report.summary.totalTests} 通过`);
    console.log(`综合评分: ${report.summary.overallScore.toFixed(1)}/100`);

    // 显示详细结果
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.scenario}`);
      console.log(`   状态: ${result.status === 'pass' ? '✅ 通过' : '❌ 失败'}`);
      if (result.metrics.throughput.rps > 0) {
        console.log(`   RPS: ${result.metrics.throughput.rps.toFixed(1)}`);
      }
      if (result.metrics.latency.avg > 0) {
        console.log(`   延迟: ${result.metrics.latency.avg.toFixed(2)}ms`);
      }
      if (result.violations.length > 0) {
        console.log(`   违规: ${result.violations.join(', ')}`);
      }
    });

    return true;
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return false;
  }
}

// 简单的性能测试函数
async function runSimplePerformanceTests() {
  console.log('🎯 简单性能测试\n');

  const timer = {
    start: performance.now(),
    measurements: [] as number[],
  };

  // 测试 1: 空循环性能
  console.log('测试 1: 空循环');
  for (let i = 0; i < 1000; i++) {
    const start = performance.now();
    // 空循环
    for (let j = 0; j < 100; j++) {}
    const duration = performance.now() - start;
    timer.measurements.push(duration);
  }

  const avg = timer.measurements.reduce((a, b) => a + b, 0) / timer.measurements.length;
  console.log(`   平均耗时: ${avg.toFixed(4)}ms`);
  console.log(`   总耗时: ${(performance.now() - timer.start).toFixed(2)}ms`);

  // 测试 2: 对象操作性能
  console.log('\n测试 2: 对象操作');
  const objStart = performance.now();
  const obj: any = {};
  for (let i = 0; i < 10000; i++) {
    obj[`key${i}`] = { value: i, data: `test-${i}` };
  }
  const objDuration = performance.now() - objStart;
  console.log(`   10000次对象操作: ${objDuration.toFixed(2)}ms`);

  // 测试 3: 数组操作性能
  console.log('\n测试 3: 数组操作');
  const arrStart = performance.now();
  let arr: number[] = [];
  for (let i = 0; i < 10000; i++) {
    arr.push(i);
    if (i % 100 === 0) {
      arr = arr.filter(x => x % 2 === 0);
    }
  }
  const arrDuration = performance.now() - arrStart;
  console.log(`   10000次数组操作: ${arrDuration.toFixed(2)}ms`);

  // 测试 4: JSON 序列化性能
  console.log('\n测试 4: JSON 序列化');
  const data = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `item-${i}`,
    data: { value: i * 2, tags: ['a', 'b', 'c'] },
  }));

  const jsonStart = performance.now();
  const jsonStr = JSON.stringify(data);
  const jsonDuration = performance.now() - jsonStart;
  console.log(`   序列化 1000 对象: ${jsonDuration.toFixed(2)}ms`);
  console.log(`   数据大小: ${(jsonStr.length / 1024).toFixed(2)}KB`);

  const parseStart = performance.now();
  const parsed = JSON.parse(jsonStr);
  const parseDuration = performance.now() - parseStart;
  console.log(`   反序列化: ${parseDuration.toFixed(2)}ms`);

  // 测试 5: 正则表达式性能
  console.log('\n测试 5: 正则表达式');
  const testText = 'The quick brown fox jumps over the lazy dog. '.repeat(10);
  const regex = /fox|dog|lazy/g;

  const regexStart = performance.now();
  for (let i = 0; i < 1000; i++) {
    regex.test(testText);
  }
  const regexDuration = performance.now() - regexStart;
  console.log(`   1000次正则匹配: ${regexDuration.toFixed(2)}ms`);

  console.log('\n✅ 所有简单测试完成');
}

// 内存监控演示
async function demonstrateMemoryMonitoring() {
  console.log('\n💾 内存监控演示\n');

  const monitor = {
    snapshots: [] as Array<{ time: number; heapUsed: number; heapTotal: number }>,
    start: Date.now(),

    snapshot() {
      const usage = process.memoryUsage();
      this.snapshots.push({
        time: Date.now() - this.start,
        heapUsed: usage.heapUsed / 1024 / 1024,
        heapTotal: usage.heapTotal / 1024 / 1024,
      });
    },

    report() {
      if (this.snapshots.length === 0) return;

      const first = this.snapshots[0];
      const last = this.snapshots[this.snapshots.length - 1];
      const delta = last.heapUsed - first.heapUsed;

      console.log('内存使用情况:');
      console.log(`  初始: ${first.heapUsed.toFixed(2)}MB`);
      console.log(`  最终: ${last.heapUsed.toFixed(2)}MB`);
      console.log(`  变化: ${delta.toFixed(2)}MB`);
      console.log(`  峰值: ${Math.max(...this.snapshots.map(s => s.heapUsed)).toFixed(2)}MB`);
    },
  };

  // 初始快照
  monitor.snapshot();

  // 模拟一些内存分配
  const data: any[] = [];
  for (let i = 0; i < 100; i++) {
    data.push({
      id: i,
      content: 'x'.repeat(1000),
      nested: Array.from({ length: 10 }, (_, j) => ({ value: i * j, data: 'y'.repeat(100) })),
    });
    if (i % 20 === 0) {
      monitor.snapshot();
    }
  }

  // 清理部分数据
  data.splice(0, 50);
  monitor.snapshot();

  // 清理所有数据
  data.length = 0;
  monitor.snapshot();

  // 等待 GC
  await new Promise(resolve => setTimeout(resolve, 100));
  monitor.snapshot();

  monitor.report();
}

// 主函数
async function main() {
  console.log('PromptXY v2.0 基准测试框架验证\n');

  // 运行简单测试
  await runSimplePerformanceTests();

  // 内存监控演示
  await demonstrateMemoryMonitoring();

  // 框架验证
  console.log('\n🔧 框架验证\n');
  const success = await runQuickTest();

  if (success) {
    console.log('\n🎉 基准测试框架验证成功！');
    console.log('可以使用 "tsx benchmark/run-benchmarks.ts" 运行完整测试');
  } else {
    console.log('\n⚠️  框架验证遇到问题，请检查环境配置');
  }
}

// 运行主函数
main().catch(console.error);
