/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - style={{ paddingLeft: '16px' }}
 * - className="text-gray-500"
 *
 * ✅ REQUIRED:
 * - style={{ paddingLeft: 'var(--spacing-md)' }}
 * - className="text-secondary"
 */

import React from 'react';
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Button,
  Tooltip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from '@heroui/react';
import {
  ClipboardList,
  Activity,
  PlayCircle,
  Settings,
  Sun,
  Moon,
  Monitor,
  Laptop,
} from 'lucide-react';
import { StatusIndicator, LogoIcon } from '@/components/common';
import { useUIStore } from '@/store';

interface HeaderProps {
  sseConnected: boolean;
  apiConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({ sseConnected, apiConnected }) => {
  const activeTab = useUIStore(state => state.activeTab);
  const setActiveTab = useUIStore(state => state.setActiveTab);
  const theme = useUIStore(state => state.theme);
  const setTheme = useUIStore(state => state.setTheme);

  const menuItems = [
    { key: 'rules', label: '规则管理', icon: ClipboardList, desc: '创建和管理修改规则' },
    { key: 'requests', label: '请求监控', icon: Activity, desc: '查看实时请求历史' },
    { key: 'preview', label: '预览测试', icon: PlayCircle, desc: '测试规则效果' },
    { key: 'settings', label: '设置', icon: Settings, desc: '配置和数据管理' },
  ];

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun size={20} />;
      case 'dark':
        return <Moon size={20} />;
      case 'system':
        return <Laptop size={20} />;
      default:
        return <Sun size={20} />;
    }
  };

  return (
    <Navbar
      isBordered
      className="h-14 bg-white/70 dark:bg-black/70 backdrop-blur-md"
      maxWidth="full"
      style={{ paddingLeft: 'var(--spacing-md)', paddingRight: 'var(--spacing-md)' }}
    >
      {/* 左侧：Logo 和名称 */}
      <NavbarBrand className="gap-3">
        <div className="p-1.5 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-lg shadow-lg shadow-blue-500/20">
          <LogoIcon size={20} className="text-white" />
        </div>
        <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400">
          PromptXY
        </span>
      </NavbarBrand>

      {/* 中间：Dock 导航图标 */}
      <NavbarContent justify="center" className="gap-2">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <Tooltip
              key={item.key}
              content={
                <div className="px-1 py-0.5">
                  <div className="font-semibold text-sm">{item.label}</div>
                  <div className="text-xs text-secondary">{item.desc}</div>
                </div>
              }
              placement="bottom"
              showArrow
              delay={0}
              closeDelay={0}
              classNames={{
                content: 'bg-white dark:bg-secondary shadow-xl border border-default',
              }}
            >
              <Button
                isIconOnly
                variant={isActive ? 'flat' : 'light'}
                color={isActive ? 'primary' : 'default'}
                onPress={() => setActiveTab(item.key as any)}
                className={`transition-all duration-300 ${
                  isActive
                    ? 'bg-primary/10 text-primary dark:text-primary-400'
                    : 'text-secondary hover:text-primary dark:hover:text-inverse hover:bg-canvas dark:hover:bg-secondary'
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </Button>
            </Tooltip>
          );
        })}
      </NavbarContent>

      {/* 右侧：状态指示器和主题切换 */}
      <NavbarContent justify="end" className="gap-4">
        <div className="flex items-center gap-sm px-3 py-1.5 bg-canvas dark:bg-secondary/50 rounded-full border border-subtle">
          <StatusIndicator
            connected={apiConnected}
            error={!apiConnected ? 'API未连接' : null}
            showText={false}
          />
          <div className="w-px h-3 bg-border-default" />
          <StatusIndicator
            connected={sseConnected}
            error={!sseConnected ? 'SSE未连接' : null}
            showText={false}
          />
        </div>

        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <Button
              isIconOnly
              variant="light"
              className="text-secondary hover:text-primary dark:text-secondary dark:hover:text-inverse"
            >
              {getThemeIcon()}
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Theme Actions"
            onAction={key => setTheme(key as any)}
            selectedKeys={[theme]}
            selectionMode="single"
          >
            <DropdownItem key="light" startContent={<Sun size={16} />}>
              浅色模式
            </DropdownItem>
            <DropdownItem key="dark" startContent={<Moon size={16} />}>
              深色模式
            </DropdownItem>
            <DropdownItem key="system" startContent={<Laptop size={16} />}>
              跟随系统
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </NavbarContent>
    </Navbar>
  );
};
