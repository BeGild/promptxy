import React, { useEffect, useState } from "react";
import { HeroUIProvider } from "@heroui/react";
import { Header, Sidebar } from "@/components/layout";
import { useUIStore, useAppStore } from "@/store";
import { useSSE } from "@/hooks";
import { checkHealth } from "@/api/client";

// 简化的页面组件 - 临时版本
const SimpleRulesPage = () => (
  <div style={{ padding: "20px" }}>
    <h2>📋 规则管理</h2>
    <p>规则管理页面开发中...</p>
  </div>
);

const SimpleRequestsPage = () => (
  <div style={{ padding: "20px" }}>
    <h2>📡 请求监控</h2>
    <p>请求监控页面开发中...</p>
  </div>
);

const SimplePreviewPage = () => (
  <div style={{ padding: "20px" }}>
    <h2>🧪 预览测试</h2>
    <p>预览测试页面开发中...</p>
  </div>
);

const SimpleSettingsPage = () => (
  <div style={{ padding: "20px" }}>
    <h2>⚙️ 设置</h2>
    <p>设置页面开发中...</p>
  </div>
);

function AppContent() {
  const activeTab = useUIStore((state) => state.activeTab);
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const checkConnection = useAppStore((state) => state.checkConnection);
  const apiConnected = useAppStore((state) => state.apiConnected);

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
      case "rules":
        return <SimpleRulesPage />;
      case "requests":
        return <SimpleRequestsPage />;
      case "preview":
        return <SimplePreviewPage />;
      case "settings":
        return <SimpleSettingsPage />;
      default:
        return <SimpleRulesPage />;
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar collapsed={sidebarCollapsed} onClose={() => {}} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Header
          onToggleSidebar={toggleSidebar}
          sseConnected={sseConnected}
          apiConnected={apiConnected}
        />
        <div style={{ flex: 1, overflow: "auto", background: "var(--heroui-colors-background)" }}>
          {renderPage()}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HeroUIProvider>
      <AppContent />
    </HeroUIProvider>
  );
}
