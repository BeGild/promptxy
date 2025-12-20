import React from "react";
import { Button, Spacer, Divider, Card, Badge } from "@heroui/react";
import { useUIStore } from "@/store";

interface SidebarProps {
  collapsed: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onClose }) => {
  const activeTab = useUIStore((state) => state.activeTab);
  const setActiveTab = useUIStore((state) => state.setActiveTab);

  const menuItems = [
    { key: "rules", label: "规则管理", icon: "📋", desc: "创建和管理修改规则" },
    { key: "requests", label: "请求监控", icon: "📡", desc: "查看实时请求历史" },
    { key: "preview", label: "预览测试", icon: "🧪", desc: "测试规则效果" },
    { key: "settings", label: "设置", icon: "⚙️", desc: "配置和数据管理" },
  ];

  if (collapsed) {
    return (
      <div style={{ width: "60px", background: "var(--heroui-colors-background)", borderRight: "1px solid var(--heroui-colors-border)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "8px" }}>
          {menuItems.map((item) => (
            <Button
              key={item.key}
              isIconOnly
              variant={activeTab === item.key ? "flat" : "light"}
              color={activeTab === item.key ? "primary" : "default"}
              onPress={() => {
                setActiveTab(item.key as any);
                onClose();
              }}
              size="sm"
            >
              {item.icon}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "280px", background: "var(--heroui-colors-background)", borderRight: "1px solid var(--heroui-colors-border)", overflowY: "auto" }}>
      <div style={{ padding: "16px" }}>
        <h4 style={{ marginBottom: "16px" }}>导航菜单</h4>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {menuItems.map((item) => (
            <Card
              key={item.key}
              isPressable
              onPress={() => {
                setActiveTab(item.key as any);
                onClose();
              }}
              style={{
                padding: "12px",
                cursor: "pointer",
                border: activeTab === item.key ? "2px solid var(--heroui-colors-primary)" : "1px solid var(--heroui-colors-border)",
                backgroundColor: activeTab === item.key ? "rgba(0, 122, 204, 0.1)" : "transparent"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "20px" }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "bold", fontSize: "14px" }}>{item.label}</div>
                  <div style={{ fontSize: "12px", color: "var(--heroui-colors-text-secondary)" }}>{item.desc}</div>
                </div>
                {activeTab === item.key && (
                  <Badge color="primary" size="sm" variant="flat">
                    当前
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>

        <Spacer y={2} />

        <Card style={{ padding: "12px", backgroundColor: "rgba(0, 122, 204, 0.05)" }}>
          <div style={{ fontSize: "12px", color: "var(--heroui-colors-text-secondary)" }}>
            提示: 请确保后端服务正在运行，端口 7070 和 7071 需要可用。
          </div>
        </Card>
      </div>
    </div>
  );
};
