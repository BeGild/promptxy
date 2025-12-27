/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - style={{ width: '44px' }}
 * - style={{ gap: '10px' }}
 *
 * ✅ REQUIRED:
 * - style={{ width: 'var(--size-sidebar)' }}
 * - className="gap-md"
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
    <div
      style={{
        position: 'relative',
        width: 'var(--spacing-3xl)', // 48px (接近原来的 44px)
        height: '100%',
        flexShrink: 0,
        background: 'var(--color-bg-primary)',
        borderRight: '1px solid var(--color-border-default)',
      }}
    >
      {/* 垂直居中的菜单容器 */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-sm)', // 8px
          alignItems: 'center',
        }}
      >
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
              style={{
                transition: 'transform var(--transition-normal) var(--ease-smooth)',
              }}
              className="hover:scale-120"
            >
              <span className="text-md">{item.icon}</span>
            </Button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};
