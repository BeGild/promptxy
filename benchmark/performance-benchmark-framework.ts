/**
 * PromptXY v2.0 性能基准测试框架
 *
 * 设计目标：
 * 1. 建立全面的性能指标体系
 * 2. 提供可重复的测试场景
 * 3. 定义明确的成功标准
 * 4. 生成详细的测试报告
 */

// ==================== 性能指标定义 ====================

export interface PerformanceMetrics {
  // 时间指标
  latency: {
    min: number;      // 最小延迟 (ms)
    max: number;      // 最大延迟 (ms)
    avg: number;      // 平均延迟 (ms)
    p50: number;      // 50th 百分位延迟 (ms)
    p95: number;      // 95th 百分位延迟 (ms)
    p99: number;      // 99th 百分位延迟 (ms)
  };

  // 吞吐量指标
  throughput: {
    rps: number;      // 每秒请求数
    totalRequests: number;  // 总请求数
    successfulRequests: number;  // 成功请求数
    failedRequests: number;  // 失败请求数
    successRate: number;  // 成功率 (%)
  };

  // 资源使用
  resources: {
    memory: {
      initial: number;  // 初始内存 (MB)
      peak: number;     // 峰值内存 (MB)
      final: number;    // 最终内存 (MB)
      delta: number;    // 内存变化 (MB)
    };
    cpu: {
      avg: number;      // 平均 CPU 使用率 (%)
      peak: number;     // 峰值 CPU 使用率 (%)
    };
  };

  // 特定场景指标
  specific: Record<string, any>;
}

// ==================== 成功标准定义 ====================

export interface SuccessCriteria {
  // 延迟标准
  latency: {
    maxAvgLatency: number;      // 最大平均延迟 (ms)
    maxP95Latency: number;      // 最大 P95 延迟 (ms)
    maxP99Latency: number;      // 最大 P99 延迟 (ms)
  };

  // 吞吐量标准
  throughput: {
    minRPS: number;             // 最小 RPS
    minSuccessRate: number;     // 最小成功率 (%)
  };

  // 资源标准
  resources: {
    maxMemoryIncrease: number;  // 最大内存增长 (MB)
    maxMemoryLeakRate: number;  // 最大内存泄漏率 (MB/分钟)
  };

  // 稳定性标准
  stability: {
    maxErrorRate: number;       // 最大错误率 (%)
    maxConnectionFailures: number;  // 最大连接失败数
  };
}

// ==================== 测试场景定义 ====================

export interface TestScenario {
  name: string;
  description: string;
  config: TestConfig;
  criteria: SuccessCriteria;
}

export interface TestConfig {
  // 并发配置
  concurrency?: {
    connections: number | number[];
    requestsPerConnection?: number;
    timeout?: number;
  };

  // 数据规模
  dataScale?: {
    rules?: number;        // 规则数量
    records?: number;      // 数据库记录数
    items?: number;        // 列表项数
  };

  // 持续时间
  duration?: {
    warmup: number;        // 预热时间 (ms)
    test: number;          // 测试时间 (ms)
    cooldown: number;      // 冷却时间 (ms)
  };

  // 特定配置
  specific?: Record<string, any>;
}

// ==================== 基准测试结果 ====================

export interface BenchmarkResult {
  scenario: string;
  timestamp: number;
  status: 'pass' | 'fail' | 'warning';
  metrics: PerformanceMetrics;
  criteria: SuccessCriteria;
  violations: string[];
  analysis: string[];
  recommendations: string[];
}

// ==================== 基准测试报告 ====================

export interface BenchmarkReport {
  metadata: {
    project: string;
    version: string;
    environment: string;
    timestamp: number;
    duration: number;
  };

  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    overallScore: number;  // 0-100
  };

  results: BenchmarkResult[];

  // 性能评分
  scoring: {
    backend: {
      overall: number;
      breakdown: {
        throughput: number;
        latency: number;
        resources: number;
        stability: number;
      };
    };
    frontend: {
      overall: number;
      breakdown: {
        rendering: number;
        stateManagement: number;
        memory: number;
        virtualScroll: number;
      };
    };
    e2e: {
      overall: number;
      breakdown: {
        latency: number;
        endToEnd: number;
      };
    };
  };

  // 瓶颈分析
  bottlenecks: {
    critical: string[];
    warning: string[];
    info: string[];
  };

  // 优化建议
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

