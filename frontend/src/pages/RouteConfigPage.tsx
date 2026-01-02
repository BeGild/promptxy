/**
 * 路由配置页面
 * 配置本地服务到供应商的路由，自动选择转换器
 */

import React, { useState, useEffect, useCallback } from 'react';
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
import { ArrowRight, Plus, Trash2, Info, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useSuppliers } from '@/hooks';
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
  { key: 'anthropic', label: 'Anthropic', description: 'Anthropic/Claude 协议' },
  { key: 'openai', label: 'OpenAI', description: 'OpenAI 协议' },
  { key: 'gemini', label: 'Gemini', description: 'Google Gemini 协议' },
  { key: 'none', label: '无转换', description: '直接转发，不进行协议转换' },
];

// 支持的转换器组合
// key: "本地协议->供应商协议"
const SUPPORTED_TRANSFORMERS: Record<string, TransformerType[]> = {
  'anthropic->anthropic': ['none'],
  'anthropic->openai': ['openai'],
  'anthropic->gemini': ['gemini'],
  'openai->anthropic': ['anthropic'],
  'openai->openai': ['none'],
  'openai->gemini': ['gemini'],
  'gemini->anthropic': ['anthropic'],
  'gemini->openai': ['openai'],
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
  const [newRoute, setNewRoute] = useState<Partial<Route>>({
    localService: 'claude',
    supplierId: '',
    transformer: 'none',
    enabled: true,
  });

  const suppliers = suppliersData?.suppliers || [];

  // 从 suppliers 转换为 routes（临时实现，实际应该从 API 获取）
  useEffect(() => {
    // 这里应该是从路由 API 获取数据
    // 暂时使用 suppliers 数据模拟
    // TODO: 替换为真实的路由 API 调用
  }, [suppliersData]);

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

    try {
      // TODO: 调用路由 API 创建路由
      // await createRouteMutation.mutateAsync({ route: newRoute as Omit<Route, 'id'> });

      setIsAddModalOpen(false);
      setNewRoute({
        localService: 'claude',
        supplierId: '',
        transformer: 'none',
        enabled: true,
      });

      toast.success('路由配置已添加！');
    } catch (error: any) {
      toast.error(`添加失败: ${error?.message || '未知错误'}`);
    }
  };

  // 删除路由
  const handleDeleteRoute = async (routeId: string) => {
    try {
      // TODO: 调用路由 API 删除路由
      // await deleteRouteMutation.mutateAsync(routeId);

      setRoutes(prev => prev.filter(r => r.id !== routeId));
      toast.success('路由配置已删除！');
    } catch (error: any) {
      toast.error(`删除失败: ${error?.message || '未知错误'}`);
    }
  };

  // 切换路由状态
  const handleToggleRoute = async (route: Route) => {
    try {
      // TODO: 调用路由 API 更新路由
      // await updateRouteMutation.mutateAsync({
      //   routeId: route.id,
      //   request: { route: { enabled: !route.enabled } },
      // });

      setRoutes(prev =>
        prev.map(r => (r.id === route.id ? { ...r, enabled: !r.enabled } : r)),
      );
      toast.success('路由状态已更新！');
    } catch (error: any) {
      toast.error(`更新失败: ${error?.message || '未知错误'}`);
    }
  };

  // 更新路由
  const handleUpdateRoute = async (route: Route, field: keyof Route, value: any) => {
    try {
      // TODO: 调用路由 API 更新路由
      // await updateRouteMutation.mutateAsync({
      //   routeId: route.id,
      //   request: { route: { [field]: value } },
      // });

      setRoutes(prev => prev.map(r => (r.id === route.id ? { ...r, [field]: value } : r)));
      toast.success('路由配置已更新！');
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
              <CardBody className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* 三列拼接 */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 本地服务 */}
                    <div>
                      <label className="text-xs text-secondary mb-2 block">本地服务</label>
                      <div className="flex items-center gap-2 p-3 bg-canvas dark:bg-secondary/50 rounded-lg">
                        <span className="text-2xl">{localService?.icon}</span>
                        <div>
                          <div className="font-medium text-primary">
                            {localService?.label}
                          </div>
                          <div className="text-xs text-tertiary">
                            {localService?.prefix}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 箭头 */}
                    <div className="hidden md:flex items-center justify-center">
                      <ArrowRight size={20} className="text-tertiary" />
                    </div>

                    {/* 转换器 */}
                    <div>
                      <label className="text-xs text-secondary mb-2 block">转换器</label>
                      <div className="flex items-center gap-2 p-3 bg-brand-primary/10 dark:bg-brand-primary/20 rounded-lg">
                        <CheckCircle2 size={20} className="text-brand-primary" />
                        <div>
                          <div className="font-medium text-primary">
                            {transformer?.label}
                          </div>
                          <div className="text-xs text-tertiary">
                            {transformer?.description}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 箭头 */}
                    <div className="hidden md:flex items-center justify-center">
                      <ArrowRight size={20} className="text-tertiary" />
                    </div>

                    {/* 上游供应商 */}
                    <div>
                      <label className="text-xs text-secondary mb-2 block">上游供应商</label>
                      <div className="flex items-center gap-2 p-3 bg-canvas dark:bg-secondary/50 rounded-lg">
                        <div>
                          <div className="font-medium text-primary">
                            {supplier?.displayName || supplier?.name}
                          </div>
                          <div className="text-xs text-tertiary">
                            {supplier?.protocol}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2 md:border-l md:border-subtle md:pl-4">
                    <Switch
                      isSelected={route.enabled}
                      onValueChange={() => handleToggleRoute(route)}
                      size="sm"
                    >
                      <span className="text-sm text-secondary">
                        {route.enabled ? '已启用' : '已禁用'}
                      </span>
                    </Switch>

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

                {/* 路由说明 */}
                {localService && supplier && transformer && (
                  <div className="mt-4 p-3 bg-canvas dark:bg-secondary/50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info size={16} className="text-brand-primary shrink-0 mt-0.5" />
                      <div className="text-xs text-secondary">
                        <p>
                          <span className="font-medium text-primary">
                            {localService.icon} {localService.label}
                          </span>
                          {' '}请求将通过{' '}
                          <span className="font-medium text-primary">
                            {transformer.label}
                          </span>
                          {' '}转换器转发到{' '}
                          <span className="font-medium text-primary">
                            {supplier.displayName || supplier.name}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
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
                    setNewRoute(prev => ({ ...prev, localService: key }));
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
                    setNewRoute(prev => ({ ...prev, supplierId: key }));
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
    </div>
  );
};