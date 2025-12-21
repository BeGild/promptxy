import React from 'react';
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Button,
  Chip,
  Spacer,
} from '@heroui/react';
import { StatusIndicator } from '@/components/common';
import { useUIStore } from '@/store';

interface HeaderProps {
  onToggleSidebar: () => void;
  sseConnected: boolean;
  apiConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, sseConnected, apiConnected }) => {
  const activeTab = useUIStore(state => state.activeTab);

  const getTabLabel = (tab: string) => {
    const labels: Record<string, string> = {
      rules: '📋 规则管理',
      requests: '📡 请求监控',
      preview: '🧪 预览测试',
      settings: '⚙️ 设置',
    };
    return labels[tab] || tab;
  };

  return (
    <Navbar isBordered>
      <NavbarBrand>
        <Button isIconOnly variant="light" onPress={onToggleSidebar} aria-label="菜单">
          ☰
        </Button>
        <Spacer x={1} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 700, fontSize: '18px' }}>PromptXY</span>
          <span style={{ fontSize: '12px', color: 'var(--heroui-colors-text-secondary)' }}>
            v2.0
          </span>
        </div>
      </NavbarBrand>

      <NavbarContent justify="center">
        <NavbarItem>
          <Chip color="primary" variant="flat" size="sm">
            {getTabLabel(activeTab)}
          </Chip>
        </NavbarItem>
      </NavbarContent>

      <NavbarContent justify="end">
        <NavbarItem>
          <StatusIndicator
            connected={apiConnected}
            error={!apiConnected ? 'API未连接' : null}
            showText={false}
          />
        </NavbarItem>
        <NavbarItem>
          <StatusIndicator
            connected={sseConnected}
            error={!sseConnected ? 'SSE未连接' : null}
            showText={false}
          />
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
};
