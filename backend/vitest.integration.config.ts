import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['tests/unit/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', '**/*.d.ts', '**/types.ts'],
      include: ['src/**/*.ts'],
    },
    // 集成测试需要更长的超时时间
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    // 并行执行限制，避免资源竞争
    maxConcurrency: 3,
    // 随机化测试执行顺序，发现依赖问题
    order: 'random',
  },
});
