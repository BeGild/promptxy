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
        width: '44px',
        height: '100%',
        flexShrink: 0,
        background: 'var(--heroui-colors-background)',
        borderRight: '1px solid var(--heroui-colors-border)',
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
          gap: '10px',
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
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
              className="hover:scale-120"
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
            </Button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};
