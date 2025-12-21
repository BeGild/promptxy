import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/setup.ts', '**/*.d.ts', '**/*.config.{js,ts}'],
    },
    // 集成测试配置 - 延长超时时间
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    // 并行测试限制
    maxWorkers: 4,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
