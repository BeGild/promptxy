import React, { useEffect, useState } from 'react';
import { HeroUIProvider } from '@heroui/react';
import { Header, Sidebar } from '@/components/layout';
import { RulesPage } from '@/pages/RulesPage';
import { RequestsPage } from '@/pages/RequestsPage';
import { PreviewPage } from '@/pages/PreviewPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { useUIStore, useAppStore } from '@/store';
import { useSSE } from '@/hooks';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

function AppContent() {
  const activeTab = useUIStore(state => state.activeTab);
  const sidebarCollapsed = useUIStore(state => state.sidebarCollapsed);
  const toggleSidebar = useUIStore(state => state.toggleSidebar);
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

  // 渲染对应页面
  const renderPage = () => {
    switch (activeTab) {
      case 'rules':
        return <RulesPage />;
      case 'requests':
        return <RequestsPage />;
      case 'preview':
        return <PreviewPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <RulesPage />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar collapsed={sidebarCollapsed} onClose={() => {}} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          onToggleSidebar={toggleSidebar}
          sseConnected={sseConnected}
          apiConnected={apiConnected}
        />
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
          {/* 页面级错误边界 - 捕获页面渲染错误 */}
          <ErrorBoundary
            onError={(error, errorInfo) => {
              console.error('页面错误边界捕获:', error, errorInfo);
            }}
          >
            {renderPage()}
          </ErrorBoundary>
        </div>
      </div>
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
