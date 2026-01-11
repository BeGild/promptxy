/**
 * 路由配置页面
 * 配置本地服务到供应商的路由，支持模型映射
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
  Input,
} from '@heroui/react';
import { ArrowRight, Plus, Trash2, Info, Edit2 } from 'lucide-react';
import { useSuppliers } from '@/hooks';
import { AnthropicIcon, OpenAIIcon, GeminiIcon } from '@/components/icons/SupplierIcons';
import { fetchRoutes, createRoute, deleteRoute, toggleRoute, updateRoute } from '@/api/config';
import type { Supplier, LocalService, TransformerType, Route, ModelMapping, ModelMappingRule } from '@/types/api';

// 本地服务选项
const LOCAL_SERVICES: Array<{
  key: LocalService;
  label: string;
  prefix: string;
  protocol: 'anthropic' | 'openai' | 'gemini';
  color: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  {
    key: 'claude',
    label: 'Claude',
    prefix: '/claude',
    protocol: 'anthropic',
    color: '#D4935D',
    icon: AnthropicIcon,
  },
  {
    key: 'codex',
    label: 'Codex',
    prefix: '/codex',
    protocol: 'openai',
    color: '#10A37F',
    icon: OpenAIIcon,
  },
  {
    key: 'gemini',
    label: 'Gemini',
    prefix: '/gemini',
    protocol: 'gemini',
    color: '#4285F4',
    icon: GeminiIcon,
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
const SUPPORTED_TRANSFORMERS: Record<string, TransformerType[]> = {
  'anthropic->anthropic': ['none'],
  'anthropic->openai': ['codex'],
  'anthropic->gemini': ['gemini'],
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
  return transformers?.[0] || 'none';
};

// 检查是否支持转换
const isTransformationSupported = (
  localProtocol: 'anthropic' | 'openai' | 'gemini',
  supplierProtocol: 'anthropic' | 'openai' | 'gemini',
): boolean => {
  const key = `${localProtocol}->${supplierProtocol}`;
  return !!SUPPORTED_TRANSFORMERS[key];
};

// 生成唯一 ID
const generateId = () => `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
    modelMapping: undefined,
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

    try {
      const response = await createRoute({
        route: newRoute as Omit<Route, 'id'>,
      });

      if (response.success) {
        const routesResponse = await fetchRoutes();
        if (routesResponse.success) {
          setRoutes(routesResponse.routes);
        }

        setIsAddModalOpen(false);
        setNewRoute({
          localService: 'claude',
          supplierId: '',
          transformer: 'none',
          modelMapping: undefined,
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

  const handleOpenEditModal = (route: Route) => {
    setEditingRoute(route);
    setEditRoute({ ...route });
    setIsEditModalOpen(true);
  };

  const handleSaveEditRoute = async () => {
    if (!editingRoute) return;

    try {
      const response = await updateRoute({
        routeId: editingRoute.id,
        route: {
          supplierId: editRoute.supplierId,
          modelMapping: editRoute.modelMapping,
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

  // 模型映射编辑器组件
  const ModelMappingEditor: React.FC<{
    value: ModelMapping | undefined;
    onChange: (value: ModelMapping | undefined) => void;
    availableModels: string[];
  }> = ({ value, onChange, availableModels }) => {
    const mapping = value || { enabled: false, rules: [] };

    const handleToggleEnabled = (enabled: boolean) => {
      onChange({ ...mapping, enabled });
    };

    const handleAddRule = () => {
      const newRule: ModelMappingRule = {
        id: generateId(),
        pattern: '',
        target: availableModels[0] || '',
        description: '',
      };
      onChange({ ...mapping, rules: [...mapping.rules, newRule] });
    };

    const handleUpdateRule = (index: number, field: keyof ModelMappingRule, val: string) => {
      const newRules = [...mapping.rules];
      newRules[index] = { ...newRules[index], [field]: val };
      onChange({ ...mapping, rules: newRules });
    };

    const handleDeleteRule = (index: number) => {
      const newRules = mapping.rules.filter((_, i) => i !== index);
      onChange({ ...mapping, rules: newRules });
    };

    return (
      <div className="space-y-3">
        <Divider />
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-primary">模型映射</div>
          <Switch
            size="sm"
            isSelected={mapping.enabled}
            onValueChange={handleToggleEnabled}
          >
            启用
          </Switch>
        </div>

        {mapping.enabled && (
          <>
            <div className="space-y-2">
              {mapping.rules.map((rule, index) => (
                <div key={rule.id} className="p-3 bg-canvas dark:bg-secondary/30 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      size="sm"
                      label="匹配模式"
                      placeholder="如: claude-*-sonnet-*"
                      value={rule.pattern}
                      onValueChange={val => handleUpdateRule(index, 'pattern', val)}
                      variant="bordered"
                      className="flex-1"
                    />
                    <ArrowRight size={16} className="text-tertiary shrink-0" />
                    <Select
                      size="sm"
                      label="目标模型"
                      selectedKeys={[rule.target]}
                      onSelectionChange={keys => {
                        const key = Array.from(keys)[0] as string;
                        handleUpdateRule(index, 'target', key);
                      }}
                      variant="bordered"
                      className="flex-1"
                    >
                      {availableModels.map(model => (
                        <SelectItem key={model} textValue={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </Select>
                    <Button
                      isIconOnly
                      size="sm"
                      color="danger"
                      variant="light"
                      onPress={() => handleDeleteRule(index)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  <Input
                    size="sm"
                    placeholder="描述（可选）"
                    value={rule.description || ''}
                    onValueChange={val => handleUpdateRule(index, 'description', val)}
                    variant="bordered"
                  />
                </div>
              ))}
            </div>

            <Button
              size="sm"
              variant="flat"
              onPress={handleAddRule}
              startContent={<Plus size={16} />}
              isDisabled={availableModels.length === 0}
            >
              添加映射规则
            </Button>

            <p className="text-xs text-tertiary">
              💡 规则按顺序匹配，首个命中的生效；未匹配任何规则时原样透传
            </p>
          </>
        )}
      </div>
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
          配置本地服务到供应商的路由，支持灵活的模型映射
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
                  {/* 左侧：路由 */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 flex items-center justify-center" style={{ backgroundColor: `${localService?.color}15` }}>
                        {localService && <localService.icon size={20} />}
                      </div>
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

                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {supplier && (() => {
                        const protocol = LOCAL_SERVICES.find(s => s.protocol === supplier.protocol);
                        const IconComponent = protocol?.icon;
                        const color = protocol?.color || '#888';
                        return (
                          <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15` }}>
                            {IconComponent && <IconComponent size={20} />}
                          </div>
                        );
                      })()}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-primary truncate">
                          {supplier?.displayName || supplier?.name || '未选择供应商'}
                        </div>
                        <div className="text-xs text-tertiary truncate">
                          {supplier?.baseUrl || supplier?.protocol || ''}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 中间：转换器 + 模型映射状态 */}
                  <div className="flex items-center gap-2">
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
                    {route.modelMapping?.enabled && (
                      <Chip
                        size="sm"
                        color="success"
                        variant="flat"
                        className="h-6"
                        classNames={{
                          content: 'px-2 text-xs',
                        }}
                      >
                        {route.modelMapping.rules.length} 映射规则
                      </Chip>
                    )}
                  </div>

                  {/* 右侧：操作按钮 */}
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
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>添加新路由</ModalHeader>
          <ModalBody className="space-y-4">
            <div className="p-4 bg-brand-primary/10 dark:bg-brand-primary/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Info size={16} className="text-brand-primary shrink-0 mt-0.5" />
                <p className="text-xs text-secondary">
                  选择本地服务和供应商，系统会自动选择合适的转换器。支持配置模型映射以实现灵活的模型转换。
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
                      modelMapping: undefined,
                    }));
                  }}
                  radius="lg"
                  variant="bordered"
                >
                  {LOCAL_SERVICES.map(service => {
                    const IconComponent = service.icon;
                    return (
                      <SelectItem key={service.key} textValue={service.label}>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: `${service.color}15` }}>
                            <IconComponent size={16} />
                          </div>
                          <div>
                            <div>{service.label}</div>
                            <div className="text-xs text-tertiary">{service.prefix}</div>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
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
                    setNewRoute(prev => ({ ...prev, supplierId: key, modelMapping: undefined }));
                  }}
                  radius="lg"
                  variant="bordered"
                  isDisabled={!newRoute.localService}
                >
                  {(() => {
                    const availableSuppliers = getAvailableSuppliers(newRoute.localService as LocalService);
                    const items = availableSuppliers.map(supplier => {
                      const protocol = LOCAL_SERVICES.find(s => s.protocol === supplier.protocol);
                      const IconComponent = protocol?.icon;
                      return (
                        <SelectItem key={supplier.id} textValue={supplier.displayName}>
                          <div className="flex items-center gap-2">
                            {IconComponent && (
                              <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: `${protocol?.color}15` }}>
                                <IconComponent size={16} />
                              </div>
                            )}
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
              </div>
            </div>

            {/* 模型映射配置 */}
            {newRoute.supplierId && (() => {
              const supplier = suppliers.find(s => s.id === newRoute.supplierId);
              if (!supplier) return null;
              const models = supplier.supportedModels || [];
              return (
                <ModelMappingEditor
                  value={newRoute.modelMapping}
                  onChange={val => setNewRoute(prev => ({ ...prev, modelMapping: val }))}
                  availableModels={models}
                />
              );
            })()}
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

      {/* 编辑路由弹窗 */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        size="2xl"
        backdrop="blur"
        placement="center"
        scrollBehavior="inside"
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
                      编辑供应商与模型映射配置；转换器由系统自动选择。
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
                        setEditRoute(prev => ({ ...prev, supplierId: key }));
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

                {(() => {
                  const supplierId = editRoute.supplierId || editingRoute.supplierId;
                  const supplier = suppliers.find(s => s.id === supplierId);
                  if (!supplier) return null;
                  const models = supplier.supportedModels || [];
                  const effectiveMapping = editRoute.modelMapping !== undefined
                    ? editRoute.modelMapping
                    : editingRoute.modelMapping;
                  return (
                    <ModelMappingEditor
                      value={effectiveMapping}
                      onChange={val => setEditRoute(prev => ({ ...prev, modelMapping: val }))}
                      availableModels={models}
                    />
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
