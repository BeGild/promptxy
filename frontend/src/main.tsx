import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import TestHeroUI from './TestHeroUI';
import './styles/globals.css';
import { ErrorBoundary, CustomErrorUI } from '@/components/common/ErrorBoundary';

// 创建 QueryClient 实例
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60, // 1分钟
      refetchOnWindowFocus: false,
    },
  },
});

// 临时切换到测试组件 - 设置为false使用完整App
const USE_TEST = false;

// 根级别错误边界 UI - 用于捕获应用启动时的致命错误
const RootErrorFallback = (
  <CustomErrorUI
    icon="💥"
    title="应用启动失败"
    description="应用无法正常启动，请尝试刷新页面或检查控制台错误"
    actionText="刷新页面"
    onAction={() => window.location.reload()}
    showDetails={import.meta.env?.DEV ?? false}
  />
);

// 错误处理函数 - 用于全局错误监控
const handleGlobalError = (error: Error, errorInfo: React.ErrorInfo) => {
  console.error('🚨 全局错误捕获:', error, errorInfo);

  // 在生产环境中，可以发送到错误监控服务
  if (import.meta.env?.PROD) {
    // 示例：发送到 Sentry 或其他监控服务
    // Sentry.captureException(error, { extra: errorInfo });
  }
};

// 处理未捕获的 Promise 拒绝
const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  console.error('🚨 未处理的 Promise 拒绝:', event.reason);
  event.preventDefault(); // 阻止默认行为
};

// 设置全局错误处理
if (typeof window !== 'undefined') {
  window.addEventListener('error', event => {
    console.error('🚨 全局错误事件:', event.error);
  });

  window.addEventListener('unhandledrejection', handleUnhandledRejection);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 根级别错误边界 - 捕获整个应用的致命错误 */}
    <ErrorBoundary fallback={RootErrorFallback} onError={handleGlobalError}>
      <QueryClientProvider client={queryClient}>
        {USE_TEST ? <TestHeroUI /> : <App />}
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
