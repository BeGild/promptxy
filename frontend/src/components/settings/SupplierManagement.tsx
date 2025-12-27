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

import React, { useState } from 'react';
import {
  Card,
  CardBody,
  Button,
  Input,
  Switch,
  Badge,
  Spinner,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
} from '@heroui/react';
import { Network, Plus, Edit2, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';
import {
  useSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useToggleSupplier,
  COMMON_PREFIX_OPTIONS,
  getPrefixColor,
  groupSuppliersByPrefix,
} from '@/hooks';
import type { Supplier, PathMapping, CommonPrefixOption } from '@/types/api';

export const SupplierManagement: React.FC = () => {
  const { data: suppliersData, isLoading } = useSuppliers();
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();
  const toggleMutation = useToggleSupplier();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedPrefixOption, setSelectedPrefixOption] = useState<string>('custom');

  // 新增供应商表单状态
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    baseUrl: '',
    localPrefix: '',
    pathMappings: [] as PathMapping[],
    enabled: true,
  });

  const suppliers = suppliersData?.suppliers || [];
  const groupedSuppliers = groupSuppliersByPrefix(suppliers);

  // URL 验证
  const isValidUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // 重置新增表单
  const resetAddForm = () => {
    setNewSupplier({
      name: '',
      baseUrl: '',
      localPrefix: '',
      pathMappings: [],
      enabled: true,
    });
    setSelectedPrefixOption('custom');
  };

  // 打开新增模态框
  const handleOpenAddModal = () => {
    resetAddForm();
    setIsAddModalOpen(true);
  };

  // 关闭新增模态框
  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    resetAddForm();
  };

  // 选择常用前缀
  const handleSelectPrefix = (prefix: string) => {
    const option = COMMON_PREFIX_OPTIONS.find(opt => opt.prefix === prefix);
    if (option) {
      setNewSupplier({
        ...newSupplier,
        localPrefix: prefix,
      });
      setSelectedPrefixOption(prefix);
    }
  };

  // 创建供应商
  const handleCreateSupplier = async () => {
    if (!newSupplier.name || !newSupplier.baseUrl || !newSupplier.localPrefix) {
      toast.error('请填写所有必填字段');
      return;
    }

    if (!isValidUrl(newSupplier.baseUrl)) {
      toast.error('API 地址格式无效，请使用 http:// 或 https:// 开头的地址');
      return;
    }

    if (!newSupplier.localPrefix.startsWith('/')) {
      toast.error('本地路径前缀必须以 / 开头');
      return;
    }

    try {
      await createMutation.mutateAsync({
        supplier: newSupplier,
      });
      handleCloseAddModal();
      toast.success('供应商已创建！');
    } catch (error: any) {
      toast.error(`创建失败: ${error?.message || '未知错误'}`);
    }
  };

  // 打开编辑模态框
  const handleOpenEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsEditModalOpen(true);
  };

  // 关闭编辑模态框
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingSupplier(null);
  };

  // 更新供应商
  const handleUpdateSupplier = async () => {
    if (!editingSupplier) return;

    if (!isValidUrl(editingSupplier.baseUrl)) {
      toast.error('API 地址格式无效');
      return;
    }

    if (!editingSupplier.localPrefix.startsWith('/')) {
      toast.error('本地路径前缀必须以 / 开头');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        supplierId: editingSupplier.id,
        request: { supplier: editingSupplier },
      });
      handleCloseEditModal();
      toast.success('供应商已更新！');
    } catch (error: any) {
      toast.error(`更新失败: ${error?.message || '未知错误'}`);
    }
  };

  // 删除供应商
  const handleDeleteSupplier = async (supplier: Supplier) => {
    toast.promise(
      deleteMutation.mutateAsync(supplier.id),
      {
        loading: '正在删除供应商...',
        success: '供应商已删除！',
        error: (err) => `删除失败: ${err?.message || '未知错误'}`,
      }
    );
  };

  // 切换供应商状态
  const handleToggleSupplier = async (supplier: Supplier) => {
    try {
      await toggleMutation.mutateAsync({
        supplierId: supplier.id,
        request: { enabled: !supplier.enabled },
      });
      // toast.success(`已${!supplier.enabled ? '启用' : '禁用'}供应商`);
    } catch (error: any) {
      toast.error(`切换失败: ${error?.message || '未知错误'}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner color="primary">加载供应商列表中...</Spinner>
      </div>
    );
  }

  return (
    <>
      <Card className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5 shadow-sm">
        <CardBody className="space-y-6 p-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Network size={24} className="text-status-success" />
              <h4 className="text-lg font-bold text-primary">
                供应商管理
              </h4>
            </div>
            <Button
              color="primary"
              variant="flat"
              onPress={handleOpenAddModal}
              radius="lg"
              className="shadow-sm"
              startContent={<Plus size={18} />}
            >
              添加供应商
            </Button>
          </div>

          {groupedSuppliers.length === 0 ? (
            <div className="text-center py-12 bg-canvas dark:bg-secondary/30 rounded-xl border border-dashed border-subtle">
              <Network size={48} className="mx-auto text-tertiary mb-3" />
              <p className="text-secondary font-medium">暂无供应商配置</p>
              <p className="text-sm text-tertiary mt-1">点击上方按钮添加新的供应商</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedSuppliers.map(group => (
                <div key={group.prefix} className="space-y-3">
                  <div className="flex items-center gap-2 text-sm px-1">
                    <span className="text-lg">{group.color}</span>
                    <span className="font-mono font-bold text-primary bg-canvas dark:bg-secondary px-2 py-0.5 rounded">
                      {group.prefix}
                    </span>
                    <span className="text-secondary">({group.suppliers.length} 个供应商)</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {group.suppliers.map(supplier => (
                      <Card
                        key={supplier.id}
                        className={`border-l-4 transition-all hover:shadow-md ${
                          supplier.enabled
                            ? 'border-l-success border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5'
                            : 'border-l-default border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5 opacity-80 hover:opacity-100'
                        }`}
                        shadow="none"
                      >
                        <CardBody className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-primary">{supplier.name}</span>
                                {supplier.enabled && (
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-status-success"></span>
                                  </span>
                                )}
                              </div>
                              <div className="text-xs space-y-1">
                                <div className="flex items-center gap-1.5 text-secondary">
                                  <span className="font-mono bg-canvas dark:bg-secondary/50 px-1.5 py-0.5 rounded text-primary">
                                    {supplier.localPrefix}
                                  </span>
                                  <span className="text-tertiary">→</span>
                                  <span className="truncate max-w-[180px] text-secondary" title={supplier.baseUrl}>
                                    {supplier.baseUrl}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-end mb-1">
                                <Switch
                                  size="sm"
                                  isSelected={supplier.enabled}
                                  onValueChange={() => handleToggleSupplier(supplier)}
                                  isDisabled={toggleMutation.isPending}
                                  classNames={{
                                    wrapper: "group-data-[selected=true]:bg-green-500",
                                  }}
                                />
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  onPress={() => handleOpenEditModal(supplier)}
                                  isDisabled={updateMutation.isPending}
                                  className="text-secondary hover:text-brand-primary"
                                >
                                  <Edit2 size={16} />
                                </Button>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  color="danger"
                                  variant="light"
                                  onPress={() => handleDeleteSupplier(supplier)}
                                  isDisabled={deleteMutation.isPending}
                                  className="text-tertiary hover:text-status-error"
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-xs text-secondary bg-brand-primary/10 dark:bg-brand-primary/20 p-3 rounded-lg flex items-start gap-2">
            <Info size={16} className="text-brand-primary shrink-0 mt-0.5" />
            <span>相同颜色的供应商共享相同的本地路径前缀，同一组内同时只能启用一个供应商。</span>
          </div>
        </CardBody>
      </Card>

      {/* 新增供应商模态框 */}
      <Modal isOpen={isAddModalOpen} onClose={handleCloseAddModal} size="2xl" backdrop="blur">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <span className="text-xl font-bold">添加供应商</span>
            <span className="text-sm font-normal text-secondary">配置新的上游 LLM 服务提供商</span>
          </ModalHeader>
          <ModalBody className="space-y-4">
            <Input
              label="名称"
              placeholder="例如：Claude Official"
              value={newSupplier.name}
              onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })}
              isRequired
              radius="lg"
              variant="bordered"
              labelPlacement="outside"
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">本地路径前缀</label>
              <div className="flex gap-2">
                <Select
                  placeholder="选择常用前缀"
                  selectedKeys={[selectedPrefixOption]}
                  onSelectionChange={keys => {
                    const key = Array.from(keys)[0] as string;
                    if (key !== 'custom') {
                      handleSelectPrefix(key);
                    } else {
                      setSelectedPrefixOption('custom');
                    }
                  }}
                  radius="lg"
                  variant="bordered"
                  className="w-1/3"
                >
                  <>
                    {COMMON_PREFIX_OPTIONS.map(option => (
                      <SelectItem key={option.prefix} textValue={option.label}>
                        <div className="flex items-center gap-2">
                          <span>{option.color}</span>
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem key="custom" textValue="自定义">
                      🆕 自定义...
                    </SelectItem>
                  </>
                </Select>

                <Input
                  placeholder="/custom"
                  value={newSupplier.localPrefix}
                  onChange={e => setNewSupplier({ ...newSupplier, localPrefix: e.target.value })}
                  isRequired
                  radius="lg"
                  variant="bordered"
                  className="flex-1"
                  startContent={<span className="text-tertiary">{selectedPrefixOption !== 'custom' ? getPrefixColor(newSupplier.localPrefix) : '🔹'}</span>}
                />
              </div>
            </div>

            <Input
              label="上游地址"
              placeholder="https://api.example.com"
              value={newSupplier.baseUrl}
              onChange={e => setNewSupplier({ ...newSupplier, baseUrl: e.target.value })}
              isRequired
              radius="lg"
              variant="bordered"
              labelPlacement="outside"
              description="目标 API 服务的根地址"
            />

            <div className="flex items-center gap-2 p-3 bg-canvas dark:bg-secondary rounded-lg">
              <Switch
                isSelected={newSupplier.enabled}
                onValueChange={enabled => setNewSupplier({ ...newSupplier, enabled })}
                size="sm"
              >
                <span className="text-sm font-medium">立即启用此供应商</span>
              </Switch>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={handleCloseAddModal}>
              取消
            </Button>
            <Button
              color="primary"
              onPress={handleCreateSupplier}
              isLoading={createMutation.isPending}
              className="shadow-md"
            >
              {createMutation.isPending ? '创建中...' : '创建供应商'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 编辑供应商模态框 */}
      <Modal isOpen={isEditModalOpen} onClose={handleCloseEditModal} size="2xl" backdrop="blur">
        <ModalContent>
          <ModalHeader>编辑供应商</ModalHeader>
          <ModalBody className="space-y-4">
            {editingSupplier && (
              <>
                <Input
                  label="名称"
                  placeholder="例如：Claude Official"
                  value={editingSupplier.name}
                  onChange={e =>
                    setEditingSupplier({ ...editingSupplier, name: e.target.value })
                  }
                  isRequired
                  radius="lg"
                  variant="bordered"
                  labelPlacement="outside"
                />

                <Input
                  label="本地路径前缀"
                  placeholder="/custom"
                  value={editingSupplier.localPrefix}
                  onChange={e =>
                    setEditingSupplier({ ...editingSupplier, localPrefix: e.target.value })
                  }
                  isRequired
                  radius="lg"
                  variant="bordered"
                  labelPlacement="outside"
                  startContent={<span className="text-tertiary">{getPrefixColor(editingSupplier.localPrefix)}</span>}
                />

                <Input
                  label="上游地址"
                  placeholder="https://api.example.com"
                  value={editingSupplier.baseUrl}
                  onChange={e =>
                    setEditingSupplier({ ...editingSupplier, baseUrl: e.target.value })
                  }
                  isRequired
                  radius="lg"
                  variant="bordered"
                  labelPlacement="outside"
                />

                <div className="flex items-center gap-2 p-3 bg-canvas dark:bg-secondary rounded-lg">
                  <Switch
                    isSelected={editingSupplier.enabled}
                    onValueChange={enabled =>
                      setEditingSupplier({ ...editingSupplier, enabled })
                    }
                    size="sm"
                  >
                    <span className="text-sm font-medium">启用此供应商</span>
                  </Switch>
                </div>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={handleCloseEditModal}>
              取消
            </Button>
            <Button
              color="primary"
              onPress={handleUpdateSupplier}
              isLoading={updateMutation.isPending}
              className="shadow-md"
            >
              {updateMutation.isPending ? '更新中...' : '保存更改'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
