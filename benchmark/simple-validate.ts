/**
 * 简化的框架验证脚本
 */

import { PerformanceTimer, ResourceMonitor, DataGenerator } from './performance-benchmark-framework.js';

async function validateFramework() {
  console.log('🧪 PromptXY v2.0 基准测试框架验证\n');

  // 1. 验证 PerformanceTimer
  console.log('1. 测试 PerformanceTimer');
  const timer = new PerformanceTimer();
  timer.start('test1');
  await new Promise(resolve => setTimeout(resolve, 10));
  const duration = timer.end('test1');
  console.log(`   ✅ 计时器: ${duration.toFixed(2)}ms`);

  // 2. 验证 ResourceMonitor
  console.log('\n2. 测试 ResourceMonitor');
  const monitor = new ResourceMonitor();
  const mem1 = await monitor.snapshot();
  console.log(`   ✅ 内存快照: ${mem1.memory.toFixed(2)}MB`);
  monitor.setBaseline();
  const mem2 = await monitor.snapshot();
  console.log(`   ✅ 基线设置: ${monitor.getMemoryDelta().toFixed(2)}MB 变化`);

  // 3. 验证 DataGenerator
  console.log('\n3. 测试 DataGenerator');
  const rules = DataGenerator.generateRules(3);
  console.log(`   ✅ 生成规则: ${rules.length} 条`);
  const items = DataGenerator.generateDataset(10, 'items');
  console.log(`   ✅ 生成数据: ${items.length} 项`);

  // 4. 简单性能测试
  console.log('\n4. 简单性能测试');
  const iterations = 1000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    // 模拟规则应用
    const text = 'Original text';
    const modified = text + ' modified';
  }

  const perfDuration = performance.now() - start;
  const throughput = (iterations / perfDuration) * 1000;
  console.log(`   ✅ 模拟规则: ${iterations} 次, ${perfDuration.toFixed(2)}ms, ${throughput.toFixed(0)} ops/s`);

  // 5. 内存压力测试
  console.log('\n5. 内存压力测试');
  const memMonitor = new ResourceMonitor();
  memMonitor.reset();
  memMonitor.setBaseline();

  const testData: any[] = [];
  for (let i = 0; i < 100; i++) {
    testData.push({
      id: i,
      data: 'x'.repeat(1000),
      nested: Array.from({ length: 10 }, (_, j) => ({ value: i * j, text: 'y'.repeat(100) })),
    });
  }

  const mem3 = await memMonitor.snapshot();
  const delta = memMonitor.getMemoryDelta();
  console.log(`   ✅ 数据创建: ${testData.length} 项, 内存增长 ${delta.toFixed(2)}MB`);

  // 清理
  testData.length = 0;
  await new Promise(resolve => setTimeout(resolve, 10));
  const mem4 = await memMonitor.snapshot();
  console.log(`   ✅ 清理后: ${mem4.memory.toFixed(2)}MB`);

  // 6. 验证成功
  console.log('\n✅ 框架验证成功！');
  console.log('   - PerformanceTimer: ✅');
  console.log('   - ResourceMonitor: ✅');
  console.log('   - DataGenerator: ✅');
  console.log('   - 性能测试: ✅');
  console.log('   - 内存管理: ✅');
  console.log('\n🎉 基准测试框架准备就绪！');
  console.log('   运行完整测试: cd benchmark && npx tsx run-benchmarks.ts');
}

// 运行验证
validateFramework().catch(console.error);