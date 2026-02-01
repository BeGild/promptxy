/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - className="bg-gray-50 dark:bg-gray-950"
 *
 * ✅ REQUIRED:
 * - className="bg-canvas dark:bg-secondary"
 */

import React, { useEffect, useState } from 'react';
import { HeroUIProvider } from '@heroui/react';
import { Toaster } from 'sonner';
import { Header } from '@/components/layout';
import { DashboardPage } from '@/pages/DashboardPage';
import { RulesPage } from '@/pages/RulesPage';
import { RequestsPage } from '@/pages/RequestsPage';
import { PreviewPage } from '@/pages/PreviewPage';
import { RouteConfigPage } from '@/pages/RouteConfigPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { SyncManagementPage } from '@/pages/SyncManagementPage';
import { useUIStore, useAppStore } from '@/store';
import { useSSE } from '@/hooks';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

function AppContent() {
  const activeTab = useUIStore(state => state.activeTab);
  const theme = useUIStore(state => state.theme);
  const checkConnection = useAppStore(state => state.checkConnection);
  const apiConnected = useAppStore(state => state.apiConnected);

  const { isConnected: sseConnected } = useSSE();
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  // 初始连接检查
  useEffect(() => {
    if (!initialCheckDone) {
      checkConnection().then(() => {
        setInitialCheckDone(true);
      });
    }
  }, [checkConnection, initialCheckDone]);

  // 主题应用逻辑
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // 渲染对应页面
  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'rules':
        return <RulesPage />;
      case 'requests':
        return <RequestsPage />;
      case 'preview':
        return <PreviewPage />;
      case 'route-config':
        return <RouteConfigPage />;
      case 'sync':
        return <SyncManagementPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-canvas dark:bg-secondary transition-colors duration-300">
      <Header sseConnected={sseConnected} apiConnected={apiConnected} />
      <div className="flex-1 overflow-auto bg-canvas dark:bg-secondary transition-colors duration-300">
        {/* 页面级错误边界 - 捕获页面渲染错误 */}
        <ErrorBoundary
          onError={(error, errorInfo) => {
            console.error('页面错误边界捕获:', error, errorInfo);
          }}
        >
          {renderPage()}
        </ErrorBoundary>
      </div>
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        theme={theme === 'system' ? undefined : theme}
      />
    </div>
  );
}

export default function App() {
  return (
    <HeroUIProvider>
      {/* 应用级错误边界 - 捕获 HeroUIProvider 内的所有错误 */}
      <ErrorBoundary
        onError={(error, errorInfo) => {
          console.error('应用错误边界捕获:', error, errorInfo);
          // 这里可以发送错误到监控服务
        }}
      >
        <AppContent />
      </ErrorBoundary>
    </HeroUIProvider>
  );
}
