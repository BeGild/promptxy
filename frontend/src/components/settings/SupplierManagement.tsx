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
      alert('请填写所有必填字段');
      return;
    }

    if (!isValidUrl(newSupplier.baseUrl)) {
      alert('API 地址格式无效，请使用 http:// 或 https:// 开头的地址');
      return;
    }

    if (!newSupplier.localPrefix.startsWith('/')) {
      alert('本地路径前缀必须以 / 开头');
      return;
    }

    try {
      await createMutation.mutateAsync({
        supplier: newSupplier,
      });
      handleCloseAddModal();
      alert('供应商已创建！');
    } catch (error: any) {
      alert(`创建失败: ${error?.message || '未知错误'}`);
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
      alert('API 地址格式无效');
      return;
    }

    if (!editingSupplier.localPrefix.startsWith('/')) {
      alert('本地路径前缀必须以 / 开头');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        supplierId: editingSupplier.id,
        request: { supplier: editingSupplier },
      });
      handleCloseEditModal();
      alert('供应商已更新！');
    } catch (error: any) {
      alert(`更新失败: ${error?.message || '未知错误'}`);
    }
  };

  // 删除供应商
  const handleDeleteSupplier = async (supplier: Supplier) => {
    if (confirm(`确定要删除供应商 "${supplier.name}" 吗？`)) {
      try {
        await deleteMutation.mutateAsync(supplier.id);
        alert('供应商已删除！');
      } catch (error: any) {
        alert(`删除失败: ${error?.message || '未知错误'}`);
      }
    }
  };

  // 切换供应商状态
  const handleToggleSupplier = async (supplier: Supplier) => {
    try {
      await toggleMutation.mutateAsync({
        supplierId: supplier.id,
        request: { enabled: !supplier.enabled },
      });
    } catch (error: any) {
      alert(`切换失败: ${error?.message || '未知错误'}`);
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
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardBody className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-lg font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
              供应商管理
            </h4>
            <Button
              color="primary"
              variant="flat"
              onPress={handleOpenAddModal}
              radius="lg"
              className="shadow-md hover:shadow-lg transition-shadow"
            >
              + 添加供应商
            </Button>
          </div>

          {groupedSuppliers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              暂无供应商配置，请点击上方按钮添加。
            </div>
          ) : (
            <div className="space-y-3">
              {groupedSuppliers.map(group => (
                <div key={group.prefix} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span>{group.color}</span>
                    <span className="font-mono font-bold">{group.prefix}</span>
                    <span>({group.suppliers.length} 个供应商)</span>
                  </div>
                  {group.suppliers.map(supplier => (
                    <Card
                      key={supplier.id}
                      className={`border-l-4 ${
                        supplier.enabled
                          ? 'border-l-success bg-white dark:bg-gray-800'
                          : 'border-l-default bg-gray-50 dark:bg-gray-900/50'
                      }`}
                    >
                      <CardBody className="p-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{supplier.name}</span>
                              <Badge
                                color={supplier.enabled ? 'success' : 'default'}
                                variant="flat"
                                size="sm"
                              >
                                {supplier.enabled ? '已启用' : '已禁用'}
                              </Badge>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                              {group.color} {supplier.localPrefix} → {supplier.baseUrl}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              size="sm"
                              isSelected={supplier.enabled}
                              onValueChange={() => handleToggleSupplier(supplier)}
                              isDisabled={toggleMutation.isPending}
                            />
                            <Button
                              size="sm"
                              color="default"
                              variant="light"
                              onPress={() => handleOpenEditModal(supplier)}
                              isDisabled={updateMutation.isPending}
                            >
                              编辑
                            </Button>
                            <Button
                              size="sm"
                              color="danger"
                              variant="light"
                              onPress={() => handleDeleteSupplier(supplier)}
                              isDisabled={deleteMutation.isPending}
                            >
                              删除
                            </Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/30 p-3 rounded-lg">
            💡 提示：相同颜色的供应商共享相同的本地路径前缀，只有一个可以启用。
          </div>
        </CardBody>
      </Card>

      {/* 新增供应商模态框 */}
      <Modal isOpen={isAddModalOpen} onClose={handleCloseAddModal} size="2xl">
        <ModalContent>
          <ModalHeader>添加供应商</ModalHeader>
          <ModalBody className="space-y-4">
            <Input
              label="名称"
              placeholder="例如：Claude Official"
              value={newSupplier.name}
              onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })}
              isRequired
              radius="lg"
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">本地路径前缀</label>
              <Select
                placeholder="选择常用前缀或自定义"
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
                classNames={{
                  trigger: 'shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
                }}
              >
                <>
                  {COMMON_PREFIX_OPTIONS.map(option => (
                    <SelectItem key={option.prefix} textValue={option.label}>
                      <div className="flex items-center gap-2">
                        <span>{option.color}</span>
                        <span>{option.label}</span>
                        <span className="text-xs text-gray-500">({option.description})</span>
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
                startContent={<span className="text-gray-400">{selectedPrefixOption !== 'custom' ? getPrefixColor(newSupplier.localPrefix) : '🔹'}</span>}
                classNames={{
                  inputWrapper: 'shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
                }}
              />
            </div>

            <Input
              label="上游地址"
              placeholder="https://api.example.com"
              value={newSupplier.baseUrl}
              onChange={e => setNewSupplier({ ...newSupplier, baseUrl: e.target.value })}
              isRequired
              radius="lg"
              classNames={{
                inputWrapper: 'shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
              }}
            />

            <div className="flex items-center gap-2">
              <Switch
                isSelected={newSupplier.enabled}
                onValueChange={enabled => setNewSupplier({ ...newSupplier, enabled })}
                size="sm"
              >
                <span className="text-sm">启用此供应商</span>
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
            >
              {createMutation.isPending ? '创建中...' : '创建'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 编辑供应商模态框 */}
      <Modal isOpen={isEditModalOpen} onClose={handleCloseEditModal} size="2xl">
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
                  startContent={<span className="text-gray-400">{getPrefixColor(editingSupplier.localPrefix)}</span>}
                  classNames={{
                    inputWrapper: 'shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
                  }}
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
                  classNames={{
                    inputWrapper: 'shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
                  }}
                />

                <div className="flex items-center gap-2">
                  <Switch
                    isSelected={editingSupplier.enabled}
                    onValueChange={enabled =>
                      setEditingSupplier({ ...editingSupplier, enabled })
                    }
                    size="sm"
                  >
                    <span className="text-sm">启用此供应商</span>
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
            >
              {updateMutation.isPending ? '更新中...' : '更新'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
