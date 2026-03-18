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
import { ArrowRight, Plus, Trash2, Info } from 'lucide-react';
import { useSuppliers } from '@/hooks';
import { AnthropicIcon, OpenAIIcon, GeminiIcon, CodexIcon } from '@/components/icons/SupplierIcons';
import { fetchRoutes, createRoute, deleteRoute, toggleRoute, updateRoute } from '@/api/config';
import type { Supplier, LocalService, TransformerType, Route, ModelMappingRule } from '@/types/api';
import { RouteFlowCard } from '@/components/routes';

// 本地服务选项
const LOCAL_SERVICES: Array<{
  key: LocalService;
  label: string;
  prefix: string;
  protocol: 'anthropic' | 'openai-codex' | 'openai-chat' | 'gemini';
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
    protocol: 'openai-codex',
    color: '#2D3748',
    icon: CodexIcon,
  },
  {
    key: 'chat',
    label: 'Chat',
    prefix: '/chat',
    protocol: 'openai-chat',
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

// Claude 预设模型模式
const CLAUDE_PRESET_PATTERNS = [
  { inboundModel: '*-haiku-*', description: 'Haiku 系列' },
  { inboundModel: '*-sonnet-*', description: 'Sonnet 系列' },
  { inboundModel: '*-opus-*', description: 'Opus 系列' },
];

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
    modelMappings: CLAUDE_PRESET_PATTERNS.map(p => ({
      id: generateId(),
      inboundModel: p.inboundModel,
      targetSupplierId: '',
      outboundModel: undefined,
      description: p.description,
      enabled: true,
    })),
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

  // 添加新路由
  const handleAddRoute = async () => {
    if (!newRoute.localService) {
      toast.error('请选择本地服务');
      return;
    }

    const localService = LOCAL_SERVICES.find(s => s.key === newRoute.localService);
    if (!localService) {
      toast.error('无效的本地服务');
      return;
    }

    // Claude: 检查所有规则都有供应商
    if (newRoute.localService === 'claude') {
      const mappings = newRoute.modelMappings || [];
      if (mappings.length === 0) {
        toast.error('请至少添加一条模型映射规则');
        return;
      }
      for (const mapping of mappings) {
        if (!mapping.targetSupplierId) {
          toast.error('请为所有模型映射规则选择目标供应商');
          return;
        }
      }
    }
    // Codex/Chat/Gemini: 检查单一供应商
    else {
      if (!newRoute.singleSupplierId) {
        toast.error('请选择上游供应商');
        return;
      }
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
        // 重置表单
        setNewRoute({
          localService: 'claude',
          modelMappings: CLAUDE_PRESET_PATTERNS.map(p => ({
            id: generateId(),
            inboundModel: p.inboundModel,
            targetSupplierId: '',
            outboundModel: undefined,
            description: p.description,
            enabled: true,
          })),
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
        route: editRoute,
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

    // Claude: 支持所有协议转换
    if (localServiceKey === 'claude') {
      return suppliers.filter(s => s.enabled);
    }

    // Codex/Gemini: 只支持同协议
    return suppliers.filter(s => s.protocol === localService.protocol && s.enabled);
  };

  const getSupplierDisplay = (supplierId: string | undefined): Supplier | undefined => {
    if (!supplierId) return undefined;
    return suppliers.find(s => s.id === supplierId);
  };

  const getSupplierModels = (supplierId: string | undefined) => {
    const supplier = getSupplierDisplay(supplierId);
    return supplier?.supportedModels || [];
  };

  // 模型映射编辑器组件
  const ModelMappingEditor: React.FC<{
    mappings: ModelMappingRule[];
    onChange: (mappings: ModelMappingRule[]) => void;
    routeLocalService: LocalService;
  }> = ({ mappings, onChange, routeLocalService }) => {
    const handleAddRule = () => {
      const allowedSuppliers = getAvailableSuppliers(routeLocalService);
      const defaultSupplierId = allowedSuppliers[0]?.id || '';
      const supplierModels = getSupplierModels(defaultSupplierId);

      const newRule: ModelMappingRule = {
        id: generateId(),
        inboundModel: '',
        targetSupplierId: defaultSupplierId,
        outboundModel: supplierModels[0],
        description: '',
        enabled: true,
      };
      onChange([...mappings, newRule]);
    };

    const handleUpdateRule = (index: number, field: keyof ModelMappingRule, val: string | boolean | undefined) => {
      const newMappings = [...mappings];
      newMappings[index] = { ...newMappings[index], [field]: val };
      onChange(newMappings);
    };

    // 批量更新规则的多个字段
    const handleUpdateRuleMultiple = (index: number, updates: Partial<ModelMappingRule>) => {
      const newMappings = [...mappings];
      newMappings[index] = { ...newMappings[index], ...updates };
      onChange(newMappings);
    };

    const handleDeleteRule = (index: number) => {
      const newMappings = mappings.filter((_, i) => i !== index);
      onChange(newMappings);
    };

    return (
      <div className="space-y-3">
        <Divider />
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-primary">模型映射</div>
          <span className="text-xs text-tertiary">{mappings.length} 条规则</span>
        </div>

        <div className="space-y-2">
          {mappings.map((rule, index) => (
            <div key={rule.id} className="p-3 bg-canvas dark:bg-secondary/30 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  size="sm"
                  label="入站模型"
                  placeholder="如: claude-*-sonnet-*"
                  value={rule.inboundModel}
                  onValueChange={val => handleUpdateRule(index, 'inboundModel', val)}
                  variant="bordered"
                  className="flex-1"
                />
                <ArrowRight size={16} className="text-tertiary shrink-0" />

                <Select
                  size="sm"
                  label="目标供应商"
                  selectedKeys={rule.targetSupplierId ? [rule.targetSupplierId] : []}
                  onSelectionChange={keys => {
                    const key = Array.from(keys)[0] as string;
                    // 切换供应商时，重置 outboundModel 为该供应商的第一个模型（若存在）
                    const models = getSupplierModels(key);
                    handleUpdateRuleMultiple(index, { targetSupplierId: key, outboundModel: models[0] });
                  }}
                  variant="bordered"
                  className="flex-1"
                  classNames={{
                    trigger: 'min-h-8 py-1',
                    value: 'text-small',
                  }}
                  renderValue={(items) => {
                    // 如果有选中的值，直接通过 rule.targetSupplierId 查找供应商
                    if (rule.targetSupplierId) {
                      const supplier = getAvailableSuppliers(routeLocalService).find(s => s.id === rule.targetSupplierId);
                      if (supplier) {
                        return (
                          <div className="flex flex-col">
                            <span className="text-small">{supplier.displayName || supplier.name}</span>
                          </div>
                        );
                      }
                    }
                    // 如果没有选中的值或找不到供应商，显示默认文本
                    return '目标供应商';
                  }}
                >
                  {getAvailableSuppliers(routeLocalService).map(supplier => (
                    <SelectItem key={supplier.id} textValue={supplier.displayName || supplier.name}>
                      <div className="flex flex-col">
                        <span className="text-small">{supplier.displayName || supplier.name}</span>
                        <span className="text-tiny text-default-400">{supplier.protocol}</span>
                      </div>
                    </SelectItem>
                  ))}
                </Select>

                <ArrowRight size={16} className="text-tertiary shrink-0" />

                {(() => {
                  const models = getSupplierModels(rule.targetSupplierId);
                  if (models.length === 0) {
                    return (
                      <div className="flex-1 text-xs text-tertiary flex items-center">
                        透传
                      </div>
                    );
                  }

                  const modelItems = [
                    <SelectItem key="" textValue="透传">
                      透传入站模型
                    </SelectItem>,
                    ...models.map((model) => (
                      <SelectItem key={model} textValue={model}>
                        {model}
                      </SelectItem>
                    )),
                  ];

                  return (
                    <Select
                      size="sm"
                      label="出站模型（可选）"
                      selectedKeys={rule.outboundModel ? [rule.outboundModel] : []}
                      onSelectionChange={keys => {
                        const key = Array.from(keys)[0] as string;
                        handleUpdateRule(index, 'outboundModel', key);
                      }}
                      variant="bordered"
                      className="flex-1"
                    >
                      {modelItems}
                    </Select>
                  );
                })()}

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
              {rule.description && (
                <div className="text-xs text-tertiary">{rule.description}</div>
              )}
            </div>
          ))}
        </div>

        <Button
          size="sm"
          variant="flat"
          onPress={handleAddRule}
          startContent={<Plus size={16} />}
        >
          添加规则
        </Button>

        <p className="text-xs text-tertiary">
          💡 规则按顺序匹配，首个命中的生效；outboundModel 为空时透传入站模型
        </p>
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
        {routes.map(route => (
          <RouteFlowCard
            key={route.id}
            route={route}
            suppliers={suppliers}
            onToggle={handleToggleRoute}
            onEdit={handleOpenEditModal}
            onDelete={handleDeleteRoute}
          />
        ))}

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
            {/* 本地服务选择 */}
            <div>
              <label className="text-sm font-medium text-primary mb-2 block">
                本地服务 *
              </label>
              <Select
                selectedKeys={[newRoute.localService || '']}
                onSelectionChange={keys => {
                  const key = Array.from(keys)[0] as LocalService;
                  if (key === 'claude') {
                    // Claude: 自动添加预设规则
                    setNewRoute({
                      localService: key,
                      modelMappings: CLAUDE_PRESET_PATTERNS.map(p => ({
                        id: generateId(),
                        inboundModel: p.inboundModel,
                        targetSupplierId: '',
                        outboundModel: undefined,
                        description: p.description,
                        enabled: true,
                      })),
                      singleSupplierId: undefined,
                      enabled: true,
                    });
                  } else {
                    // Codex/Chat/Gemini: 清空规则，准备选择单一供应商
                    setNewRoute({
                      localService: key,
                      modelMappings: [],
                      singleSupplierId: '',
                      enabled: true,
                    });
                  }
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

            <Divider />

            {/* Claude: 模型映射配置 */}
            {newRoute.localService === 'claude' && (
              <ModelMappingEditor
                mappings={newRoute.modelMappings || []}
                onChange={mappings => setNewRoute(prev => ({ ...prev, modelMappings: mappings }))}
                routeLocalService={newRoute.localService}
              />
            )}

            {/* Codex/Chat/Gemini: 单一供应商选择 */}
            {newRoute.localService !== 'claude' && (
              <div>
                <label className="text-sm font-medium text-primary mb-2 block">
                  上游供应商 *
                </label>
                <Select
                  selectedKeys={newRoute.singleSupplierId ? [newRoute.singleSupplierId] : []}
                  onSelectionChange={keys => {
                    const key = Array.from(keys)[0] as string;
                    setNewRoute(prev => ({ ...prev, singleSupplierId: key }));
                  }}
                  radius="lg"
                  variant="bordered"
                >
                  {getAvailableSuppliers(newRoute.localService!).map(supplier => (
                    <SelectItem key={supplier.id} textValue={supplier.displayName}>
                      {supplier.displayName} ({supplier.protocol})
                    </SelectItem>
                  ))}
                </Select>
                {getAvailableSuppliers(newRoute.localService!).length === 0 && (
                  <p className="text-xs text-tertiary mt-2">
                    ⚠️ 仅显示 {newRoute.localService} 对应协议的供应商
                  </p>
                )}
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
              isDisabled={!newRoute.localService}
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
          <ModalHeader>编辑路由: {editingRoute?.localService}</ModalHeader>
          <ModalBody className="space-y-4">
            {!editingRoute ? (
              <p className="text-sm text-tertiary">未选择路由</p>
            ) : (
              <>
                {/* 显示本地服务（不可编辑） */}
                <div>
                  <label className="text-sm font-medium text-primary mb-2 block">本地服务</label>
                  <div className="flex items-center gap-2 p-3 bg-default-100 rounded-lg">
                    {(() => {
                      const localService = LOCAL_SERVICES.find(s => s.key === editingRoute.localService);
                      const IconComponent = localService?.icon;
                      return IconComponent ? (
                        <>
                          <IconComponent size={20} />
                          <span>{localService?.label} ({localService?.prefix})</span>
                        </>
                      ) : null;
                    })()}
                  </div>
                </div>

                <Divider />

                {/* Claude: 模型映射配置 */}
                {editingRoute.localService === 'claude' && (
                  <ModelMappingEditor
                    mappings={(editRoute.modelMappings || editingRoute.modelMappings || [])}
                    onChange={mappings => setEditRoute(prev => ({ ...prev, modelMappings: mappings }))}
                    routeLocalService={editingRoute.localService}
                  />
                )}

                {/* Codex/Chat/Gemini: 单一供应商选择 */}
                {editingRoute.localService !== 'claude' && (
                  <div>
                    <label className="text-sm font-medium text-primary mb-2 block">
                      上游供应商 *
                    </label>
                    <Select
                      selectedKeys={(editRoute.singleSupplierId || editingRoute.singleSupplierId) ? [editRoute.singleSupplierId || editingRoute.singleSupplierId!] : []}
                      onSelectionChange={keys => {
                        const key = Array.from(keys)[0] as string;
                        setEditRoute(prev => ({ ...prev, singleSupplierId: key }));
                      }}
                      radius="lg"
                      variant="bordered"
                    >
                      {getAvailableSuppliers(editingRoute.localService!).map(supplier => (
                        <SelectItem key={supplier.id} textValue={supplier.displayName}>
                          {supplier.displayName} ({supplier.protocol})
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                )}
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
