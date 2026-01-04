/**
 * 供应商管理页面
 * 只管理上游供应商，不绑定本地路径
 */

import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardBody,
  Button,
  Input,
  Select,
  SelectItem,
  Switch,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Chip,
  Divider,
} from '@heroui/react';
import { Plus, Edit2, Trash2, Settings, Globe, Lock, Info } from 'lucide-react';
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier, useToggleSupplier } from '@/hooks';
import type { Supplier, SupplierProtocol } from '@/types/api';

// 供应商协议选项
const SUPPLIER_PROTOCOLS: Array<{
  key: SupplierProtocol;
  label: string;
  description: string;
  color: string;
  icon: string;
}> = [
  {
    key: 'anthropic',
    label: 'Anthropic',
    description: 'Claude API 协议',
    color: '🟣',
    icon: '🤖',
  },
  {
    key: 'openai',
    label: 'OpenAI',
    description: 'OpenAI API 协议',
    color: '🟢',
    icon: '🧠',
  },
  {
    key: 'gemini',
    label: 'Gemini',
    description: 'Google Gemini API 协议',
    color: '🔵',
    icon: '💎',
  },
];

// 认证类型选项
const AUTH_TYPES = [
  { key: 'none', label: '无认证' },
  { key: 'bearer', label: 'Bearer Token' },
  { key: 'header', label: '自定义 Header' },
];