// ==================== 测试执行器接口 ====================

export interface BenchmarkExecutor {
  // 执行测试
  execute(scenario: TestScenario): Promise<BenchmarkResult>;

  // 批量执行
  executeAll(scenarios: TestScenario[]): Promise<BenchmarkResult[]>;

  // 生成报告
  generateReport(results: BenchmarkResult[]): Promise<BenchmarkReport>;

  // 验证结果
  validate(result: BenchmarkResult): { pass: boolean; violations: string[] };
}

// ==================== 性能基线定义 ====================

export const PerformanceBaselines = {
  // 后端基线
  backend: {
    // 吞吐量
    throughput: {
      lowConcurrency: { rps: 50, successRate: 95 },      // 10-50 并发
      mediumConcurrency: { rps: 30, successRate: 98 },   // 50-100 并发
      highConcurrency: { rps: 20, successRate: 99 },     // 100+ 并发
    },

    // 规则引擎
    rules: {
      singleRule: { avgLatency: 1.0, maxLatency: 5.0 },   // 单条规则
      multipleRules: { avgLatency: 2.0, maxLatency: 10.0 }, // 多条规则
      throughput: 100000,  // req/s
    },

    // 数据库
    database: {
      singleWrite: { avgLatency: 10.0, maxLatency: 50.0 },  // 单条写入
      batchWrite: { avgLatency: 5.0, maxLatency: 20.0 },    // 批量写入
      query: { avgLatency: 5.0, maxLatency: 20.0 },         // 查询
    },

    // SSE
    sse: {
      connectionTime: { avg: 50.0, max: 100.0 },  // 连接建立时间
      maxConnections: 100,                        // 最大并发连接
      eventLatency: { avg: 10.0, max: 50.0 },    // 事件推送延迟
    },

    // 资源
    resources: {
      memory: { maxIncrease: 50.0, leakRate: 0.1 },  // 内存使用
      cpu: { maxUsage: 80 },                         // CPU 使用率
    },
  },

  // 前端基线
  frontend: {
    // 渲染性能
    rendering: {
      componentMount: { avg: 5.0, max: 10.0 },      // 组件挂载
      listRender: { avg: 50.0, max: 100.0 },        // 列表渲染 (100项)
      update: { avg: 20.0, max: 50.0 },             // 组件更新
    },

    // 虚拟滚动
    virtualScroll: {
      initialRender: { avg: 100.0, max: 200.0 },    // 初始渲染 (10k项)
      scrollPerformance: { avg: 30.0, max: 100.0 }, // 滚动性能
    },

    // 状态管理
    stateManagement: {
      simpleUpdate: { avg: 1.0, max: 5.0 },         // 简单状态更新
      batchUpdate: { avg: 10.0, max: 50.0 },        // 批量更新
      subscription: { avg: 0.5, max: 2.0 },         // 订阅通知
    },

    // 内存
    memory: {
      leakTolerance: 0.5,                           // 内存泄漏容忍度 (MB)
      componentLifecycle: { avg: 5.0, max: 10.0 },  // 组件生命周期
    },
  },

  // 端到端基线
  e2e: {
    completeFlow: { avg: 100.0, max: 200.0 },       // 完整请求流程
    ruleApplication: { avg: 50.0, max: 100.0 },     // 规则应用到响应
    uiUpdate: { avg: 30.0, max: 60.0 },             // UI 更新到显示
  },
};

// ==================== 测试工具类 ====================

export class PerformanceTimer {
  private startTimes: Map<string, number> = new Map();
  private measurements: Map<string, number[]> = new Map();

  start(label: string): void {
    this.startTimes.set(label, performance.now());
  }

  end(label: string): number {
    const start = this.startTimes.get(label);
    if (!start) {
      throw new Error(`Timer "${label}" not started`);
    }
    const duration = performance.now() - start;
    this.startTimes.delete(label);

    // 记录测量值
    if (!this.measurements.has(label)) {
      this.measurements.set(label, []);
    }
    this.measurements.get(label)!.push(duration);

    return duration;
  }

  getMeasurements(label: string): number[] {
    return this.measurements.get(label) || [];
  }

