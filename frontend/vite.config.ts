import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/_promptxy': {
        target: process.env.VITE_BACKEND_PORT
          ? `http://127.0.0.1:${process.env.VITE_BACKEND_PORT}`
          : 'http://127.0.0.1:7070',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // 生产环境不生成 sourcemap，减小包体积
    sourcemap: false,
    // 代码分割配置
    rollupOptions: {
      output: {
        // 手动分块策略
        manualChunks: {
          // React 核心库单独打包
          'react-core': ['react', 'react-dom', 'react-router-dom'],
          // UI 库单独打包
          'ui-library': ['@heroui/react', '@heroui/system', 'framer-motion'],
          // 状态管理库单独打包
          'state-management': ['zustand', '@tanstack/react-query'],
          // 工具库单独打包
          utilities: ['axios', 'sonner'],
          // Markdown 相关单独打包
          markdown: [
            'react-markdown',
            'remark-gfm',
            'remark-math',
            'rehype-katex',
            'rehype-highlight',
            'rehype-sanitize',
            'katex',
            'highlight.js',
          ],
        },
        // chunk 文件命名规则
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
      // 警告处理
      onwarn(warning, warn) {
        // 忽略循环依赖警告
        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        warn(warning);
      },
    },
    // chunk 大小警告限制 (KB)
    chunkSizeWarningLimit: 500,
    // CSS 代码分割
    cssCodeSplit: true,
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        // 移除 console
        drop_console: true,
        // 移除 debugger
        drop_debugger: true,
      },
    },
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      '@tanstack/react-query',
      'axios',
    ],
  },
});
