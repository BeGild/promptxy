/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - 硬编码颜色值（如 #007acc, #ff0000）
 * - 硬编码尺寸值（如 16px, 8px）
 * - 旧 Tailwind 颜色类（如 gray-*, blue-*, slate-*）
 *
 * ✅ REQUIRED:
 * - 使用语义化变量和类名
 * - 参考 styles/tokens/colors.css 中的可用变量
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
  RefreshCw,
  LucideIcon,
} from 'lucide-react';
import { StatusIndicator, LogoIcon } from '@/components/common';
import { ConfigStatusIndicator } from '@/components/layout/ConfigStatusIndicator';
import { useUIStore } from '@/store';

/**
 * 将 menuItems 移到组件外部，避免每次渲染都创建新对象
 * 这可以减少不必要的子组件重渲染
 */
const MENU_ITEMS = [
  { key: 'rules', label: '规则管理', icon: ClipboardList, desc: '创建和管理修改规则' },
  { key: 'requests', label: '请求监控', icon: Activity, desc: '查看实时请求历史' },
  { key: 'preview', label: '预览测试', icon: PlayCircle, desc: '测试规则效果' },
  { key: 'supplier-management', label: '供应商管理', icon: RefreshCw, desc: '管理上游 API 供应商' },
  { key: 'route-config', label: '路由配置', icon: Activity, desc: '配置协议转换路由' },
  { key: 'settings', label: '设置', icon: Settings, desc: '配置和数据管理' },
] as const;

interface HeaderProps {
  sseConnected: boolean;
  apiConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({ sseConnected, apiConnected }) => {
  const activeTab = useUIStore(state => state.activeTab);
  const setActiveTab = useUIStore(state => state.setActiveTab);
  const theme = useUIStore(state => state.theme);
  const setTheme = useUIStore(state => state.setTheme);

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
    <Navbar isBordered className="h-14 px-md bg-bg-primary/70 backdrop-blur-md" maxWidth="full">
      {/* 左侧：Logo 和名称 */}
      <NavbarBrand className="gap-xmd">
        <div className="p-1.5 bg-gradient-to-tr from-brand-primary to-accent rounded-lg shadow-lg shadow-brand-primary/20">
          <LogoIcon size={20} className="text-white" />
        </div>
        <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-text-primary to-text-secondary dark:from-text-primary dark:to-text-tertiary">
          PromptXY
        </span>
      </NavbarBrand>

      {/* 中间：Dock 导航图标 */}
      <NavbarContent justify="center" className="gap-sm">
        {MENU_ITEMS.map(item => {
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
                content: 'bg-elevated dark:bg-elevated shadow-xl border border-default',
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

      {/* 右侧：配置状态、状态指示器和主题切换 */}
      <NavbarContent justify="end" className="gap-md">
        <ConfigStatusIndicator />
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
