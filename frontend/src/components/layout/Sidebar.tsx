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
import { Button, Tooltip } from '@heroui/react';
import { useUIStore } from '@/store';

export const Sidebar: React.FC = () => {
  const activeTab = useUIStore(state => state.activeTab);
  const setActiveTab = useUIStore(state => state.setActiveTab);

  const menuItems = [
    { key: 'rules', label: '规则管理', icon: '📋', desc: '创建和管理修改规则' },
    { key: 'requests', label: '请求监控', icon: '📡', desc: '查看实时请求历史' },
    { key: 'preview', label: '预览测试', icon: '🧪', desc: '测试规则效果' },
    { key: 'settings', label: '设置', icon: '⚙️', desc: '配置和数据管理' },
  ];

  return (
    <div className="relative w-3xl h-full flex-shrink-0 bg-bg-primary border-r border-border-default">
      {/* 垂直居中的菜单容器 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-sm items-center">
        {menuItems.map(item => (
          <Tooltip
            key={item.key}
            content={
              <div className="text-small px-1">
                <div className="font-semibold">{item.label}</div>
                <div className="text-xs opacity-70">{item.desc}</div>
              </div>
            }
            placement="right"
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
              className="transition-transform duration-normal ease-smooth hover:scale-120"
            >
              <span className="text-md">{item.icon}</span>
            </Button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};