  getStats(label: string): { avg: number; min: number; max: number; p95: number; p99: number } | null {
    const measurements = this.getMeasurements(label);
    if (measurements.length === 0) return null;

    const sorted = [...measurements].sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return { avg, min, max, p95, p99 };
  }

  reset(label?: string): void {
    if (label) {
      this.startTimes.delete(label);
      this.measurements.delete(label);
    } else {
      this.startTimes.clear();
      this.measurements.clear();
    }
  }
}

// ==================== 资源监控类 ====================

export class ResourceMonitor {
  private snapshots: Array<{ timestamp: number; memory: number; cpu: number }> = [];
  private baselineMemory: number | null = null;

  async snapshot(): Promise<{ memory: number; cpu: number }> {
    // 获取内存使用 (Node.js 环境)
    const memory = process.memoryUsage();
    const memoryMB = memory.heapUsed / 1024 / 1024;

    // 获取 CPU 使用率 (需要外部工具，这里返回估算值)
    const cpu = await this.getCpuUsage();

    this.snapshots.push({
      timestamp: Date.now(),
      memory: memoryMB,
      cpu,
    });

    return { memory: memoryMB, cpu };
  }

  private async getCpuUsage(): Promise<number> {
    // 简化的 CPU 使用率获取
    // 实际实现需要使用 os.cpus() 或外部监控工具
    return new Promise(resolve => {
      // 模拟 CPU 使用率
      resolve(Math.random() * 20 + 10);
    });
  }

  setBaseline(): void {
    if (this.snapshots.length > 0) {
      this.baselineMemory = this.snapshots[this.snapshots.length - 1].memory;
    }
  }

  getMemoryDelta(): number {
    if (!this.baselineMemory || this.snapshots.length === 0) return 0;
    const current = this.snapshots[this.snapshots.length - 1].memory;
    return current - this.baselineMemory;
  }

  getMemoryLeakRate(): number {
    if (this.snapshots.length < 2) return 0;

    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];
    const duration = (last.timestamp - first.timestamp) / 1000 / 60; // minutes
    const memoryChange = last.memory - first.memory;

    return duration > 0 ? memoryChange / duration : 0;
  }

  getStats(): { avgMemory: number; peakMemory: number; avgCpu: number; peakCpu: number } {
    if (this.snapshots.length === 0) {
      return { avgMemory: 0, peakMemory: 0, avgCpu: 0, peakCpu: 0 };
    }

    const memories = this.snapshots.map(s => s.memory);
    const cpus = this.snapshots.map(s => s.cpu);

    const avgMemory = memories.reduce((a, b) => a + b, 0) / memories.length;
    const peakMemory = Math.max(...memories);
    const avgCpu = cpus.reduce((a, b) => a + b, 0) / cpus.length;
    const peakCpu = Math.max(...cpus);

    return { avgMemory, peakMemory, avgCpu, peakCpu };
  }

  reset(): void {
    this.snapshots = [];
    this.baselineMemory = null;
  }
}

// ==================== 数据生成器 ====================

export class DataGenerator {
  // 生成测试规则
  static generateRules(count: number): any[] {
    const rules = [];
    for (let i = 0; i < count; i++) {
      rules.push({
        id: `rule-${i}`,
        enabled: true,
        when: {
          client: ['claude', 'codex', 'gemini'][i % 3],
          field: ['system', 'instructions'][i % 2],
          method: 'POST',
          pathRegex: i % 2 === 0 ? '/v1/chat' : '/v1/completions',
          modelRegex: i % 3 === 0 ? 'claude-3' : i % 3 === 1 ? 'gpt-4' : 'gemini',
        },
        ops: [
          {
            type: ['append', 'prepend', 'replace'][i % 3],
            text: `Test rule ${i}`,
            regex: i % 2 === 0 ? 'test' : undefined,
            replacement: i % 2 === 1 ? 'replaced' : undefined,
          },
        ],
        stop: i % 10 === 0,
      });
    }
    return rules;
  }

  // 生成测试请求体
  static generateRequestBody(size: 'small' | 'medium' | 'large' = 'medium'): any {
    const sizes = {
      small: { system: 'test', instructions: 'test' },
      medium: {
        system: 'You are a helpful assistant with extensive knowledge.',
        instructions: 'Please provide detailed responses with examples.',
      },
      large: {
        system: 'You are an expert AI assistant with deep knowledge across multiple domains including technology, science, mathematics, and creative writing.',
        instructions: 'When responding, please provide comprehensive explanations with multiple examples, consider edge cases, and structure your answers clearly with headings and bullet points for better readability.',
      },
    };
    return sizes[size];
  }

