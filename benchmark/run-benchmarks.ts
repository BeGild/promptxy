/**
 * PromptXY v2.0 性能基准测试主运行脚本
 *
 * 使用方法:
 *   tsx benchmark/run-benchmarks.ts [options]
 *
 * 选项:
 *   --backend    只运行后端测试
 *   --frontend   只运行前端测试
 *   --e2e        只运行端到端测试
 *   --all        运行所有测试 (默认)
 *   --quick      快速测试模式
 *   --output DIR 输出目录
 */

import { BenchmarkRunner } from './e2e-benchmark.js';

interface RunOptions {
  backend?: boolean;
  frontend?: boolean;
  e2e?: boolean;
  all?: boolean;
  quick?: boolean;
  output?: string;
}

class BenchmarkCLI {
  private runner: BenchmarkRunner;

  constructor() {
    this.runner = new BenchmarkRunner();
  }

  async run(options: RunOptions): Promise<void> {
    console.log('🚀 PromptXY v2.0 性能基准测试\n');

    // 解析选项
    const runBackend = options.backend || options.all || (!options.frontend && !options.e2e);
    const runFrontend = options.frontend || options.all || (!options.backend && !options.e2e);
    const runE2E = options.e2e || options.all || (!options.backend && !options.frontend);

    // 快速模式配置
    if (options.quick) {
      console.log('⚡ 快速测试模式\n');
    }

    const results: any = {};

    // 1. 后端测试
    if (runBackend) {
      console.log('📦 后端测试');
      try {
        const { BackendBenchmarkSuite } = await import('./backend-benchmark.js');

        if (options.quick) {
          // 快速模式：减少迭代次数
          const suite = new BackendBenchmarkSuite();
          results.backend = {
            throughput: [await suite.throughput.testConcurrency(100, 100)],
            rules: {
              single: await suite.rules.testSingleRule(1000),
              multiple: await suite.rules.testMultipleRules(3, 1000),
            },
            database: {
              singleWrite: await suite.database.testSingleWrite(20),
            },
          };
        } else {
          // 完整模式
          const suite = new BackendBenchmarkSuite();
          results.backend = await suite.runCompleteSuite();
        }

        console.log('✅ 后端测试完成\n');
      } catch (error) {
        console.error('❌ 后端测试失败:', error);
        results.backend = { error: String(error) };
      }
    }

    // 2. 前端测试
    if (runFrontend) {
      console.log('🎨 前端测试');
      try {
        const { FrontendBenchmarkSuite } = await import('./frontend-benchmark.js');

        if (options.quick) {
          // 快速模式
          const suite = new FrontendBenchmarkSuite();
          results.frontend = {
            rendering: {
              simple: await suite.render.testSimpleComponentMount(20),
              list100: await suite.render.testListRender(100, 5),
            },
            state: {
              simple: await suite.state.testSimpleUpdate(20),
            },
          };
        } else {
          // 完整模式
          const suite = new FrontendBenchmarkSuite();
          results.frontend = await suite.runCompleteSuite();
        }

        console.log('✅ 前端测试完成\n');
      } catch (error) {
        console.error('❌ 前端测试失败:', error);
        results.frontend = { error: String(error) };
      }
    }

    // 3. 端到端测试
    if (runE2E) {
      console.log('🔄 端到端测试');
      try {
        const { E2EBenchmarkSuite } = await import('./e2e-benchmark.js');

        if (options.quick) {
          // 快速模式
          const suite = new E2EBenchmarkSuite();
          results.e2e = {
            completeFlow: await suite.completeFlow.testCompleteFlow(20),
            ruleApplication: await suite.completeFlow.testRuleApplicationTime(50),
          };
        } else {
          // 完整模式
          const suite = new E2EBenchmarkSuite();
          results.e2e = await suite.runCompleteSuite();
        }

        console.log('✅ 端到端测试完成\n');
      } catch (error) {
        console.error('❌ 端到端测试失败:', error);
        results.e2e = { error: String(error) };
      }
    }

    // 生成综合报告
    if (!options.quick) {
      const { BenchmarkRunner: FullRunner } = await import('./e2e-benchmark.js');
      const fullRunner = new FullRunner();
      results.comprehensive = fullRunner.generateComprehensiveReport(results);
    }

    // 保存结果
    await this.saveResults(results, options.output);

    // 显示总结
    this.displaySummary(results);
  }

