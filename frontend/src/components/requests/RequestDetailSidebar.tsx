/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - 硬编码颜色值（如 #007aff, #f5f5f7）
 * - 硬编码尺寸值（如 400px, 16px）
 * - 旧 Tailwind 颜色类（如 gray-*, blue-*, slate-*）
 *
 * ✅ REQUIRED:
 * - 使用语义化变量和类名
 * - 参考 styles/tokens/colors.css 中的可用变量
 */

import React, { useCallback, useEffect } from 'react';
import { Tabs, Tab, Spinner } from '@heroui/react';
import { RequestRecord, PromptxyRule } from '@/types';
import { useUIStore } from '@/store';
import { RequestDetailInSidebar, ResponsePanel } from '@/components/requests';
import { QuickRuleEditor } from '@/components/rules';
import { toast } from 'sonner';

interface RequestDetailSidebarProps {
  request: RequestRecord | null;
  isLoading: boolean;
}

export const RequestDetailSidebar: React.FC<RequestDetailSidebarProps> = ({
  request,
  isLoading,
}) => {
  const { sidebarMode, setSidebarMode, selectedRequestId } = useUIStore();

  // 当请求改变时，重置为详情模式
  useEffect(() => {
    setSidebarMode('detail');
  }, [selectedRequestId, setSidebarMode]);

  const handleSaveRule = useCallback((rule: PromptxyRule) => {
    // TODO: 实现保存规则逻辑
    console.log('保存规则:', rule);
    toast.success('规则已保存');
    // 保存后切换回详情模式
    setSidebarMode('detail');
  }, [setSidebarMode]);

  const handleCancelRule = useCallback(() => {
    // 取消编辑，切换回详情模式
    setSidebarMode('detail');
  }, [setSidebarMode]);

  const handleTestRule = useCallback((rule: PromptxyRule) => {
    // TODO: 实现测试规则逻辑
    console.log('测试规则:', rule);
  }, []);

  const handleSwitchToRuleMode = useCallback(() => {
    setSidebarMode('rule');
  }, [setSidebarMode]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner color="primary" size="sm">加载详情中...</Spinner>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-sm font-medium text-secondary">未找到请求详情</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 模式切换 Tabs */}
      <Tabs
        selectedKey={sidebarMode}
        onSelectionChange={(key) => setSidebarMode(key as 'detail' | 'response' | 'rule')}
        variant="underlined"
        classNames={{
          base: "w-full px-md pt-sm",
          tabList: "border-b border-subtle gap-6",
          cursor: "bg-brand-primary",
          tab: "px-0 h-7",
          tabContent: "group-data-[selected=true]:text-primary text-tertiary font-medium text-sm"
        }}
      >
        <Tab key="detail" title="请求详情" />
        <Tab key="response" title="响应信息" />
        <Tab key="rule" title="创建规则" />
      </Tabs>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto">
        {sidebarMode === 'detail' && (
          <RequestDetailInSidebar
            request={request}
            isLoading={isLoading}
            onSwitchToRuleMode={handleSwitchToRuleMode}
          />
        )}
        {sidebarMode === 'response' && (
          <div className="p-md">
            <ResponsePanel request={request} />
          </div>
        )}
        {sidebarMode === 'rule' && (
          <div className="p-md">
            <QuickRuleEditor
              request={request}
              onSave={handleSaveRule}
              onCancel={handleCancelRule}
              onTest={handleTestRule}
            />
          </div>
        )}
      </div>
    </div>
  );
};
