/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - className="bg-gray-50 dark:bg-gray-950"
 *
 * ✅ REQUIRED:
 * - className="bg-canvas dark:bg-secondary"
 */

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier, useToggleSupplier } from '@/hooks';
import { ToolSelector } from '@/components/protocol-config/ToolSelector';
import { SupplierList } from '@/components/protocol-config/SupplierList';
import { TransformationChainView } from '@/components/protocol-config/TransformationChainView';
import { TestValidation } from '@/components/protocol-config/TestValidation';
import { SupplierModal } from '@/components/protocol-config/SupplierModal';
import type { Supplier } from '@/types/api';

// 工具前缀映射（移到组件外部，避免每次渲染都创建新对象）
const TOOL_PREFIX_MAP: Record<string, string> = {
  claude_code: '/claude',
  codex: '/openai',
  gemini: '/gemini',
};

export const ProtocolConfigPage: React.FC = () => {
  const { data: suppliersData, isLoading } = useSuppliers();
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();
  const toggleMutation = useToggleSupplier();

  const [selectedTool, setSelectedTool] = useState<string>('claude_code');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const suppliers = suppliersData?.suppliers || [];
  const selectedToolPrefix = TOOL_PREFIX_MAP[selectedTool];

  // 当工具切换时，自动选择该工具的第一个启用的供应商
  useEffect(() => {
    const enabledSuppliers = suppliers.filter(
      s => s.localPrefix === selectedToolPrefix && s.enabled,
    );
    if (enabledSuppliers.length > 0) {
      setSelectedSupplier(enabledSuppliers[0]);
    } else {
      setSelectedSupplier(null);
    }
  }, [selectedTool, suppliers, selectedToolPrefix]);

  // 处理供应商选择
  const handleSupplierSelect = useCallback((supplier: Supplier) => {
    setSelectedSupplier(supplier);
  }, []);

  // 打开添加供应商弹窗
  const handleOpenAddModal = useCallback(() => {
    setEditingSupplier(null);
    setIsModalOpen(true);
  }, []);

  // 打开编辑供应商弹窗
  const handleOpenEditModal = useCallback((supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsModalOpen(true);
  }, []);

  // 保存供应商
  const handleSaveSupplier = useCallback(async (
    supplierData: Omit<Supplier, 'id'>,
  ) => {
    try {
      if (editingSupplier) {
        // 更新供应商
        await updateMutation.mutateAsync({
          supplierId: editingSupplier.id,
          request: { supplier: { ...editingSupplier, ...supplierData } },
        });
      } else {
        // 创建供应商
        await createMutation.mutateAsync({
          supplier: supplierData,
        });
      }
      setIsModalOpen(false);
    } catch (error: any) {
      toast.error(`${editingSupplier ? '更新' : '创建'}失败: ${error?.message || '未知错误'}`);
    }
  }, [editingSupplier, updateMutation, createMutation]);

  // 删除供应商
  const handleDeleteSupplier = useCallback(async (supplier: Supplier) => {
    toast.promise(deleteMutation.mutateAsync(supplier.id), {
      loading: '正在删除供应商...',
      success: '供应商已删除！',
      error: err => `删除失败: ${err?.message || '未知错误'}`,
    });
  }, [deleteMutation]);

  // 切换供应商状态
  const handleToggleSupplier = useCallback(async (supplier: Supplier) => {
    try {
      await toggleMutation.mutateAsync({
        supplierId: supplier.id,
        request: { enabled: !supplier.enabled },
      });
    } catch (error: any) {
      toast.error(`切换失败: ${error?.message || '未知错误'}`);
    }
  }, [toggleMutation]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary mb-2">
          协议配置
        </h1>
        <p className="text-secondary text-sm">
          配置多供应商协议转换，管理 Claude、OpenAI、Gemini 等服务的路由和转换规则
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：工具选择和供应商列表 */}
        <div className="lg:col-span-1 space-y-6">
          {/* 工具选择器 */}
          <div>
            <h2 className="text-lg font-bold text-primary mb-3">选择工具</h2>
            <ToolSelector
              selectedTool={selectedTool}
              onToolSelect={setSelectedTool}
            />
          </div>

          {/* 供应商列表 */}
          <div>
            <SupplierList
              suppliers={suppliers}
              isLoading={isLoading}
              selectedToolPrefix={selectedToolPrefix}
              onAddSupplier={handleOpenAddModal}
              onEditSupplier={handleOpenEditModal}
              onDeleteSupplier={handleDeleteSupplier}
              onToggleSupplier={handleToggleSupplier}
            />
          </div>
        </div>

        {/* 右侧：转换链和测试 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 转换链可视化 */}
          <TransformationChainView supplier={selectedSupplier} />

          {/* 测试验证 */}
          <TestValidation
            supplier={selectedSupplier}
            selectedToolPrefix={selectedToolPrefix}
          />
        </div>
      </div>

      {/* 供应商弹窗 */}
      <SupplierModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        supplier={editingSupplier}
        defaultPrefix={selectedToolPrefix}
        onSave={handleSaveSupplier}
      />
    </div>
  );
};