  private async saveResults(results: any, outputDir?: string): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = outputDir || path.join(process.cwd(), 'benchmark', `results-${timestamp}`);

    await fs.mkdir(dir, { recursive: true });

    // 保存完整数据
    await fs.writeFile(
      path.join(dir, 'benchmark-data.json'),
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
    for (const [key, value] of Object.entries(results)) {
      if (key === 'comprehensive') continue;
      const section = value as any;
      if (section.summary) {
        await fs.writeFile(
          path.join(dir, `${key}-summary.md`),
          section.summary
        );
      }
    }

    console.log(`📁 结果已保存到: ${dir}/`);
  }

  private displaySummary(results: any): void {
    console.log('\n📊 测试总结\n');

    if (results.backend && !results.backend.error) {
      console.log('✅ 后端测试');
      if (results.backend.throughput) {
        const best = results.backend.throughput
          .filter((r: any) => !r.error)
          .sort((a: any, b: any) => b.rps - a.rps)[0];
        if (best) {
          console.log(`   最高RPS: ${best.rps.toFixed(1)}`);
        }
      }
      if (results.backend.rules?.single) {
        console.log(`   规则引擎: ${results.backend.rules.single.latency.avg.toFixed(3)}ms`);
      }
    }

    if (results.frontend && !results.frontend.error) {
      console.log('✅ 前端测试');
      if (results.frontend.rendering?.simple) {
        console.log(`   组件渲染: ${results.frontend.rendering.simple.latency.avg.toFixed(2)}ms`);
      }
      if (results.frontend.memory?.lifecycle) {
        const leak = results.frontend.memory.lifecycle.memory.leakRate;
        console.log(`   内存泄漏: ${leak.toFixed(3)} MB/min`);
      }
    }

    if (results.e2e && !results.e2e.error) {
      console.log('✅ 端到端测试');
      if (results.e2e.completeFlow?.latency) {
        console.log(`   完整流程: ${results.e2e.completeFlow.latency.avg.toFixed(2)}ms`);
      }
      if (results.e2e.completeFlow?.successRate) {
        console.log(`   成功率: ${results.e2e.completeFlow.successRate.toFixed(1)}%`);
      }
    }

    if (results.comprehensive) {
      console.log('\n📋 综合评分');
      const scoreMatch = results.comprehensive.match(/整体性能.*?(\d+)/);
      if (scoreMatch) {
        console.log(`   性能评分: ${scoreMatch[1]}/100`);
      }
    }
  }
}

// CLI 入口
function parseArgs(): RunOptions {
  const args = process.argv.slice(2);
  const options: RunOptions = {};

  for (const arg of args) {
    switch (arg) {
      case '--backend':
        options.backend = true;
        break;
      case '--frontend':
        options.frontend = true;
        break;
      case '--e2e':
        options.e2e = true;
        break;
      case '--all':
        options.all = true;
        break;
      case '--quick':
        options.quick = true;
        break;
      case '--output':
        const index = args.indexOf(arg);
        if (index + 1 < args.length) {
          options.output = args[index + 1];
        }
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
PromptXY v2.0 性能基准测试

用法: tsx benchmark/run-benchmarks.ts [选项]

选项:
  --backend    只运行后端测试
  --frontend   只运行前端测试
  --e2e        只运行端到端测试
  --all        运行所有测试 (默认)
  --quick      快速测试模式 (减少迭代次数)
  --output DIR 指定输出目录
  --help, -h   显示帮助信息

示例:
  # 运行所有测试
  tsx benchmark/run-benchmarks.ts

  # 快速测试
  tsx benchmark/run-benchmarks.ts --quick

  # 只测试后端
  tsx benchmark/run-benchmarks.ts --backend

  # 指定输出目录
  tsx benchmark/run-benchmarks.ts --output ./my-results
`);
}

// 主程序
const options = parseArgs();
const cli = new BenchmarkCLI();
cli.run(options).catch(console.error);