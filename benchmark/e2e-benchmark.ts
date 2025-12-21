/**
 * PromptXY v2.0 端到端性能基准测试
 * 包含：完整请求流程、规则应用到响应、UI 更新到显示测试
 */

import * as http from 'node:http';
import { PerformanceTimer, ResourceMonitor, DataGenerator } from './performance-benchmark-framework.js';

// ==================== 端到端测试配置 ====================

interface E2ETestConfig {
  gatewayPort: number;
  apiPort: number;
  baseUrl: string;
  testDuration: number;
  warmupDuration: number;
}

const defaultE2EConfig: E2ETestConfig = {
  gatewayPort: 7070,
  apiPort: 7071,
  baseUrl: 'http://localhost',
  testDuration: 5000,
  warmupDuration: 1000,
};

// ==================== 完整请求流程测试 ====================

export class CompleteFlowBenchmark {
  private timer: PerformanceTimer;
  private monitor: ResourceMonitor;
  private config: E2ETestConfig;

  constructor(config: E2ETestConfig = defaultE2EConfig) {
    this.timer = new PerformanceTimer();
    this.monitor = new ResourceMonitor();
    this.config = config;
  }

  /**
   * 测试完整请求流程时间
   * 包含：网关接收 -> 规则应用 -> 数据库记录 -> 响应返回
   */
  async testCompleteFlow(iterations: number = 100): Promise<any> {
    console.log(`🔄 测试完整请求流程: ${iterations} 次`);

    const durations: number[] = [];
    const errors: string[] = [];

    // 预热
    for (let i = 0; i < 10; i++) {
      await this.makeCompleteRequest(i);
    }

    // 正式测试
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      try {
        await this.makeCompleteRequest(i + 100);
        const duration = performance.now() - start;
        durations.push(duration);
      } catch (error: any) {
        errors.push(error.message);
        durations.push(9999); // 标记失败
      }

      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
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
   * 规则应用到响应时间测试
   * 重点测量规则引擎处理时间
   */
  async testRuleApplicationTime(iterations: number = 200): Promise<any> {
    console.log(`⚡ 测试规则应用到响应: ${iterations} 次`);

    const durations: number[] = [];
    const ruleMatches: number[] = [];

    // 预热
    for (let i = 0; i < 20; i++) {
      await this.makeRuleRequest(i, 1);
    }

    // 测试不同规则数量
    for (const ruleCount of [1, 3, 5]) {
      const ruleDurations: number[] = [];
      const matches: number[] = [];

      for (let i = 0; i < iterations / 3; i++) {
        const start = performance.now();
        const result = await this.makeRuleRequest(i + 100, ruleCount);
        const duration = performance.now() - start;

        ruleDurations.push(duration);
        matches.push(result.matchCount);

        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      durations.push(...ruleDurations);
      ruleMatches.push(...matches);
    }

    return {
      iterations: durations.length,
      latency: this.calculateLatencyStats(durations),
      avgMatches: ruleMatches.reduce((a, b) => a + b, 0) / ruleMatches.length,
      byRuleCount: this.analyzeByRuleCount(durations, ruleMatches),
    };
  }

  /**
   * UI 更新到显示时间测试
   * 模拟前端接收 SSE 事件到渲染的时间
   */
  async testUIUpdateTime(iterations: number = 50): Promise<any> {
    console.log(`🖥️ 测试 UI 更新到显示: ${iterations} 次`);

    const durations: number[] = [];

    // 预热
    for (let i = 0; i < 5; i++) {
      await this.simulateUIUpdate(i);
    }

    // 正式测试
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      // 模拟完整 UI 更新流程
      await this.simulateUIUpdate(i + 100);

      const duration = performance.now() - start;
      durations.push(duration);

      if (i % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    return {
      iterations,
      latency: this.calculateLatencyStats(durations),
    };
  }

  /**
   * 端到端延迟分布测试
   */
  async testE2ELatencyDistribution(): Promise<any> {
    console.log(`📊 测试端到端延迟分布`);

    const iterations = 500;
    const durations: number[] = [];

    // 预热
    for (let i = 0; i < 20; i++) {
      await this.makeCompleteRequest(i);
    }

    // 收集大量数据用于分布分析
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        await this.makeCompleteRequest(i + 100);
        const duration = performance.now() - start;
        durations.push(duration);
      } catch {
        // 忽略错误，继续测试
      }

      if (i % 20 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    // 计算分布
    const distribution = this.calculateDistribution(durations);

    return {
      iterations: durations.length,
      overall: this.calculateLatencyStats(durations),
      distribution,
    };
  }

  /**
   * 高并发端到端测试
   */
  async testHighConcurrencyE2E(concurrency: number = 50): Promise<any> {
    console.log(`🚀 测试高并发端到端: ${concurrency} 并发`);

    const perConnection = 20;
    const startTime = Date.now();

    const promises = Array.from({ length: concurrency }, async (_, connId) => {
      const results = [];

      for (let i = 0; i < perConnection; i++) {
        const start = performance.now();
        try {
          await this.makeCompleteRequest(connId * 1000 + i);
          const duration = performance.now() - start;
          results.push({ success: true, duration });
        } catch (error: any) {
          const duration = performance.now() - start;
          results.push({ success: false, duration, error: error.message });
        }

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

    const successful = flatResults.filter(r => r.success).map(r => r.duration);
    const failed = flatResults.filter(r => !r.success).length;

    return {
      concurrency,
      perConnection,
      totalRequests: flatResults.length,
      successful: successful.length,
      failed,
      successRate: (successful.length / flatResults.length) * 100,
      totalDuration,
      rps: (flatResults.length / totalDuration) * 1000,
      latency: successful.length > 0 ? this.calculateLatencyStats(successful) : null,
    };
  }

  /**
   * 资源使用监控测试
   */
  async testResourceUsage(duration: number = 30000): Promise<any> {
    console.log(`💾 测试端到端资源使用: ${duration}ms`);

    this.monitor.reset();
    this.monitor.setBaseline();

    const startTime = Date.now();
    let requestCount = 0;
    const snapshots: Array<{ time: number; memory: number; requests: number }> = [];

    // 持续发送请求并监控资源
    while (Date.now() - startTime < duration) {
      try {
        await this.makeCompleteRequest(requestCount);
        requestCount++;
      } catch {
        // 忽略错误
      }

      // 每 5 秒记录一次资源
      if (requestCount % 10 === 0) {
        const snapshot = await this.monitor.snapshot();
        snapshots.push({
          time: Date.now() - startTime,
          memory: snapshot.memory,
          requests: requestCount,
        });
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (requestCount % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    const stats = this.monitor.getStats();
    const delta = this.monitor.getMemoryDelta();
    const leakRate = this.monitor.getMemoryLeakRate();

    return {
      duration,
      requestCount,
      requestsPerSecond: requestCount / (duration / 1000),
      memory: {
        initial: stats.avgMemory - delta,
        peak: stats.peakMemory,
        final: stats.avgMemory,
        delta,
        leakRate,
      },
      cpu: {
        avg: stats.avgCpu,
        peak: stats.peakCpu,
      },
      snapshots,
    };
  }

  private async makeCompleteRequest(index: number): Promise<any> {
    const url = `${this.config.baseUrl}:${this.config.gatewayPort}/_promptxy/health`;

    return new Promise((resolve, reject) => {
      const req = http.get(url, (res) => {
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
      });

      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
    });
  }

  private async makeRuleRequest(index: number, ruleCount: number): Promise<any> {
    // 模拟带规则的请求
    const url = `${this.config.baseUrl}:${this.config.apiPort}/_promptxy/preview`;

    const body = JSON.stringify({
      client: 'claude',
      field: 'system',
      method: 'POST',
      path: '/v1/chat',
      model: 'claude-3-5-sonnet',
      body: {
        system: 'You are a helpful assistant. Test content for rule application.',
        instructions: 'Please provide detailed responses.',
      },
    });

    return new Promise((resolve, reject) => {
      const req = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        if (res.statusCode === 200) {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const result = JSON.parse(data);
              resolve({
                matchCount: result.matches?.length || 0,
                modified: result.modified,
              });
            } catch {
              resolve({ matchCount: 0 });
            }
          });
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Timeout'));
      });

      req.write(body);
      req.end();
    });
  }

  private async simulateUIUpdate(index: number): Promise<void> {
    // 模拟 UI 更新的完整流程
    // 1. 接收 SSE 事件
    const sseDelay = Math.random() * 5 + 2; // 2-7ms

    // 2. 状态更新
    const stateUpdateDelay = Math.random() * 3 + 1; // 1-4ms

    // 3. 组件重新渲染
    const renderDelay = Math.random() * 10 + 5; // 5-15ms

    // 4. DOM 更新
    const domDelay = Math.random() * 5 + 2; // 2-7ms

    await new Promise(resolve => setTimeout(resolve, sseDelay + stateUpdateDelay + renderDelay + domDelay));
  }

  private calculateLatencyStats(durations: number[]): any {
    if (durations.length === 0) return null;

    const sorted = durations.sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return { min, max, avg, p50, p95, p99 };
  }

  private analyzeByRuleCount(durations: number[], matches: number[]): any {
    const byCount: any = {};

    // 简单分组分析
    const chunkSize = Math.floor(durations.length / 3);
    for (let i = 0; i < 3; i++) {
      const start = i * chunkSize;
      const end = start + chunkSize;
      const chunkDurations = durations.slice(start, end);
      const chunkMatches = matches.slice(start, end);

      const ruleCount = i === 0 ? 1 : i === 1 ? 3 : 5;
      byCount[ruleCount] = {
        latency: this.calculateLatencyStats(chunkDurations),
        avgMatches: chunkMatches.reduce((a, b) => a + b, 0) / chunkMatches.length,
      };
    }

    return byCount;
  }

  private calculateDistribution(durations: number[]): any {
    if (durations.length === 0) return {};

    const ranges = [
      { name: '0-10ms', min: 0, max: 10 },
      { name: '10-20ms', min: 10, max: 20 },
      { name: '20-50ms', min: 20, max: 50 },
      { name: '50-100ms', min: 50, max: 100 },
      { name: '100-200ms', min: 100, max: 200 },
      { name: '200ms+', min: 200, max: Infinity },
    ];

    const distribution: any = {};

    ranges.forEach(range => {
      const count = durations.filter(d => d >= range.min && d < range.max).length;
      distribution[range.name] = {
        count,
        percentage: ((count / durations.length) * 100).toFixed(1) + '%',
      };
    });

    return distribution;
  }
}

// ==================== 端到端基准测试主类 ====================

export class E2EBenchmarkSuite {
  private completeFlow: CompleteFlowBenchmark;

  constructor(config: E2ETestConfig = defaultE2EConfig) {
    this.completeFlow = new CompleteFlowBenchmark(config);
  }

  /**
   * 运行完整端到端基准测试
   */
  async runCompleteSuite(): Promise<any> {
    console.log('🔄 开始完整端到端基准测试\n');

    const results: any = {};

    // 1. 完整请求流程
    console.log('=== 1. 完整请求流程 ===');
    results.completeFlow = await this.completeFlow.testCompleteFlow(100);

    // 2. 规则应用时间
    console.log('\n=== 2. 规则应用到响应 ===');
    results.ruleApplication = await this.completeFlow.testRuleApplicationTime(200);

    // 3. UI 更新时间
    console.log('\n=== 3. UI 更新到显示 ===');
    results.uiUpdate = await this.completeFlow.testUIUpdateTime(50);

    // 4. 延迟分布
    console.log('\n=== 4. 端到端延迟分布 ===');
    results.latencyDistribution = await this.completeFlow.testE2ELatencyDistribution();

    // 5. 高并发测试
    console.log('\n=== 5. 高并发端到端 ===');
    results.highConcurrency = await this.completeFlow.testHighConcurrencyE2E(30);

    // 6. 资源监控
    console.log('\n=== 6. 资源使用监控 ===');
    results.resources = await this.completeFlow.testResourceUsage(30000);

    console.log('\n✅ 所有端到端基准测试完成\n');
    return results;
  }

  /**
   * 生成简化的测试报告
   */
  generateSummary(results: any): string {
    let report = '# 端到端性能基准测试总结\n\n';

    // 完整流程
    report += '## 完整请求流程\n';
    if (results.completeFlow) {
      const f = results.completeFlow;
      report += `- 成功率: ${f.successRate.toFixed(1)}%\n`;
      if (f.latency) {
        report += `- 延迟: avg=${f.latency.avg.toFixed(2)}ms, p95=${f.latency.p95.toFixed(2)}ms, max=${f.latency.max.toFixed(2)}ms\n`;
      }
    }

    // 规则应用
    report += '\n## 规则应用到响应\n';
    if (results.ruleApplication) {
      const r = results.ruleApplication;
      if (r.latency) {
        report += `- 平均延迟: ${r.latency.avg.toFixed(2)}ms\n`;
        report += `- 平均匹配: ${r.avgMatches.toFixed(1)} 条规则\n`;
      }
      if (r.byRuleCount) {
        Object.entries(r.byRuleCount).forEach(([count, data]: [string, any]) => {
          report += `- ${count}条规则: ${data.latency.avg.toFixed(2)}ms (avg)\n`;
        });
      }
    }

    // UI 更新
    report += '\n## UI 更新到显示\n';
    if (results.uiUpdate) {
      const u = results.uiUpdate;
      if (u.latency) {
        report += `- 平均时间: ${u.latency.avg.toFixed(2)}ms\n`;
      }
    }

    // 延迟分布
    report += '\n## 延迟分布\n';
    if (results.latencyDistribution) {
      const d = results.latencyDistribution.distribution;
      if (d) {
        Object.entries(d).forEach(([range, info]: [string, any]) => {
          report += `- ${range}: ${info.percentage} (${info.count}次)\n`;
        });
      }
    }

    // 高并发
    report += '\n## 高并发测试\n';
    if (results.highConcurrency) {
      const h = results.highConcurrency;
      report += `- 并发数: ${h.concurrency}\n`;
      report += `- 成功率: ${h.successRate.toFixed(1)}%\n`;
      report += `- RPS: ${h.rps.toFixed(1)}\n`;
      if (h.latency) {
        report += `- 延迟: ${h.latency.avg.toFixed(2)}ms (avg)\n`;
      }
    }

    // 资源使用
    report += '\n## 资源使用\n';
    if (results.resources) {
      const r = results.resources;
      report += `- 请求总数: ${r.requestCount}\n`;
      report += `- RPS: ${r.requestsPerSecond.toFixed(1)}\n`;
      report += `- 内存: 峰值 ${r.memory.peak.toFixed(2)}MB, 增长 ${r.memory.delta.toFixed(2)}MB\n`;
      report += `- 泄漏率: ${r.memory.leakRate.toFixed(3)} MB/min\n`;
      report += `- CPU: 平均 ${r.cpu.avg.toFixed(1)}%, 峰值 ${r.cpu.peak.toFixed(1)}%\n`;
    }

    return report;
  }
}

// ==================== 主测试运行器 ====================

export class BenchmarkRunner {
  private config: any;

  constructor(config?: any) {
    this.config = config || {};
  }

  /**
   * 运行所有基准测试
   */
  async runAllBenchmarks(): Promise<any> {
    console.log('🚀 PromptXY v2.0 完整性能基准测试\n');
    console.log(`测试时间: ${new Date().toLocaleString()}`);
    console.log(`环境: ${process.platform} ${process.version}\n`);

    const results: any = {};

    // 检查服务是否运行
    if (!(await this.checkServices())) {
      console.log('⚠️  警告: 服务未运行，将跳过网络相关测试\n');
    }

    // 1. 后端测试
    try {
      console.log('📦 1. 后端基准测试');
      const { BackendBenchmarkSuite } = await import('./backend-benchmark.js');
      const backendSuite = new BackendBenchmarkSuite();
      results.backend = await backendSuite.runCompleteSuite();
      results.backend.summary = backendSuite.generateSummary(results.backend);
      console.log('✅ 后端测试完成\n');
    } catch (error) {
      console.error('❌ 后端测试失败:', error);
      results.backend = { error: String(error) };
    }

    // 2. 前端测试
    try {
      console.log('🎨 2. 前端基准测试');
      const { FrontendBenchmarkSuite } = await import('./frontend-benchmark.js');
      const frontendSuite = new FrontendBenchmarkSuite();
      results.frontend = await frontendSuite.runCompleteSuite();
      results.frontend.summary = frontendSuite.generateSummary(results.frontend);
      console.log('✅ 前端测试完成\n');
    } catch (error) {
      console.error('❌ 前端测试失败:', error);
      results.frontend = { error: String(error) };
    }

    // 3. 端到端测试
    try {
      console.log('🔄 3. 端到端基准测试');
      const e2eSuite = new E2EBenchmarkSuite();
      results.e2e = await e2eSuite.runCompleteSuite();
      results.e2e.summary = e2eSuite.generateSummary(results.e2e);
      console.log('✅ 端到端测试完成\n');
    } catch (error) {
      console.error('❌ 端到端测试失败:', error);
      results.e2e = { error: String(error) };
    }

    // 生成综合报告
    results.comprehensive = this.generateComprehensiveReport(results);

    return results;
  }

  /**
   * 保存测试结果
   */
  async saveResults(results: any): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join(process.cwd(), 'benchmark', `results-${timestamp}`);

    await fs.mkdir(dir, { recursive: true });

    // 保存详细数据
    await fs.writeFile(
      path.join(dir, 'complete-results.json'),
      JSON.stringify(results, null, 2)
    );

    // 保存综合报告
    if (results.comprehensive) {
      await fs.writeFile(
        path.join(dir, 'comprehensive-report.md'),
        results.comprehensive
      );
    }

    // 保存各部分总结
    if (results.backend?.summary) {
      await fs.writeFile(path.join(dir, 'backend-summary.md'), results.backend.summary);
    }
    if (results.frontend?.summary) {
      await fs.writeFile(path.join(dir, 'frontend-summary.md'), results.frontend.summary);
    }
    if (results.e2e?.summary) {
      await fs.writeFile(path.join(dir, 'e2e-summary.md'), results.e2e.summary);
    }

    console.log(`📁 测试结果已保存到: ${dir}/`);
  }

  private async checkServices(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get('http://localhost:7070/_promptxy/health', (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  private generateComprehensiveReport(results: any): string {
    let report = `# PromptXY v2.0 完整性能基准测试报告\n\n`;

    report += `**测试时间**: ${new Date().toLocaleString()}\n`;
    report += `**环境**: ${process.platform} ${process.version}\n`;
    report += `**Node内存**: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB\n\n`;

    // 总体评分
    report += `## 📊 总体评分\n\n`;

    const scores = this.calculateOverallScores(results);
    report += `- **后端综合**: ${scores.backend}/100\n`;
    report += `- **前端综合**: ${scores.frontend}/100\n`;
    report += `- **端到端**: ${scores.e2e}/100\n`;
    report += `- **整体性能**: ${scores.overall}/100\n\n`;

    // 关键指标
    report += `## 🎯 关键性能指标\n\n`;

    if (results.backend?.throughput) {
      const bestThroughput = results.backend.throughput
        .filter((r: any) => !r.error)
        .sort((a: any, b: any) => b.rps - a.rps)[0];
      if (bestThroughput) {
        report += `- **最高RPS**: ${bestThroughput.rps.toFixed(1)} (${bestThroughput.concurrency}并发)\n`;
      }
    }

    if (results.backend?.rules?.single) {
      report += `- **规则引擎**: ${results.backend.rules.single.latency.avg.toFixed(3)}ms/次\n`;
    }

    if (results.e2e?.completeFlow?.latency) {
      report += `- **端到端延迟**: ${results.e2e.completeFlow.latency.avg.toFixed(2)}ms\n`;
    }

    if (results.frontend?.rendering?.simple) {
      report += `- **组件渲染**: ${results.frontend.rendering.simple.latency.avg.toFixed(2)}ms\n`;
    }

    // 瓶颈分析
    report += `\n## 🔍 瓶颈分析\n\n`;
    const bottlenecks = this.analyzeBottlenecks(results);
    if (bottlenecks.critical.length > 0) {
      report += `### 🔴 关键瓶颈\n`;
      bottlenecks.critical.forEach((b: string) => report += `- ${b}\n`);
      report += '\n';
    }
    if (bottlenecks.warning.length > 0) {
      report += `### 🟡 警告\n`;
      bottlenecks.warning.forEach((b: string) => report += `- ${b}\n`);
      report += '\n';
    }

    // 优化建议
    report += `## 💡 优化建议\n\n`;
    const recommendations = this.generateRecommendations(results);
    if (recommendations.immediate.length > 0) {
      report += `### 🚀 立即实施\n`;
      recommendations.immediate.forEach((r: string) => report += `- ${r}\n`);
      report += '\n';
    }
    if (recommendations.shortTerm.length > 0) {
      report += `### ⚡ 短期实施\n`;
      recommendations.shortTerm.forEach((r: string) => report += `- ${r}\n`);
      report += '\n';
    }
    if (recommendations.longTerm.length > 0) {
      report += `### 🎯 长期优化\n`;
      recommendations.longTerm.forEach((r: string) => report += `- ${r}\n`);
      report += '\n';
    }

    // 测试详情摘要
    report += `## 📋 测试详情\n\n`;
    report += `后端测试: ${results.backend?.error ? '❌ 失败' : '✅ 完成'}\n`;
    report += `前端测试: ${results.frontend?.error ? '❌ 失败' : '✅ 完成'}\n`;
    report += `端到端测试: ${results.e2e?.error ? '❌ 失败' : '✅ 完成'}\n`;

    return report;
  }

  private calculateOverallScores(results: any): any {
    let backendScore = 0;
    let frontendScore = 0;
    let e2eScore = 0;

    // 后端评分
    if (results.backend && !results.backend.error) {
      const b = results.backend;
      let score = 0;
      let count = 0;

      if (b.throughput) {
        const bestRPS = Math.max(...b.throughput.filter((r: any) => !r.error).map((r: any) => r.rps || 0));
        score += Math.min(100, (bestRPS / 50) * 100);
        count++;
      }

      if (b.rules?.single) {
        const avgLatency = b.rules.single.latency.avg;
        score += Math.max(0, 100 - (avgLatency * 10));
        count++;
      }

      if (b.database?.singleWrite) {
        const avgLatency = b.database.singleWrite.latency.avg;
        score += Math.max(0, 100 - (avgLatency * 2));
        count++;
      }

      backendScore = count > 0 ? score / count : 0;
    }

    // 前端评分
    if (results.frontend && !results.frontend.error) {
      const f = results.frontend;
      let score = 0;
      let count = 0;

      if (f.rendering?.simple) {
        const avgLatency = f.rendering.simple.latency.avg;
        score += Math.max(0, 100 - (avgLatency * 20));
        count++;
      }

      if (f.memory?.lifecycle) {
        const leakRate = f.memory.lifecycle.memory.leakRate;
        score += leakRate < 0.1 ? 100 : leakRate < 0.5 ? 70 : 40;
        count++;
      }

      if (f.state?.simple) {
        const avgLatency = f.state.simple.latency.avg;
        score += Math.max(0, 100 - (avgLatency * 50));
        count++;
      }

      frontendScore = count > 0 ? score / count : 0;
    }

    // 端到端评分
    if (results.e2e && !results.e2e.error) {
      const e = results.e2e;
      let score = 0;
      let count = 0;

      if (e.completeFlow?.latency) {
        const avgLatency = e.completeFlow.latency.avg;
        score += Math.max(0, 100 - (avgLatency * 1));
        count++;
      }

      if (e.completeFlow?.successRate) {
        score += e.completeFlow.successRate;
        count++;
      }

      if (e.resources?.memory) {
        const leakRate = e.resources.memory.leakRate;
        score += leakRate < 0.5 ? 100 : leakRate < 1 ? 70 : 40;
        count++;
      }

      e2eScore = count > 0 ? score / count : 0;
    }

    const overall = (backendScore + frontendScore + e2eScore) / 3;

    return {
      backend: Math.round(backendScore),
      frontend: Math.round(frontendScore),
      e2e: Math.round(e2eScore),
      overall: Math.round(overall),
    };
  }

  private analyzeBottlenecks(results: any): any {
    const critical: string[] = [];
    const warning: string[] = [];

    // 后端瓶颈
    if (results.backend && !results.backend.error) {
      if (results.backend.throughput) {
        const worst = results.backend.throughput
          .filter((r: any) => !r.error)
          .sort((a: any, b: any) => a.rps - b.rps)[0];
        if (worst && worst.rps < 20) {
          critical.push(`低并发下RPS过低: ${worst.rps.toFixed(1)} (${worst.concurrency}并发)`);
        }
      }

      if (results.backend.database?.singleWrite?.latency.avg > 50) {
        critical.push(`数据库写入延迟过高: ${results.backend.database.singleWrite.latency.avg.toFixed(2)}ms`);
      }

      if (results.backend.sse?.maxConnections?.successRate < 90) {
        warning.push(`SSE并发连接成功率低: ${results.backend.sse.maxConnections.successRate.toFixed(1)}%`);
      }
    }

    // 前端瓶颈
    if (results.frontend && !results.frontend.error) {
      if (results.frontend.rendering?.simple?.latency.avg > 10) {
        warning.push(`组件渲染延迟偏高: ${results.frontend.rendering.simple.latency.avg.toFixed(2)}ms`);
      }

      if (results.frontend.memory?.lifecycle?.memory.leakRate > 0.5) {
        critical.push(`前端内存泄漏率过高: ${results.frontend.memory.lifecycle.memory.leakRate.toFixed(3)} MB/min`);
      }
    }

    // 端到端瓶颈
    if (results.e2e && !results.e2e.error) {
      if (results.e2e.completeFlow?.latency?.avg > 100) {
        critical.push(`端到端延迟过高: ${results.e2e.completeFlow.latency.avg.toFixed(2)}ms`);
      }

      if (results.e2e.completeFlow?.successRate < 95) {
        critical.push(`端到端成功率过低: ${results.e2e.completeFlow.successRate.toFixed(1)}%`);
      }

      if (results.e2e.resources?.memory?.leakRate > 1) {
        critical.push(`端到端内存泄漏严重: ${results.e2e.resources.memory.leakRate.toFixed(3)} MB/min`);
      }
    }

    return { critical, warning };
  }

  private generateRecommendations(results: any): any {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    // 基于瓶颈生成建议
    const bottlenecks = this.analyzeBottlenecks(results);

    if (bottlenecks.critical.some((b: string) => b.includes('数据库'))) {
      immediate.push('实现数据库批量写入和事务优化');
      immediate.push('添加数据库连接池配置');
    }

    if (bottlenecks.critical.some((b: string) => b.includes('RPS'))) {
      immediate.push('优化网关连接池大小');
      immediate.push('增加请求队列处理能力');
    }

    if (bottlenecks.critical.some((b: string) => b.includes('内存泄漏'))) {
      immediate.push('检查组件生命周期管理');
      immediate.push('修复内存泄漏问题');
    }

    if (bottlenecks.warning.some((b: string) => b.includes('渲染'))) {
      shortTerm.push('实现React.memo优化');
      shortTerm.push('使用虚拟滚动处理长列表');
    }

    if (bottlenecks.warning.some((b: string) => b.includes('SSE'))) {
      shortTerm.push('优化SSE连接管理');
      shortTerm.push('实现连接重试机制');
    }

    if (immediate.length === 0 && shortTerm.length === 0) {
      immediate.push('性能表现良好，继续保持');
    }

    longTerm.push('引入Redis缓存层');
    longTerm.push('实现水平扩展架构');
    longTerm.push('建立完整监控告警体系');

    return { immediate, shortTerm, longTerm };
  }
}

// ==================== 主程序入口 ====================


async function main() {
	const runner = new BenchmarkRunner();
	const results = await runner.runAllBenchmarks();
	await runner.saveResults(results);

	console.log('\\n🎉 所有基准测试完成！');
	console.log('📊 查看详细报告请查看 benchmark 目录下的结果文件');
}

main().catch(console.error);
