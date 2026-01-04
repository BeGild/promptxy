/**
 * 路由配置页面
 * 配置本地服务到供应商的路由，自动选择转换器
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardBody,
  Button,
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
import { ArrowRight, Plus, Trash2, Info, AlertCircle, CheckCircle2, Edit2 } from 'lucide-react';
import { useSuppliers } from '@/hooks';
import { fetchRoutes, createRoute, deleteRoute, toggleRoute, updateRoute } from '@/api/config';
import type { Supplier, LocalService, TransformerType, Route } from '@/types/api';

// 本地服务选项
const LOCAL_SERVICES: Array<{
  key: LocalService;
  label: string;
  prefix: string;
  protocol: 'anthropic' | 'openai' | 'gemini';
  color: string;
  icon: string;
}> = [
  {
    key: 'claude',
    label: 'Claude',
    prefix: '/claude',
    protocol: 'anthropic',
    color: '🟣',
    icon: '🤖',
  },
  {
    key: 'codex',
    label: 'Codex',
    prefix: '/codex',
    protocol: 'openai',
    color: '🟢',
    icon: '🧠',
  },
  {
    key: 'gemini',
    label: 'Gemini',
    prefix: '/gemini',
    protocol: 'gemini',
    color: '🔵',
    icon: '💎',
  },
];

// 转换器选项
const TRANSFORMER_OPTIONS: Array<{
  key: TransformerType;
  label: string;
  description: string;
}> = [
  { key: 'anthropic', label: 'Anthropic', description: 'Anthropic/Claude 协议（仅占位）' },
  { key: 'codex', label: 'Codex', description: 'Codex Responses 协议（/responses）' },
  { key: 'gemini', label: 'Gemini', description: 'Google Gemini 协议' },
  { key: 'none', label: '无转换', description: '直接转发，不进行协议转换' },
];

// 支持的转换器组合
// key: "本地协议->供应商协议"
const SUPPORTED_TRANSFORMERS: Record<string, TransformerType[]> = {
  // Claude 入口：允许跨协议（通过转换器）
  'anthropic->anthropic': ['none'],
  'anthropic->openai': ['codex'],
  'anthropic->gemini': ['gemini'],

  // Codex/Gemini 入口：仅透明转发
  'openai->openai': ['none'],
  'gemini->gemini': ['none'],
};

// 根据本地服务和供应商协议自动选择转换器
const autoSelectTransformer = (
  localProtocol: 'anthropic' | 'openai' | 'gemini',
  supplierProtocol: 'anthropic' | 'openai' | 'gemini',
): TransformerType => {
  const key = `${localProtocol}->${supplierProtocol}`;
  const transformers = SUPPORTED_TRANSFORMERS[key];

  if (!transformers || transformers.length === 0) {
    return 'none'; // 默认值，理论上不应该到这里
  }

  return transformers[0];
};

// 检查是否支持转换
const isTransformationSupported = (
  localProtocol: 'anthropic' | 'openai' | 'gemini',
  supplierProtocol: 'anthropic' | 'openai' | 'gemini',
): boolean => {
  const key = `${localProtocol}->${supplierProtocol}`;
  return !!SUPPORTED_TRANSFORMERS[key];
};

export const RouteConfigPage: React.FC = () => {
  const { data: suppliersData, isLoading } = useSuppliers();

  const [routes, setRoutes] = useState<Route[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [newRoute, setNewRoute] = useState<Partial<Route>>({
    localService: 'claude',
    supplierId: '',
    transformer: 'none',
    claudeModelMap: undefined,
    enabled: true,
  });
  const [editRoute, setEditRoute] = useState<Partial<Route>>({});

  const suppliers = suppliersData?.suppliers || [];

  // 从 API 获取路由列表
  useEffect(() => {
    const loadRoutes = async () => {
      try {
        const response = await fetchRoutes();
        if (response.success) {
          setRoutes(response.routes);
        }
      } catch (error: any) {
        console.error('获取路由列表失败:', error);
        toast.error(`获取路由列表失败: ${error?.message || '未知错误'}`);
      }
    };
    loadRoutes();
  }, []);

  // 自动选择转换器
  useEffect(() => {
    if (newRoute.localService && newRoute.supplierId) {
      const localService = LOCAL_SERVICES.find(s => s.key === newRoute.localService);
      const supplier = suppliers.find(s => s.id === newRoute.supplierId);

      if (localService && supplier) {
        const transformer = autoSelectTransformer(localService.protocol, supplier.protocol);
        setNewRoute(prev => ({ ...prev, transformer }));
      }
    }
  }, [newRoute.localService, newRoute.supplierId, suppliers]);

  // 添加新路由
  const handleAddRoute = async () => {
    if (!newRoute.localService || !newRoute.supplierId) {
      toast.error('请选择本地服务和供应商');
      return;
    }

    const localService = LOCAL_SERVICES.find(s => s.key === newRoute.localService);
    const supplier = suppliers.find(s => s.id === newRoute.supplierId);

    if (!localService || !supplier) {
      toast.error('无效的本地服务或供应商');
      return;
    }

    // 检查是否支持转换
    if (!isTransformationSupported(localService.protocol, supplier.protocol)) {
      toast.error(`不支持从 ${localService.label} 转换到 ${supplier.displayName}`);
      return;
    }

    // Claude 跨协议：sonnet 映射必填（haiku/opus 可选，默认同 sonnet）
    if (newRoute.localService === 'claude' && supplier.protocol !== 'anthropic') {
      const sonnet = (newRoute as any).claudeModelMap?.sonnet;
      if (!sonnet) {
        toast.error('Claude 跨协议路由必须配置 sonnet 模型映射');
        return;
      }
    }

    try {
      // 调用路由 API 创建路由
      const response = await createRoute({
        route: newRoute as Omit<Route, 'id'>,
      });

      if (response.success) {
        // 重新加载路由列表
        const routesResponse = await fetchRoutes();
        if (routesResponse.success) {
          setRoutes(routesResponse.routes);
        }

        setIsAddModalOpen(false);
        setNewRoute({
          localService: 'claude',
          supplierId: '',
          transformer: 'none',
          claudeModelMap: undefined,
          enabled: true,
        });

        toast.success('路由配置已添加！');
      } else {
        toast.error(`添加失败: ${response.message || '未知错误'}`);
      }
    } catch (error: any) {
      toast.error(`添加失败: ${error?.message || '未知错误'}`);
    }
  };

  // 删除路由
  const handleDeleteRoute = async (routeId: string) => {
    try {
      const response = await deleteRoute(routeId);

      if (response.success) {
        // 重新加载路由列表
        const routesResponse = await fetchRoutes();
        if (routesResponse.success) {
          setRoutes(routesResponse.routes);
        }
        toast.success('路由配置已删除！');
      } else {
        toast.error(`删除失败: ${response.message || '未知错误'}`);
      }
    } catch (error: any) {
      toast.error(`删除失败: ${error?.message || '未知错误'}`);
    }
  };

  // 切换路由状态
  const handleToggleRoute = async (route: Route) => {
    try {
      const response = await toggleRoute(route.id, { enabled: !route.enabled });

      if (response.success) {
        // 重新加载路由列表
        const routesResponse = await fetchRoutes();
        if (routesResponse.success) {
          setRoutes(routesResponse.routes);
        }
        toast.success('路由状态已更新！');
      } else {
        toast.error(`更新失败: ${response.message || '未知错误'}`);
      }
    } catch (error: any) {
      toast.error(`更新失败: ${error?.message || '未知错误'}`);
    }
  };

  // 更新路由
  const handleUpdateRoute = async (route: Route, field: keyof Route, value: any) => {
    try {
      const response = await updateRoute({
        routeId: route.id,
        route: { [field]: value },
      });

      if (response.success) {
        // 重新加载路由列表
        const routesResponse = await fetchRoutes();
        if (routesResponse.success) {
          setRoutes(routesResponse.routes);
        }
        toast.success('路由配置已更新！');
      } else {
        toast.error(`更新失败: ${response.message || '未知错误'}`);
      }
    } catch (error: any) {
      toast.error(`更新失败: ${error?.message || '未知错误'}`);
    }
  };

  const handleOpenEditModal = (route: Route) => {
    setEditingRoute(route);
    setEditRoute({ ...route });
    setIsEditModalOpen(true);
  };

  const handleSaveEditRoute = async () => {
    if (!editingRoute) return;

    const supplierId = editRoute.supplierId || editingRoute.supplierId;
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) {
      toast.error('无效的供应商');
      return;
    }

    if (editingRoute.localService === 'claude' && supplier.protocol !== 'anthropic') {
      const sonnet = (editRoute as any).claudeModelMap?.sonnet ?? (editingRoute as any).claudeModelMap?.sonnet;
      if (!sonnet) {
        toast.error('Claude 跨协议路由必须配置 sonnet 模型映射');
        return;
      }
    }

    try {
      const response = await updateRoute({
        routeId: editingRoute.id,
        route: {
          supplierId,
          claudeModelMap: (editRoute as any).claudeModelMap,
        } as any,
      });

      if (response.success) {
        const routesResponse = await fetchRoutes();
        if (routesResponse.success) {
          setRoutes(routesResponse.routes);
        }
        toast.success('路由配置已更新！');
        setIsEditModalOpen(false);
        setEditingRoute(null);
        setEditRoute({});
      } else {
        toast.error(`更新失败: ${response.message || '未知错误'}`);
      }
    } catch (error: any) {
      toast.error(`更新失败: ${error?.message || '未知错误'}`);
    }
  };

  // 获取可用的供应商（根据本地服务过滤）
  const getAvailableSuppliers = (localServiceKey: LocalService): Supplier[] => {
    const localService = LOCAL_SERVICES.find(s => s.key === localServiceKey);
    if (!localService) return [];

    return suppliers.filter(supplier =>
      isTransformationSupported(localService.protocol, supplier.protocol),
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary mb-2">
          路由配置
        </h1>
        <p className="text-secondary text-sm">
          配置本地服务到供应商的路由，系统会自动选择合适的转换器
        </p>
      </div>

      {/* 添加新路由按钮 */}
      <div className="mb-6">
        <Button
          color="primary"
          onPress={() => setIsAddModalOpen(true)}
          startContent={<Plus size={18} />}
          className="shadow-md"
          isDisabled={suppliers.length === 0}
        >
          添加新路由
        </Button>
        {suppliers.length === 0 && (
          <p className="text-xs text-tertiary mt-2">
            请先在供应商管理页面添加供应商
          </p>
        )}
      </div>

      {/* 路由配置列表 */}
      <div className="space-y-4">
        {routes.map(route => {
          const localService = LOCAL_SERVICES.find(s => s.key === route.localService);
          const supplier = suppliers.find(s => s.id === route.supplierId);
          const transformer = TRANSFORMER_OPTIONS.find(t => t.key === route.transformer);

          return (
            <Card
              key={route.id}
              className={`border transition-all ${
                route.enabled
                  ? 'border-brand-primary/30 dark:border-brand-primary/20 bg-elevated'
                  : 'border-subtle opacity-60'
              }`}
            >
              <CardBody className="px-4 py-3">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  {/* 左侧：一行路由（避免换行炸裂） */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">{localService?.icon}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-primary">
                          {localService?.label}
                        </div>
                        <div className="text-xs text-tertiary font-mono">
                          {localService?.prefix}
                        </div>
                      </div>
                    </div>

                    <ArrowRight size={18} className="text-tertiary shrink-0" />

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-primary truncate">
                        {supplier?.displayName || supplier?.name || '未选择供应商'}
                      </div>
                      <div className="text-xs text-tertiary truncate">
                        {supplier?.baseUrl || supplier?.protocol || ''}
                      </div>
                    </div>
                  </div>

                  {/* 中间：转换器（紧凑 chip） */}
                  <Chip
                    size="sm"
                    color={route.enabled ? 'primary' : 'default'}
                    variant="flat"
                    className="h-6"
                    classNames={{
                      base: 'min-w-0',
                      content: 'px-2 text-xs min-w-0 truncate',
                    }}
                    title={transformer?.description}
                  >
                    {transformer?.label || route.transformer}
                  </Chip>

                  {/* 右侧：开关与删除 */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      isIconOnly
                      variant="light"
                      onPress={() => handleOpenEditModal(route)}
                      size="sm"
                      title="编辑路由"
                    >
                      <Edit2 size={16} />
                    </Button>
                    <Switch
                      isSelected={route.enabled}
                      onValueChange={() => handleToggleRoute(route)}
                      size="sm"
                      aria-label="启用路由"
                    />
                    <Button
                      isIconOnly
                      color="danger"
                      variant="light"
                      onPress={() => handleDeleteRoute(route.id)}
                      size="sm"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}

        {routes.length === 0 && (
          <Card className="border border-dashed border-subtle">
            <CardBody className="py-12 text-center">
              <div className="text-4xl mb-3">🚗</div>
              <p className="text-secondary font-medium">暂无路由配置</p>
              <p className="text-sm text-tertiary mt-1">
                {suppliers.length === 0
                  ? '请先在供应商管理页面添加供应商'
                  : '点击上方按钮添加新的路由配置'}
              </p>
            </CardBody>
          </Card>
        )}
      </div>

      {/* 添加路由弹窗 */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        size="2xl"
        backdrop="blur"
        placement="center"
      >
        <ModalContent>
          <ModalHeader>添加新路由</ModalHeader>
          <ModalBody className="space-y-4">
            <div className="p-4 bg-brand-primary/10 dark:bg-brand-primary/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Info size={16} className="text-brand-primary shrink-0 mt-0.5" />
                <p className="text-xs text-secondary">
                  选择本地服务和供应商，系统会自动选择合适的转换器。只有支持转换的组合才会显示在供应商列表中。
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 本地服务 */}
              <div>
                <label className="text-sm font-medium text-primary mb-2 block">
                  本地服务 *
                </label>
                <Select
                  selectedKeys={[newRoute.localService || '']}
                  onSelectionChange={keys => {
                    const key = Array.from(keys)[0] as LocalService;
                    setNewRoute(prev => ({
                      ...prev,
                      localService: key,
                      supplierId: '',
                      claudeModelMap: undefined,
                    }));
                  }}
                  radius="lg"
                  variant="bordered"
                >
                  {LOCAL_SERVICES.map(service => (
                    <SelectItem key={service.key} textValue={service.label}>
                      <div className="flex items-center gap-2">
                        <span>{service.icon}</span>
                        <div>
                          <div>{service.label}</div>
                          <div className="text-xs text-tertiary">{service.prefix}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </Select>
              </div>

              {/* 箭头 */}
              <div className="hidden md:flex items-center justify-center pt-6">
                <ArrowRight size={24} className="text-tertiary" />
              </div>

              {/* 上游供应商 */}
              <div>
                <label className="text-sm font-medium text-primary mb-2 block">
                  上游供应商 *
                </label>
                <Select
                  selectedKeys={[newRoute.supplierId || '']}
                  onSelectionChange={keys => {
                    const key = Array.from(keys)[0] as string;
                    setNewRoute(prev => ({ ...prev, supplierId: key, claudeModelMap: undefined }));
                  }}
                  radius="lg"
                  variant="bordered"
                  isDisabled={!newRoute.localService}
                >
                  {(() => {
                    const availableSuppliers = getAvailableSuppliers(newRoute.localService as LocalService);
                    const items = availableSuppliers.map(supplier => {
                      const protocol = LOCAL_SERVICES.find(s => s.protocol === supplier.protocol);
                      return (
                        <SelectItem key={supplier.id} textValue={supplier.displayName}>
                          <div className="flex items-center gap-2">
                            <span>{protocol?.icon}</span>
                            <div>
                              <div>{supplier.displayName}</div>
                              <div className="text-xs text-tertiary">{supplier.protocol}</div>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    });

                    if (availableSuppliers.length === 0 && newRoute.localService) {
                      items.push(
                        <SelectItem key="none" textValue="无可用供应商" isDisabled>
                          无可用供应商
                        </SelectItem>
                      );
                    }

                    return items;
                  })()}
                </Select>
                {newRoute.localService &&
                  getAvailableSuppliers(newRoute.localService as LocalService).length === 0 && (
                    <p className="text-xs text-danger mt-1">
                      该本地服务暂无支持的供应商
                    </p>
                  )}
              </div>
            </div>

            {/* Claude 模型映射（仅 claude 且跨协议） */}
            {newRoute.localService === 'claude' && newRoute.supplierId && (() => {
              const supplier = suppliers.find(s => s.id === newRoute.supplierId);
              if (!supplier) return null;
              if (supplier.protocol === 'anthropic') return null;
              const models = supplier.supportedModels || [];
              const modelItems = models.map(m => ({ key: m, label: m }));
              const modelItemsWithDefault = [{ key: '__default__', label: '默认同 sonnet' }, ...modelItems];
              return (
                <div className="space-y-3">
                  <Divider />
                  <div className="text-sm font-medium text-primary">Claude 模型映射</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-primary mb-2 block">sonnet *</label>
                      <Select
                        selectedKeys={[((newRoute as any).claudeModelMap?.sonnet as string) || '']}
                        onSelectionChange={keys => {
                          const key = Array.from(keys)[0] as string;
                          setNewRoute(prev => ({
                            ...prev,
                            claudeModelMap: { ...(prev as any).claudeModelMap, sonnet: key },
                          }));
                        }}
                        radius="lg"
                        variant="bordered"
                        items={modelItems}
                      >
                        {(item: any) => (
                          <SelectItem key={item.key} textValue={item.label}>
                            {item.label}
                          </SelectItem>
                        )}
                      </Select>
                      <p className="text-xs text-tertiary mt-1">识别不到档位默认使用 sonnet</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-primary mb-2 block">haiku</label>
                      <Select
                        selectedKeys={[((newRoute as any).claudeModelMap?.haiku as string) || '__default__']}
                        onSelectionChange={keys => {
                          const key = Array.from(keys)[0] as string;
                          setNewRoute(prev => ({
                            ...prev,
                            claudeModelMap: {
                              ...(prev as any).claudeModelMap,
                              haiku: key === '__default__' ? undefined : key,
                            },
                          }));
                        }}
                        radius="lg"
                        variant="bordered"
                        items={modelItemsWithDefault}
                      >
                        {(item: any) => (
                          <SelectItem key={item.key} textValue={item.label}>
                            {item.label}
                          </SelectItem>
                        )}
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-primary mb-2 block">opus</label>
                      <Select
                        selectedKeys={[((newRoute as any).claudeModelMap?.opus as string) || '__default__']}
                        onSelectionChange={keys => {
                          const key = Array.from(keys)[0] as string;
                          setNewRoute(prev => ({
                            ...prev,
                            claudeModelMap: {
                              ...(prev as any).claudeModelMap,
                              opus: key === '__default__' ? undefined : key,
                            },
                          }));
                        }}
                        radius="lg"
                        variant="bordered"
                        items={modelItemsWithDefault}
                      >
                        {(item: any) => (
                          <SelectItem key={item.key} textValue={item.label}>
                            {item.label}
                          </SelectItem>
                        )}
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-tertiary">
                    haiku/opus 未配置时默认同 sonnet
                  </p>
                </div>
              );
            })()}

            {/* 自动选择的转换器 */}
            {newRoute.localService && newRoute.supplierId && (
              <div className="p-4 bg-canvas dark:bg-secondary/50 rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-brand-primary shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-primary mb-1">
                      自动选择的转换器
                    </div>
                    <div className="text-xs text-secondary">
                      {(() => {
                        const transformer = TRANSFORMER_OPTIONS.find(
                          t => t.key === newRoute.transformer,
                        );
                        return transformer?.label || '无转换';
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setIsAddModalOpen(false)}>
              取消
            </Button>
            <Button
              color="primary"
              onPress={handleAddRoute}
              className="shadow-md"
              isDisabled={!newRoute.localService || !newRoute.supplierId}
            >
              添加路由
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 编辑路由弹窗（用于配置 Claude 模型映射） */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        size="2xl"
        backdrop="blur"
        placement="center"
      >
        <ModalContent>
          <ModalHeader>编辑路由</ModalHeader>
          <ModalBody className="space-y-4">
            {!editingRoute ? (
              <p className="text-sm text-tertiary">未选择路由</p>
            ) : (
              <>
                <div className="p-4 bg-brand-primary/10 dark:bg-brand-primary/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info size={16} className="text-brand-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-secondary">
                      编辑供应商与 Claude 模型映射；转换器由系统自动选择。
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-primary mb-2 block">本地服务</label>
                    <Select selectedKeys={[editingRoute.localService]} isDisabled radius="lg" variant="bordered">
                      {LOCAL_SERVICES.map(service => (
                        <SelectItem key={service.key} textValue={service.label}>
                          {service.label}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>

                  <div className="hidden md:flex items-center justify-center pt-6">
                    <ArrowRight size={24} className="text-tertiary" />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-primary mb-2 block">上游供应商 *</label>
                    <Select
                      selectedKeys={[editRoute.supplierId || editingRoute.supplierId]}
                      onSelectionChange={keys => {
                        const key = Array.from(keys)[0] as string;
                        setEditRoute(prev => ({ ...prev, supplierId: key, claudeModelMap: undefined }));
                      }}
                      radius="lg"
                      variant="bordered"
                    >
                      {getAvailableSuppliers(editingRoute.localService).map(supplier => (
                        <SelectItem key={supplier.id} textValue={supplier.displayName}>
                          {supplier.displayName}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                </div>

                {editingRoute.localService === 'claude' && (() => {
                  const supplier = suppliers.find(s => s.id === (editRoute.supplierId || editingRoute.supplierId));
                  if (!supplier) return null;
                  if (supplier.protocol === 'anthropic') return null;
                  const models = supplier.supportedModels || [];
                  const modelItems = models.map(m => ({ key: m, label: m }));
                  const modelItemsWithDefault = [{ key: '__default__', label: '默认同 sonnet' }, ...modelItems];
                  const effectiveMap = (editRoute as any).claudeModelMap || (editingRoute as any).claudeModelMap || {};
                  return (
                    <div className="space-y-3">
                      <Divider />
                      <div className="text-sm font-medium text-primary">Claude 模型映射</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-sm font-medium text-primary mb-2 block">sonnet *</label>
                          <Select
                            selectedKeys={[effectiveMap.sonnet || '']}
                            onSelectionChange={keys => {
                              const key = Array.from(keys)[0] as string;
                              setEditRoute(prev => ({
                                ...prev,
                                claudeModelMap: { ...(prev as any).claudeModelMap, sonnet: key },
                              }));
                            }}
                            radius="lg"
                            variant="bordered"
                            items={modelItems}
                          >
                            {(item: any) => (
                              <SelectItem key={item.key} textValue={item.label}>
                                {item.label}
                              </SelectItem>
                            )}
                          </Select>
                        </div>

                        <div>
                          <label className="text-sm font-medium text-primary mb-2 block">haiku</label>
                          <Select
                            selectedKeys={[effectiveMap.haiku || '__default__']}
                            onSelectionChange={keys => {
                              const key = Array.from(keys)[0] as string;
                              setEditRoute(prev => ({
                                ...prev,
                                claudeModelMap: {
                                  ...(prev as any).claudeModelMap,
                                  haiku: key === '__default__' ? undefined : key,
                                },
                              }));
                            }}
                            radius="lg"
                            variant="bordered"
                            items={modelItemsWithDefault}
                          >
                            {(item: any) => (
                              <SelectItem key={item.key} textValue={item.label}>
                                {item.label}
                              </SelectItem>
                            )}
                          </Select>
                        </div>

                        <div>
                          <label className="text-sm font-medium text-primary mb-2 block">opus</label>
                          <Select
                            selectedKeys={[effectiveMap.opus || '__default__']}
                            onSelectionChange={keys => {
                              const key = Array.from(keys)[0] as string;
                              setEditRoute(prev => ({
                                ...prev,
                                claudeModelMap: {
                                  ...(prev as any).claudeModelMap,
                                  opus: key === '__default__' ? undefined : key,
                                },
                              }));
                            }}
                            radius="lg"
                            variant="bordered"
                            items={modelItemsWithDefault}
                          >
                            {(item: any) => (
                              <SelectItem key={item.key} textValue={item.label}>
                                {item.label}
                              </SelectItem>
                            )}
                          </Select>
                        </div>
                      </div>
                      <p className="text-xs text-tertiary">haiku/opus 未配置时默认同 sonnet；识别不到档位时按 sonnet</p>
                    </div>
                  );
                })()}
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setIsEditModalOpen(false)}>
              取消
            </Button>
            <Button color="primary" onPress={handleSaveEditRoute} className="shadow-md" isDisabled={!editingRoute}>
              保存
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
