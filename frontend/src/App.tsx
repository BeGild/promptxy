import React, { useEffect, useState } from "react";
import { HeroUIProvider } from "@heroui/react";
import { Header, Sidebar } from "@/components/layout";
import { RulesPage, RequestsPage, PreviewPage, SettingsPage } from "@/pages";
import { useUIStore, useAppStore } from "@/store";
import { useSSE } from "@/hooks";
import { checkHealth } from "@/api/client";

function AppContent() {
  const activeTab = useUIStore((state) => state.activeTab);
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const checkConnection = useAppStore((state) => state.checkConnection);
  const apiConnected = useAppStore((state) => state.apiConnected);
  const setSSEStatus = useAppStore((state) => state.setSSEStatus);
  const sseStatus = useAppStore((state) => state.sseStatus);

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
        return <RulesPage />;
      case "requests":
        return <RequestsPage />;
      case "preview":
        return <PreviewPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <RulesPage />;
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