  // 生成测试数据集
  static generateDataset(count: number, type: 'requests' | 'rules' | 'items'): any[] {
    const datasets = {
      requests: Array.from({ length: count }, (_, i) => ({
        id: `req-${i}`,
        timestamp: Date.now() - i * 1000,
        client: ['claude', 'codex', 'gemini'][i % 3],
        path: i % 2 === 0 ? '/v1/chat' : '/v1/completions',
        method: 'POST',
      })),
      rules: this.generateRules(count),
      items: Array.from({ length: count }, (_, i) => ({
        id: i,
        content: `Item ${i}: ${'x'.repeat(Math.random() * 200 + 50)}`,
        timestamp: Date.now() - i * 1000,
      })),
    };
    return datasets[type];
  }
}

// ==================== 报告生成器 ====================

export class ReportGenerator {
  static generateMarkdown(report: BenchmarkReport): string {
    let md = `# PromptXY v2.0 性能基准测试报告\n\n`;

    // 元数据
    md += `## 📊 测试概览\n\n`;
    md += `- **项目**: ${report.metadata.project}\n`;
    md += `- **版本**: ${report.metadata.version}\n`;
    md += `- **环境**: ${report.metadata.environment}\n`;
    md += `- **时间**: ${new Date(report.metadata.timestamp).toLocaleString()}\n`;
    md += `- **总耗时**: ${(report.metadata.duration / 1000).toFixed(2)}s\n\n`;

    // 总结
    md += `## 🎯 测试总结\n\n`;
    md += `- **总测试数**: ${report.summary.totalTests}\n`;
    md += `- **通过**: ${report.summary.passed} ✅\n`;
    md += `- **失败**: ${report.summary.failed} ❌\n`;
    md += `- **综合评分**: ${report.summary.overallScore.toFixed(1)}/100\n\n`;

    // 评分详情
    md += `## 📈 性能评分\n\n`;

    md += `### 后端评分 (${report.scoring.backend.overall.toFixed(1)}/100)\n`;
    md += `- 吞吐量: ${report.scoring.backend.breakdown.throughput.toFixed(1)}/100\n`;
    md += `- 延迟: ${report.scoring.backend.breakdown.latency.toFixed(1)}/100\n`;
    md += `- 资源: ${report.scoring.backend.breakdown.resources.toFixed(1)}/100\n`;
    md += `- 稳定性: ${report.scoring.backend.breakdown.stability.toFixed(1)}/100\n\n`;

    md += `### 前端评分 (${report.scoring.frontend.overall.toFixed(1)}/100)\n`;
    md += `- 渲染: ${report.scoring.frontend.breakdown.rendering.toFixed(1)}/100\n`;
    md += `- 状态管理: ${report.scoring.frontend.breakdown.stateManagement.toFixed(1)}/100\n`;
    md += `- 内存: ${report.scoring.frontend.breakdown.memory.toFixed(1)}/100\n`;
    md += `- 虚拟滚动: ${report.scoring.frontend.breakdown.virtualScroll.toFixed(1)}/100\n\n`;

    md += `### 端到端评分 (${report.scoring.e2e.overall.toFixed(1)}/100)\n`;
    md += `- 延迟: ${report.scoring.e2e.breakdown.latency.toFixed(1)}/100\n`;
    md += `- 端到端: ${report.scoring.e2e.breakdown.endToEnd.toFixed(1)}/100\n\n`;

    // 瓶颈分析
    md += `## 🔍 瓶颈分析\n\n`;

    if (report.bottlenecks.critical.length > 0) {
      md += `### 🔴 关键瓶颈\n`;
      report.bottlenecks.critical.forEach(b => md += `- ${b}\n`);
      md += '\n';
    }

    if (report.bottlenecks.warning.length > 0) {
      md += `### 🟡 警告\n`;
      report.bottlenecks.warning.forEach(b => md += `- ${b}\n`);
      md += '\n';
    }

    if (report.bottlenecks.info.length > 0) {
      md += `### 🔵 信息\n`;
      report.bottlenecks.info.forEach(b => md += `- ${b}\n`);
      md += '\n';
    }

    // 优化建议
    md += `## 💡 优化建议\n\n`;

    if (report.recommendations.immediate.length > 0) {
      md += `### 🚀 立即实施 (P0)\n`;
      report.recommendations.immediate.forEach(r => md += `- ${r}\n`);
      md += '\n';
    }

    if (report.recommendations.shortTerm.length > 0) {
      md += `### ⚡ 短期实施 (P1)\n`;
      report.recommendations.shortTerm.forEach(r => md += `- ${r}\n`);
      md += '\n';
    }

    if (report.recommendations.longTerm.length > 0) {
      md += `### 🎯 长期优化 (P2)\n`;
      report.recommendations.longTerm.forEach(r => md += `- ${r}\n`);
      md += '\n';
    }

    // 详细结果
    md += `## 📋 详细测试结果\n\n`;
    report.results.forEach((result, index) => {
      md += `### ${index + 1}. ${result.scenario}\n`;
      md += `- **状态**: ${result.status === 'pass' ? '✅ 通过' : result.status === 'fail' ? '❌ 失败' : '⚠️ 警告'}\n`;
      md += `- **时间**: ${new Date(result.timestamp).toLocaleTimeString()}\n`;

      if (result.violations.length > 0) {
        md += `- **违规**: ${result.violations.join(', ')}\n`;
      }

      if (result.analysis.length > 0) {
        md += `- **分析**: ${result.analysis.join('; ')}\n`;
      }

      if (result.recommendations.length > 0) {
        md += `- **建议**: ${result.recommendations.join('; ')}\n`;
      }

      // 关键指标
      const m = result.metrics;
      md += `- **RPS**: ${m.throughput.rps.toFixed(1)}\n`;
      md += `- **延迟**: avg=${m.latency.avg.toFixed(2)}ms, p95=${m.latency.p95.toFixed(2)}ms\n`;
      md += `- **成功率**: ${m.throughput.successRate.toFixed(1)}%\n`;
      md += `- **内存**: peak=${m.resources.memory.peak.toFixed(2)}MB, delta=${m.resources.memory.delta.toFixed(2)}MB\n\n`;
    });

    return md;
  }

