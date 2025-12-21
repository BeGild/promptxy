import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import TestHeroUI from './TestHeroUI';
import './styles/globals.css';

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {USE_TEST ? <TestHeroUI /> : <App />}
    </QueryClientProvider>
  </React.StrictMode>,
);