export const SupplierManagementPage: React.FC = () => {
  const { data: suppliersData, isLoading, refetch } = useSuppliers();
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();
  const toggleMutation = useToggleSupplier();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [modelInput, setModelInput] = useState('');
  const [formData, setFormData] = useState<Partial<Supplier>>({
    name: '',
    displayName: '',
    baseUrl: '',
    protocol: 'anthropic',
    enabled: true,
    auth: { type: 'none' },
    supportedModels: [],
    description: '',
  });

  const suppliers = suppliersData?.suppliers || [];

  // 打开添加供应商弹窗
  const handleOpenAddModal = useCallback(() => {
    setEditingSupplier(null);
    setModelInput('');
    setFormData({
      name: '',
      displayName: '',
      baseUrl: '',
      protocol: 'anthropic',
      enabled: true,
      auth: { type: 'none' },
      supportedModels: [],
      description: '',
    });
    setIsModalOpen(true);
  }, []);

  // 打开编辑供应商弹窗
  const handleOpenEditModal = useCallback((supplier: Supplier) => {
    setEditingSupplier(supplier);
    setModelInput('');
    setFormData({ ...supplier });
    setIsModalOpen(true);
  }, []);

  // 保存供应商
  const handleSaveSupplier = useCallback(async () => {
    if (!formData.name || !formData.baseUrl || !formData.protocol) {
      toast.error('请填写必填字段');
      return;
    }

    try {
      if (editingSupplier) {
        // 根据实际的 API 类型定义调整参数结构
        await updateMutation.mutateAsync({
          supplierId: editingSupplier.id,
          supplier: formData as Supplier,
        });
      } else {
        await createMutation.mutateAsync({
          supplier: formData as Omit<Supplier, 'id'>,
        });
      }

      setIsModalOpen(false);
      await refetch();
      toast.success(`${editingSupplier ? '更新' : '添加'}供应商成功！`);
    } catch (error: any) {
      toast.error(`${editingSupplier ? '更新' : '添加'}失败: ${error?.message || '未知错误'}`);
    }
  }, [formData, editingSupplier, updateMutation, createMutation, refetch]);

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
      await refetch();
      toast.success('供应商状态已更新！');
    } catch (error: any) {
      toast.error(`更新失败: ${error?.message || '未知错误'}`);
    }
  }, [toggleMutation, refetch]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary mb-2">
          供应商管理
        </h1>
        <p className="text-secondary text-sm">
          管理上游 API 供应商，配置其协议类型和认证信息
        </p>
      </div>

      {/* 添加供应商按钮 */}
      <div className="mb-6">
        <Button
          color="primary"
          onPress={handleOpenAddModal}
          startContent={<Plus size={18} />}
          className="shadow-md"
        >
          添加供应商
        </Button>
      </div>

      {/* 供应商列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map(supplier => {
          const protocol = SUPPLIER_PROTOCOLS.find(p => p.key === supplier.protocol);

          return (
            <Card
              key={supplier.id}
              className={`border transition-all ${
                supplier.enabled
                  ? 'border-brand-primary/30 dark:border-brand-primary/20 bg-elevated'
                  : 'border-subtle opacity-60'
              }`}
            >
              <CardBody className="p-6">
                {/* 供应商头部 */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{protocol?.icon}</div>
                    <div>
                      <h3 className="font-bold text-primary text-lg">
                        {supplier.displayName || supplier.name}
                      </h3>
                      <p className="text-xs text-secondary">{supplier.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Switch
                      size="sm"
                      isSelected={supplier.enabled}
                      onValueChange={() => handleToggleSupplier(supplier)}
                    />
                  </div>
                </div>

                {/* 协议类型 */}
                <div className="mb-3">
                  <Chip
                    size="sm"
                    variant="flat"
                    className="bg-brand-primary/10 dark:bg-brand-primary/20"
                  >
                    {protocol?.color} {protocol?.label}
                  </Chip>
                </div>

                {/* API 地址 */}
                <div className="mb-3">
                  <div className="flex items-center gap-2 text-xs text-secondary">
                    <Globe size={14} />
                    <span className="truncate">{supplier.baseUrl}</span>
                  </div>
                </div>

                {/* 认证信息 */}
                {supplier.auth && supplier.auth.type !== 'none' && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 text-xs text-secondary">
                      <Lock size={14} />
                      <span>
                        {supplier.auth.type === 'bearer' && 'Bearer Token 认证'}
                        {supplier.auth.type === 'header' && '自定义 Header 认证'}
                      </span>
                    </div>
                  </div>
                )}

                {/* 描述 */}
                {supplier.description && (
                  <div className="mb-4">
                    <p className="text-xs text-tertiary line-clamp-2">
                      {supplier.description}
                    </p>
                  </div>
                )}

                {/* 操作按钮 */}
                <Divider className="my-3" />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => handleOpenEditModal(supplier)}
                    startContent={<Edit2 size={14} />}
                    className="flex-1"
                  >
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    color="danger"
                    variant="light"
                    onPress={() => handleDeleteSupplier(supplier)}
                    isIconOnly
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </CardBody>
            </Card>
          );
        })}

        {suppliers.length === 0 && !isLoading && (
          <Card className="col-span-full border border-dashed border-subtle">
            <CardBody className="py-12 text-center">
              <Settings size={48} className="mx-auto text-tertiary mb-3" />
              <p className="text-secondary font-medium">暂无供应商</p>
              <p className="text-sm text-tertiary mt-1">
                点击上方按钮添加新的上游供应商
              </p>
            </CardBody>
          </Card>
        )}
      </div>

      {/* 添加/编辑供应商弹窗 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size="2xl"
        backdrop="blur"
        placement="center"
      >
        <ModalContent>
          <ModalHeader>
            {editingSupplier ? '编辑供应商' : '添加供应商'}
          </ModalHeader>
          <ModalBody className="space-y-4">
            <div className="p-4 bg-brand-primary/10 dark:bg-brand-primary/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Info size={16} className="text-brand-primary shrink-0 mt-0.5" />
                <p className="text-xs text-secondary">
                  供应商代表上游 API 服务，配置其协议类型和认证信息。添加后可在路由配置中选择使用。
                </p>
              </div>
            </div>

            {/* 基本信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-primary mb-2 block">
                  供应商名称 *
                </label>
                <Input
                  value={formData.name || ''}
                  onValueChange={value =>
                    setFormData(prev => ({ ...prev, name: value }))
                  }
                  placeholder="例如: anthropic-official"
                  radius="lg"
                  variant="bordered"
                  description="唯一标识符，用于内部引用"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-primary mb-2 block">
                  显示名称 *
                </label>
                <Input
                  value={formData.displayName || ''}
                  onValueChange={value =>
                    setFormData(prev => ({ ...prev, displayName: value }))
                  }
                  placeholder="例如: Anthropic Official"
                  radius="lg"
                  variant="bordered"
                  description="在界面上显示的名称"
                />
              </div>
            </div>

            {/* API 地址 */}
            <div>
              <label className="text-sm font-medium text-primary mb-2 block">
                API 地址 *
              </label>
              <Input
                value={formData.baseUrl || ''}
                onValueChange={value =>
                  setFormData(prev => ({ ...prev, baseUrl: value }))
                }
                placeholder="https://api.anthropic.com"
                radius="lg"
                variant="bordered"
                description="上游 API 的完整 URL"
              />
            </div>

            {/* 协议类型 */}
            <div>
              <label className="text-sm font-medium text-primary mb-2 block">
                协议类型 *
              </label>
              <Select
                selectedKeys={[formData.protocol || '']}
                onSelectionChange={keys => {
                  const key = Array.from(keys)[0] as SupplierProtocol;
                  setFormData(prev => ({ ...prev, protocol: key }));
                }}
                radius="lg"
                variant="bordered"
              >
                {SUPPLIER_PROTOCOLS.map(protocol => (
                  <SelectItem
                    key={protocol.key}
                    textValue={protocol.label}
                    description={protocol.description}
                  >
                    <div className="flex items-center gap-2">
                      <span>{protocol.icon}</span>
                      <span>{protocol.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </Select>
            </div>

            {/* 支持模型（Chips） */}
            <div>
              <label className="text-sm font-medium text-primary mb-2 block">
                支持的模型
              </label>
              <div className="p-3 rounded-lg border border-subtle bg-canvas dark:bg-secondary/30 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(formData.supportedModels || []).length === 0 ? (
                    <span className="text-xs text-tertiary">未配置（/claude 映射与校验将不可用）</span>
                  ) : (
                    (formData.supportedModels || []).map(model => (
                      <Chip
                        key={model}
                        size="sm"
                        variant="flat"
                        onClose={() => {
                          setFormData(prev => ({
                            ...prev,
                            supportedModels: (prev.supportedModels || []).filter(m => m !== model),
                          }));
                        }}
                      >
                        {model}
                      </Chip>
                    ))
                  )}
                </div>

                <Input
                  value={modelInput}
                  onValueChange={setModelInput}
                  placeholder="输入模型后回车添加，例如: gpt-5.2-codex-high"
                  radius="lg"
                  variant="bordered"
                  description="支持回车添加、去重；用于 Claude 路由模型映射与校验"
                  onKeyDown={e => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    const value = modelInput.trim();
                    if (!value) return;
                    setFormData(prev => {
                      const list = prev.supportedModels || [];
                      if (list.includes(value)) return prev;
                      return { ...prev, supportedModels: [...list, value] };
                    });
                    setModelInput('');
                  }}
                />
              </div>
            </div>

            {/* 认证配置 */}
            <div>
              <label className="text-sm font-medium text-primary mb-2 block">
                认证方式
              </label>
              <Select
                selectedKeys={[formData.auth?.type || 'none']}
                onSelectionChange={keys => {
                  const type = Array.from(keys)[0] as any;
                  setFormData(prev => ({
                    ...prev,
                    auth: { ...prev.auth, type },
                  }));
                }}
                radius="lg"
                variant="bordered"
              >
                {AUTH_TYPES.map(auth => (
                  <SelectItem key={auth.key} textValue={auth.label}>
                    {auth.label}
                  </SelectItem>
                ))}
              </Select>
            </div>

            {/* 认证详情 */}
            {formData.auth?.type === 'bearer' && (
              <div>
                <label className="text-sm font-medium text-primary mb-2 block">
                  Bearer Token
                </label>
                <Input
                  value={formData.auth?.token || ''}
                  onValueChange={value =>
                    setFormData(prev => ({
                      ...prev,
                      auth: { ...prev.auth, token: value, type: 'bearer' },
                    }))
                  }
                  placeholder="sk-ant-..."
                  radius="lg"
                  variant="bordered"
                  type="password"
                  description="API 认证令牌"
                />
              </div>
            )}

            {formData.auth?.type === 'header' && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-primary mb-2 block">
                    Header 名称
                  </label>
                  <Input
                    value={formData.auth?.headerName || ''}
                    onValueChange={value =>
                      setFormData(prev => ({
                        ...prev,
                        auth: { ...prev.auth, headerName: value, type: 'header' },
                      }))
                    }
                    placeholder="Authorization"
                    radius="lg"
                    variant="bordered"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-primary mb-2 block">
                    Header 值
                  </label>
                  <Input
                    value={formData.auth?.headerValue || ''}
                    onValueChange={value =>
                      setFormData(prev => ({
                        ...prev,
                        auth: { ...prev.auth, headerValue: value, type: 'header' },
                      }))
                    }
                    placeholder="Bearer xxx"
                    radius="lg"
                    variant="bordered"
                  />
                </div>
              </div>
            )}

            {/* 描述 */}
            <div>
              <label className="text-sm font-medium text-primary mb-2 block">
                描述
              </label>
              <Input
                value={formData.description || ''}
                onValueChange={value =>
                  setFormData(prev => ({ ...prev, description: value }))
                }
                placeholder="供应商的简要说明"
                radius="lg"
                variant="bordered"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setIsModalOpen(false)}>
              取消
            </Button>
            <Button color="primary" onPress={handleSaveSupplier} className="shadow-md">
              {editingSupplier ? '更新' : '添加'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