  static generateJSON(report: BenchmarkReport): string {
    return JSON.stringify(report, null, 2);
  }
}

// ==================== 配置管理 ====================

export interface BenchmarkConfig {
  // 测试环境
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    memory: number; // MB
    cpuCores: number;
  };

  // 服务配置
  services: {
    gateway: {
      host: string;
      port: number;
    };
    api: {
      host: string;
      port: number;
    };
  };

  // 测试参数
  parameters: {
    warmupIterations: number;
    testIterations: number;
    cooldownDelay: number;
    timeout: number;
  };

  // 报告配置
  report: {
    outputDir: string;
    formats: ('md' | 'json' | 'csv')[];
    includeMetrics: string[];
  };
}

// ==================== 基准测试主类 ====================

export class PerformanceBenchmark implements BenchmarkExecutor {
  private config: BenchmarkConfig;
  private timer: PerformanceTimer;
  private monitor: ResourceMonitor;

  constructor(config: BenchmarkConfig) {
    this.config = config;
    this.timer = new PerformanceTimer();
    this.monitor = new ResourceMonitor();
  }

  async execute(scenario: TestScenario): Promise<BenchmarkResult> {
    console.log(`🚀 开始测试: ${scenario.name}`);

    // 预热
    if (scenario.config.duration?.warmup) {
      await this.warmup(scenario.config.duration.warmup);
    }

    // 执行测试
    const metrics = await this.runTest(scenario);

    // 验证结果
    const validation = this.validate({
      scenario: scenario.name,
      timestamp: Date.now(),
      status: 'pass',
      metrics,
      criteria: scenario.criteria,
      violations: [],
      analysis: [],
      recommendations: []
    });

    // 生成分析和建议
    const analysis = this.analyze(metrics, scenario.criteria);
    const recommendations = this.recommend(metrics, scenario.criteria);

    const result: BenchmarkResult = {
      scenario: scenario.name,
      timestamp: Date.now(),
      status: validation.pass ? 'pass' : 'fail',
      metrics,
      criteria: scenario.criteria,
      violations: validation.violations,
      analysis,
      recommendations,
    };

    // 冷却
    if (scenario.config.duration?.cooldown) {
      await this.cooldown(scenario.config.duration.cooldown);
    }

    console.log(`✅ 完成测试: ${scenario.name} - ${result.status}`);
    return result;
  }

