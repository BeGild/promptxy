import React from 'react';
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Button, Tooltip } from '@heroui/react';
import { StatusIndicator, LogoIcon } from '@/components/common';
import { useUIStore } from '@/store';

interface HeaderProps {
  sseConnected: boolean;
  apiConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({ sseConnected, apiConnected }) => {
  const activeTab = useUIStore(state => state.activeTab);
  const setActiveTab = useUIStore(state => state.setActiveTab);

  const menuItems = [
    { key: 'rules', label: '规则管理', icon: '📋', desc: '创建和管理修改规则' },
    { key: 'requests', label: '请求监控', icon: '📡', desc: '查看实时请求历史' },
    { key: 'preview', label: '预览测试', icon: '🧪', desc: '测试规则效果' },
    { key: 'settings', label: '设置', icon: '⚙️', desc: '配置和数据管理' },
  ];

  return (
    <Navbar isBordered className="h-12" maxWidth="full" style={{ paddingLeft: '12px', paddingRight: '12px' }}>
      {/* 左侧：Logo 和名称 */}
      <NavbarBrand className="gap-2">
        <LogoIcon size={20} />
        <span style={{ fontWeight: 700, fontSize: '15px' }}>PromptXY</span>
      </NavbarBrand>

      {/* 中间：Dock 导航图标 */}
      <NavbarContent justify="center" className="gap-3">
        {menuItems.map(item => (
          <Tooltip
            key={item.key}
            content={
              <div className="text-small px-1">
                <div className="font-semibold">{item.label}</div>
                <div className="text-xs opacity-70">{item.desc}</div>
              </div>
            }
            placement="bottom"
            showArrow
            color="default"
            delay={100}
          >
            <Button
              isIconOnly
              variant={activeTab === item.key ? 'solid' : 'light'}
              color={activeTab === item.key ? 'primary' : 'default'}
              onPress={() => setActiveTab(item.key as any)}
              size="sm"
              className="transition-transform duration-200 hover:scale-120"
              style={{
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
            </Button>
          </Tooltip>
        ))}
      </NavbarContent>

      {/* 右侧：状态指示器 */}
      <NavbarContent justify="end" className="gap-2">
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