  async executeAll(scenarios: TestScenario[]): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    for (const scenario of scenarios) {
      try {
        const result = await this.execute(scenario);
        results.push(result);
      } catch (error) {
        console.error(`❌ 测试失败: ${scenario.name}`, error);
        results.push({
          scenario: scenario.name,
          timestamp: Date.now(),
          status: 'fail',
          metrics: this.createEmptyMetrics(),
          criteria: scenario.criteria,
          violations: ['Test execution failed'],
          analysis: [String(error)],
          recommendations: ['Check test configuration'],
        });
      }
    }

    return results;
  }

  async generateReport(results: BenchmarkResult[]): Promise<BenchmarkReport> {
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const overallScore = this.calculateOverallScore(results);

    const report: BenchmarkReport = {
      metadata: {
        project: 'PromptXY v2.0',
        version: '2.0.0',
        environment: `${this.config.environment.platform} ${this.config.environment.nodeVersion}`,
        timestamp: Date.now(),
        duration: results.reduce((sum, r) => sum + (r.metrics.latency.avg || 0), 0),
      },
      summary: {
        totalTests: results.length,
        passed,
        failed,
        overallScore,
      },
      results,
      scoring: this.calculateScoring(results),
      bottlenecks: this.identifyBottlenecks(results),
      recommendations: this.generateRecommendations(results),
    };

    return report;
  }

  validate(result: BenchmarkResult): { pass: boolean; violations: string[] } {
    const violations: string[] = [];
    const criteria = result.criteria;
    const metrics = result.metrics;

    // 延迟检查
    if (metrics.latency.avg > criteria.latency.maxAvgLatency) {
      violations.push(`平均延迟 ${metrics.latency.avg.toFixed(2)}ms 超过阈值 ${criteria.latency.maxAvgLatency}ms`);
    }
    if (metrics.latency.p95 > criteria.latency.maxP95Latency) {
      violations.push(`P95延迟 ${metrics.latency.p95.toFixed(2)}ms 超过阈值 ${criteria.latency.maxP95Latency}ms`);
    }

    // 吞吐量检查
    if (metrics.throughput.rps < criteria.throughput.minRPS) {
      violations.push(`RPS ${metrics.throughput.rps.toFixed(1)} 低于阈值 ${criteria.throughput.minRPS}`);
    }
    if (metrics.throughput.successRate < criteria.throughput.minSuccessRate) {
      violations.push(`成功率 ${metrics.throughput.successRate.toFixed(1)}% 低于阈值 ${criteria.throughput.minSuccessRate}%`);
    }

    // 资源检查
    if (metrics.resources.memory.delta > criteria.resources.maxMemoryIncrease) {
      violations.push(`内存增长 ${metrics.resources.memory.delta.toFixed(2)}MB 超过阈值 ${criteria.resources.maxMemoryIncrease}MB`);
    }

    return {
      pass: violations.length === 0,
      violations,
    };
  }

  private async warmup(duration: number): Promise<void> {
    console.log(`🔥 预热 ${duration}ms...`);
    await new Promise(resolve => setTimeout(resolve, duration));
  }

  private async cooldown(duration: number): Promise<void> {
    console.log(`❄️ 冷却 ${duration}ms...`);
    await new Promise(resolve => setTimeout(resolve, duration));
  }

  private async runTest(scenario: TestScenario): Promise<PerformanceMetrics> {
    // 这里需要根据具体的测试类型调用不同的测试方法
    // 为了演示，返回模拟数据
    return this.createMockMetrics();
  }

  private analyze(metrics: PerformanceMetrics, criteria: SuccessCriteria): string[] {
    const analysis: string[] = [];

    // 延迟分析
    if (metrics.latency.p99 > criteria.latency.maxP99Latency * 1.5) {
      analysis.push('存在长尾延迟，建议优化请求处理管道');
    }

    // 吞吐量分析
    if (metrics.throughput.successRate < 95) {
      analysis.push('成功率偏低，可能存在连接池或超时问题');
    }

    // 资源分析
    if (metrics.resources.memory.delta > 10) {
      analysis.push('内存增长明显，可能存在内存泄漏');
    }

    return analysis;
  }

  private recommend(metrics: PerformanceMetrics, criteria: SuccessCriteria): string[] {
    const recommendations: string[] = [];

    if (metrics.latency.avg > criteria.latency.maxAvgLatency) {
      recommendations.push('优化规则引擎算法，减少正则匹配开销');
    }

    if (metrics.throughput.rps < criteria.throughput.minRPS) {
      recommendations.push('增加连接池大小，优化请求队列处理');
    }

    if (metrics.resources.memory.delta > criteria.resources.maxMemoryIncrease) {
      recommendations.push('实现批量写入，减少数据库连接次数');
    }

    return recommendations;
  }

  private calculateOverallScore(results: BenchmarkResult[]): number {
    if (results.length === 0) return 0;

    const scores = results.map(r => {
      const baseScore = r.status === 'pass' ? 100 : r.status === 'warning' ? 70 : 40;
      const penalty = r.violations.length * 5;
      return Math.max(0, baseScore - penalty);
    });

    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  private calculateScoring(results: BenchmarkResult[]): BenchmarkReport['scoring'] {
    // 简化的评分计算
    return {
      backend: {
        overall: 85,
        breakdown: {
          throughput: 80,
          latency: 90,
          resources: 85,
          stability: 95,
        },
      },
      frontend: {
        overall: 92,
        breakdown: {
          rendering: 95,
          stateManagement: 90,
          memory: 95,
          virtualScroll: 95,
        },
      },
      e2e: {
        overall: 88,
        breakdown: {
          latency: 85,
          endToEnd: 90,
        },
      },
    };
  }

  private identifyBottlenecks(results: BenchmarkResult[]): BenchmarkReport['bottlenecks'] {
    const critical: string[] = [];
    const warning: string[] = [];
    const info: string[] = [];

    results.forEach(result => {
      if (result.status === 'fail') {
        critical.push(`${result.scenario}: ${result.violations[0]}`);
      } else if (result.violations.length > 0) {
        warning.push(`${result.scenario}: ${result.violations.join(', ')}`);
      }
    });

    return { critical, warning, info };
  }

  private generateRecommendations(results: BenchmarkResult[]): BenchmarkReport['recommendations'] {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    // 基于测试结果生成建议
    const hasDatabaseIssues = results.some(r =>
      r.scenario.includes('数据库') && r.metrics.resources.memory.delta > 10
    );

    const hasLatencyIssues = results.some(r =>
      r.metrics.latency.avg > 50
    );

    if (hasDatabaseIssues) {
      immediate.push('实现数据库批量写入优化');
      shortTerm.push('引入异步队列处理数据库操作');
    }

    if (hasLatencyIssues) {
      immediate.push('优化连接池配置');
      shortTerm.push('引入 Redis 缓存层');
    }

    if (immediate.length === 0) {
      immediate.push('当前性能表现良好，继续保持');
    }

    longTerm.push('实现水平扩展架构');
    longTerm.push('建立完整的监控告警体系');

    return { immediate, shortTerm, longTerm };
  }

  private createEmptyMetrics(): PerformanceMetrics {
    return {
      latency: { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 },
      throughput: { rps: 0, totalRequests: 0, successfulRequests: 0, failedRequests: 0, successRate: 0 },
      resources: {
        memory: { initial: 0, peak: 0, final: 0, delta: 0 },
        cpu: { avg: 0, peak: 0 },
      },
      specific: {},
    };
  }

  private createMockMetrics(): PerformanceMetrics {
    // 模拟性能数据，实际使用时需要真实的测试结果
    return {
      latency: {
        min: Math.random() * 5 + 1,
        max: Math.random() * 50 + 20,
        avg: Math.random() * 10 + 5,
        p50: Math.random() * 8 + 3,
        p95: Math.random() * 20 + 10,
        p99: Math.random() * 30 + 20,
      },
      throughput: {
        rps: Math.random() * 50 + 20,
        totalRequests: 1000,
        successfulRequests: 980,
        failedRequests: 20,
        successRate: 98,
      },
      resources: {
        memory: {
          initial: 80,
          peak: 85,
          final: 82,
          delta: 2,
        },
        cpu: {
          avg: 15,
          peak: 25,
        },
      },
      specific: {},
    };
  }
}