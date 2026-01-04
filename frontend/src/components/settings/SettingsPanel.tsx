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

import React, { useState, useEffect } from 'react';
import { Card, CardBody, Button, Input, Badge, Spinner, Divider, Chip, Switch, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem } from '@heroui/react';
import {
  BarChart3,
  Database,
  Settings,
  Download,
  Upload,
  Trash2,
  Filter,
  Plus,
  Info,
  Edit2,
  Globe,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useConfig,
  useExportConfig,
  useImportConfig,
  useDownloadConfig,
  useUploadConfig,
} from '@/hooks';
import { useCleanupRequests, useStats } from '@/hooks/useRequests';
import { formatBytes, getClientColorStyle } from '@/utils';
import { fetchSettings, updateSettings } from '@/api/config';
import {
  useSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useToggleSupplier,
} from '@/hooks/useSuppliers';
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

export const SettingsPanel: React.FC = () => {
  const { isLoading: configLoading } = useConfig();
  const { stats, isLoading: statsLoading } = useStats();
  const exportMutation = useExportConfig();
  const importMutation = useImportConfig();
  const { download } = useDownloadConfig();
  const { upload } = useUploadConfig();
  const cleanupMutation = useCleanupRequests();

  // 供应商管理
  const { data: suppliersData, isLoading: suppliersLoading, refetch: refetchSuppliers } = useSuppliers();
  const createSupplierMutation = useCreateSupplier();
  const updateSupplierMutation = useUpdateSupplier();
  const deleteSupplierMutation = useDeleteSupplier();
  const toggleSupplierMutation = useToggleSupplier();

  const [keepCount, setKeepCount] = useState('100');
  const [filteredPaths, setFilteredPaths] = useState<string[]>([]);
  const [newPath, setNewPath] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(true);

  // 供应商编辑弹窗状态
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierModelInput, setSupplierModelInput] = useState('');
  const [supplierFormData, setSupplierFormData] = useState<Partial<Supplier>>({
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

  // 初始化：从后端读取设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await fetchSettings();
        if (result.success && result.settings.max_history) {
          setKeepCount(result.settings.max_history);
        }
        // 加载过滤路径
        if (result.success && result.settings.filtered_paths) {
          try {
            const paths = JSON.parse(result.settings.filtered_paths);
            setFilteredPaths(Array.isArray(paths) ? paths : []);
          } catch {
            setFilteredPaths([]);
          }
        }
      } catch {
        // 忽略错误，使用默认值
      } finally {
        setSettingsLoading(false);
      }
    };
    loadSettings();
  }, []);

  // 导出配置
  const handleExport = async () => {
    const conf = await exportMutation.mutateAsync();
    download(conf, `promptxy-config-${Date.now()}.json`);
  };

  // 导入配置
  const handleImport = async () => {
    try {
      const conf = await upload();
      if (conf) {
        await importMutation.mutateAsync(conf);
        alert('配置导入成功！');
      }
    } catch (error: any) {
      alert(`导入失败: ${error?.message}`);
    }
  };

  // 保存设置
  const handleSaveSettings = async () => {
    try {
      await updateSettings({ max_history: keepCount });
    } catch (error: any) {
      alert(`保存设置失败: ${error?.message}`);
    }
  };

  // 清理数据
  const handleCleanup = async () => {
    const count = parseInt(keepCount) || 100;
    // 先保存设置
    await handleSaveSettings();
    if (confirm(`确定要清理旧数据吗？将保留最近 ${count} 条请求。`)) {
      const result = await cleanupMutation.mutateAsync(count);
      alert(`清理完成！删除了 ${result.deleted} 条记录，剩余 ${result.remaining} 条。`);
    }
  };

  // 处理输入框失去焦点时保存设置
  const handleKeepCountBlur = () => {
    handleSaveSettings();
  };

  // 添加过滤路径
  const handleAddFilteredPath = async () => {
    const trimmedPath = newPath.trim();
    if (!trimmedPath) return;

    // 确保路径以 / 开头
    const normalizedPath = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`;

    // 检查是否已存在
    if (filteredPaths.includes(normalizedPath)) {
      alert('该路径已存在');
      return;
    }

    const updatedPaths = [...filteredPaths, normalizedPath];
    setFilteredPaths(updatedPaths);
    setNewPath('');

    // 保存到后端
    try {
      await updateSettings({ filtered_paths: JSON.stringify(updatedPaths) });
    } catch (error: any) {
      alert(`保存失败: ${error?.message}`);
      // 回滚
      setFilteredPaths(filteredPaths);
    }
  };

  // 删除过滤路径
  const handleRemoveFilteredPath = async (pathToRemove: string) => {
    const updatedPaths = filteredPaths.filter(p => p !== pathToRemove);
    setFilteredPaths(updatedPaths);

    // 保存到后端
    try {
      await updateSettings({ filtered_paths: JSON.stringify(updatedPaths) });
    } catch (error: any) {
      alert(`保存失败: ${error?.message}`);
      // 回滚
      setFilteredPaths(filteredPaths);
    }
  };

  // 供应商管理 - 打开添加供应商弹窗
  const handleOpenAddSupplierModal = () => {
    setEditingSupplier(null);
    setSupplierFormData({
      name: '',
      displayName: '',
      baseUrl: '',
      protocol: 'anthropic',
      enabled: true,
      auth: { type: 'none' },
      supportedModels: [],
      description: '',
    });
    setSupplierModelInput('');
    setIsSupplierModalOpen(true);
  };

  // 供应商管理 - 打开编辑供应商弹窗
  const handleOpenEditSupplierModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupplierFormData({ ...supplier });
    setSupplierModelInput('');
    setIsSupplierModalOpen(true);
  };

  // 供应商管理 - 保存供应商
  const handleSaveSupplier = async () => {
    if (!supplierFormData.name || !supplierFormData.baseUrl || !supplierFormData.protocol) {
      toast.error('请填写必填字段');
      return;
    }

    try {
      if (editingSupplier) {
        await updateSupplierMutation.mutateAsync({
          supplierId: editingSupplier.id,
          supplier: supplierFormData as Supplier,
        });
      } else {
        await createSupplierMutation.mutateAsync({
          supplier: supplierFormData as Omit<Supplier, 'id'>,
        });
      }

      setIsSupplierModalOpen(false);
      await refetchSuppliers();
      toast.success(`${editingSupplier ? '更新' : '添加'}供应商成功！`);
    } catch (error: any) {
      toast.error(`${editingSupplier ? '更新' : '添加'}失败: ${error?.message || '未知错误'}`);
    }
  };

  // 供应商管理 - 删除供应商
  const handleDeleteSupplier = async (supplier: Supplier) => {
    toast.promise(deleteSupplierMutation.mutateAsync(supplier.id), {
      loading: '正在删除供应商...',
      success: '供应商已删除！',
      error: err => `删除失败: ${err?.message || '未知错误'}`,
    });
  };

  // 供应商管理 - 切换供应商状态
  const handleToggleSupplier = async (supplier: Supplier) => {
    try {
      await toggleSupplierMutation.mutateAsync({
        supplierId: supplier.id,
        request: { enabled: !supplier.enabled },
      });
      await refetchSuppliers();
      toast.success('供应商状态已更新！');
    } catch (error: any) {
      toast.error(`更新失败: ${error?.message || '未知错误'}`);
    }
  };

  const isLoading = configLoading || statsLoading || settingsLoading;

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Spinner color="primary">加载配置中...</Spinner>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 统计信息 - 占据全宽或 2/3 */}
          <Card className="lg:col-span-3 border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5">
            <CardBody className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="text-brand-primary" size={24} />
                <h4 className="text-lg font-bold text-primary">统计信息</h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-brand-primary/10 dark:bg-brand-primary/20 border border-brand-primary/30 dark:border-brand-primary/20">
                  <div className="text-sm text-brand-primary dark:text-brand-primary/80 mb-1">
                    总请求数
                  </div>
                  <div className="text-2xl font-bold text-brand-primary dark:text-brand-primary/90">
                    {stats?.total || 0}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-status-success/10 dark:bg-status-success/20 border border-status-success/30 dark:border-status-success/20">
                  <div className="text-sm text-status-success dark:text-status-success/80 mb-1">
                    今日请求
                  </div>
                  <div className="text-2xl font-bold text-status-success dark:text-status-success/90">
                    {stats?.recent || 0}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-status-warning/10 dark:bg-status-warning/20 border border-status-warning/30 dark:border-status-warning/20">
                  <div className="text-sm text-status-warning dark:text-status-warning/80 mb-1">
                    数据库大小
                  </div>
                  <div className="text-2xl font-bold text-status-warning dark:text-status-warning/90">
                    {stats?.database?.size ? formatBytes(stats.database.size) : '0 B'}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-accent/10 dark:bg-accent/20 border border-accent/30 dark:border-accent/20">
                  <div className="text-sm text-accent dark:text-accent/80 mb-1">记录数</div>
                  <div className="text-2xl font-bold text-accent dark:text-accent/90">
                    {stats?.database?.recordCount || 0}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div>
                  <span className="text-sm font-medium text-secondary mb-2 block">
                    按客户端分布
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {stats?.byClient &&
                      Object.entries(stats.byClient).map(([client, count]) => (
                        <Chip
                          key={client}
                          variant="flat"
                          size="md"
                          className="font-medium"
                          style={getClientColorStyle(client)}
                        >
                          {formatClient(client)}: {count}
                        </Chip>
                      ))}
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium text-secondary mb-2 block">数据库路径</span>
                  <div className="font-mono text-xs text-secondary break-all bg-canvas dark:bg-secondary p-3 rounded-lg border border-subtle flex items-center gap-2">
                    <Database size={14} className="shrink-0" />
                    {stats?.database?.path}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* 配置管理 */}
          <Card className="lg:col-span-1 border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5 h-full">
            <CardBody className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Settings size={24} className="text-accent" />
                <h4 className="text-lg font-bold text-primary">配置管理</h4>
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  color="primary"
                  variant="flat"
                  onPress={handleExport}
                  radius="lg"
                  className="w-full justify-start"
                  startContent={<Download size={18} />}
                >
                  {exportMutation.isPending ? '导出中...' : '导出配置'}
                </Button>
                <Button
                  color="secondary"
                  variant="flat"
                  onPress={handleImport}
                  radius="lg"
                  className="w-full justify-start"
                  startContent={<Upload size={18} />}
                >
                  {importMutation.isPending ? '导入中...' : '导入配置'}
                </Button>
              </div>
              <div className="text-xs text-secondary bg-canvas dark:bg-secondary/50 p-3 rounded-lg leading-relaxed">
                导出包含所有规则配置，导入会覆盖当前规则。请谨慎操作。
              </div>
            </CardBody>
          </Card>

          {/* 数据清理 */}
          <Card className="lg:col-span-1 border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5 h-full">
            <CardBody className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Trash2 size={24} className="text-status-error" />
                <h4 className="text-lg font-bold text-primary">数据清理</h4>
              </div>
              <div className="space-y-md">
                <Input
                  label="保留最近条数"
                  placeholder="100"
                  value={keepCount}
                  onChange={e => setKeepCount(e.target.value)}
                  onBlur={handleKeepCountBlur}
                  radius="lg"
                  labelPlacement="outside"
                  classNames={{
                    inputWrapper: 'shadow-sm bg-elevated dark:bg-elevated border border-subtle',
                  }}
                />
                <Button
                  color="danger"
                  variant="flat"
                  onPress={handleCleanup}
                  radius="lg"
                  className="w-full"
                  startContent={<Trash2 size={18} />}
                >
                  {cleanupMutation.isPending ? '清理中...' : '清理旧数据'}
                </Button>
              </div>
              <div className="text-xs text-secondary bg-canvas dark:bg-secondary/50 p-3 rounded-lg leading-relaxed">
                💡 自动清理机制: 每次记录请求时自动检查，超过上限时保留最近 {keepCount} 条。
              </div>
            </CardBody>
          </Card>

          {/* 关于 */}
          <Card className="lg:col-span-1 border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5 h-full">
            <CardBody className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Info size={24} className="text-secondary" />
                <h4 className="text-lg font-bold text-primary">关于系统</h4>
              </div>
              <div className="space-y-3 text-sm text-secondary">
                <div className="flex items-center justify-between">
                  <span className="font-medium">版本</span>
                  <span className="font-mono bg-canvas dark:bg-secondary px-2 py-0.5 rounded text-xs">
                    PromptXY
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">服务端口</span>
                  <span className="font-mono bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary px-2 py-0.5 rounded text-xs">
                    自动分配
                  </span>
                </div>
                <Divider className="my-my2" />
                <p className="text-xs leading-relaxed opacity-80">
                  PromptXY 是一个强大的本地 HTTP 代理规则管理器，用于捕获、监控和修改 LLM 请求。
                </p>
              </div>
            </CardBody>
          </Card>

          {/* 路径过滤 - 占据全宽 */}
          <Card className="lg:col-span-3 border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5">
            <CardBody className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Filter size={24} className="text-status-warning" />
                <h4 className="text-lg font-bold text-primary">路径过滤</h4>
              </div>
              <div className="flex flex-col md:flex-row gap-4 items-start">
                <div className="flex-1 w-full">
                  <div className="flex gap-2">
                    <Input
                      placeholder="例如: /api/ping 或 /health/"
                      value={newPath}
                      onChange={e => setNewPath(e.target.value)}
                      onKeyPress={e => {
                        if (e.key === 'Enter') {
                          handleAddFilteredPath();
                        }
                      }}
                      radius="lg"
                      classNames={{
                        inputWrapper: 'shadow-sm bg-elevated dark:bg-elevated border border-subtle',
                      }}
                      className="flex-1"
                    />
                    <Button
                      color="warning"
                      variant="flat"
                      onPress={handleAddFilteredPath}
                      radius="lg"
                      className="shadow-sm"
                      isDisabled={!newPath.trim()}
                      startContent={<Plus size={18} />}
                    >
                      添加
                    </Button>
                  </div>
                  <p className="text-xs text-secondary mt-2 ml-1">
                    支持精确匹配（如 /api/ping）和前缀匹配（如
                    /health/）。匹配的路径将不会记录到历史。
                  </p>
                </div>

                <div className="flex-1 w-full bg-canvas dark:bg-secondary/30 rounded-xl p-4 min-h-[100px]">
                  {filteredPaths.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {filteredPaths.map(path => (
                        <Chip
                          key={path}
                          color="warning"
                          variant="flat"
                          onClose={() => handleRemoveFilteredPath(path)}
                          classNames={{
                            base: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
                            content: 'font-mono text-sm',
                          }}
                        >
                          {path}
                        </Chip>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-tertiary italic text-center py-2">
                      暂无过滤路径
                    </div>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* 供应商管理 - 占据全宽 */}
          <Card className="lg:col-span-3 border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5">
            <CardBody className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings size={24} className="text-brand-primary" />
                  <h4 className="text-lg font-bold text-primary">供应商管理</h4>
                </div>
                <Button
                  color="primary"
                  onPress={handleOpenAddSupplierModal}
                  startContent={<Plus size={18} />}
                  size="sm"
                  radius="lg"
                >
                  添加供应商
                </Button>
              </div>

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
                      <CardBody className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="text-2xl">{protocol?.icon}</div>
                            <div>
                              <h5 className="font-bold text-primary text-sm">
                                {supplier.displayName || supplier.name}
                              </h5>
                              <p className="text-xs text-secondary">{supplier.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={supplier.enabled}
                                onChange={() => handleToggleSupplier(supplier)}
                                className="w-4 h-4 rounded"
                              />
                            </label>
                          </div>
                        </div>

                        <div className="mb-2">
                          <Chip size="sm" variant="flat">
                            {protocol?.color} {protocol?.label}
                          </Chip>
                        </div>

                        <div className="mb-2">
                          <div className="flex items-center gap-1 text-xs text-secondary">
                            <Globe size={12} />
                            <span className="truncate">{supplier.baseUrl}</span>
                          </div>
                        </div>

                        {supplier.auth && supplier.auth.type !== 'none' && (
                          <div className="mb-2">
                            <div className="flex items-center gap-1 text-xs text-secondary">
                              <Lock size={12} />
                              <span>
                                {supplier.auth.type === 'bearer' && 'Bearer Token 认证'}
                                {supplier.auth.type === 'header' && '自定义 Header 认证'}
                              </span>
                            </div>
                          </div>
                        )}

                        <Divider className="my-2" />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="flat"
                            onPress={() => handleOpenEditSupplierModal(supplier)}
                            startContent={<Edit2 size={12} />}
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
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}

                {suppliers.length === 0 && !suppliersLoading && (
                  <Card className="col-span-full border border-dashed border-subtle">
                    <CardBody className="py-8 text-center">
                      <p className="text-secondary font-medium">暂无供应商</p>
                      <p className="text-sm text-tertiary mt-1">
                        点击上方按钮添加新的上游供应商
                      </p>
                    </CardBody>
                  </Card>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* 供应商编辑弹窗 */}
        <Modal
          isOpen={isSupplierModalOpen}
          onClose={() => setIsSupplierModalOpen(false)}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-primary mb-2 block">
                    供应商名称 *
                  </label>
                  <Input
                    value={supplierFormData.name || ''}
                    onValueChange={value =>
                      setSupplierFormData(prev => ({ ...prev, name: value }))
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
                    value={supplierFormData.displayName || ''}
                    onValueChange={value =>
                      setSupplierFormData(prev => ({ ...prev, displayName: value }))
                    }
                    placeholder="例如: Anthropic Official"
                    radius="lg"
                    variant="bordered"
                    description="在界面上显示的名称"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-primary mb-2 block">
                  API 地址 *
                </label>
                <Input
                  value={supplierFormData.baseUrl || ''}
                  onValueChange={value =>
                    setSupplierFormData(prev => ({ ...prev, baseUrl: value }))
                  }
                  placeholder="https://api.anthropic.com"
                  radius="lg"
                  variant="bordered"
                  description="上游 API 的完整 URL"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-primary mb-2 block">
                  协议类型 *
                </label>
                <Select
                  selectedKeys={[supplierFormData.protocol || '']}
                  onSelectionChange={keys => {
                    const key = Array.from(keys)[0] as SupplierProtocol;
                    setSupplierFormData(prev => ({ ...prev, protocol: key }));
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
                    {(supplierFormData.supportedModels || []).length === 0 ? (
                      <span className="text-xs text-tertiary">
                        未配置（/claude 映射与校验将不可用）
                      </span>
                    ) : (
                      (supplierFormData.supportedModels || []).map(model => (
                        <Chip
                          key={model}
                          size="sm"
                          variant="flat"
                          onClose={() => {
                            setSupplierFormData(prev => ({
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
                    value={supplierModelInput}
                    onValueChange={setSupplierModelInput}
                    placeholder="输入模型后回车添加，例如: gpt-5.2-high"
                    radius="lg"
                    variant="bordered"
                    description="支持回车添加、去重；用于 Claude 路由模型映射与校验"
                    onKeyDown={e => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      const value = supplierModelInput.trim();
                      if (!value) return;
                      setSupplierFormData(prev => {
                        const list = prev.supportedModels || [];
                        if (list.includes(value)) return prev;
                        return { ...prev, supportedModels: [...list, value] };
                      });
                      setSupplierModelInput('');
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-primary mb-2 block">
                  认证方式
                </label>
                <Select
                  selectedKeys={[supplierFormData.auth?.type || 'none']}
                  onSelectionChange={keys => {
                    const type = Array.from(keys)[0] as any;
                    setSupplierFormData(prev => ({
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

              {supplierFormData.auth?.type === 'bearer' && (
                <div>
                  <label className="text-sm font-medium text-primary mb-2 block">
                    Bearer Token
                  </label>
                  <Input
                    value={supplierFormData.auth?.token || ''}
                    onValueChange={value =>
                      setSupplierFormData(prev => ({
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

              {supplierFormData.auth?.type === 'header' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-primary mb-2 block">
                      Header 名称
                    </label>
                    <Input
                      value={supplierFormData.auth?.headerName || ''}
                      onValueChange={value =>
                        setSupplierFormData(prev => ({
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
                      value={supplierFormData.auth?.headerValue || ''}
                      onValueChange={value =>
                        setSupplierFormData(prev => ({
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

              <div>
                <label className="text-sm font-medium text-primary mb-2 block">
                  描述
                </label>
                <Input
                  value={supplierFormData.description || ''}
                  onValueChange={value =>
                    setSupplierFormData(prev => ({ ...prev, description: value }))
                  }
                  placeholder="供应商的简要说明"
                  radius="lg"
                  variant="bordered"
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setIsSupplierModalOpen(false)}>
                取消
              </Button>
              <Button color="primary" onPress={handleSaveSupplier}>
                {editingSupplier ? '更新' : '添加'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
        </>
      )}
    </div>
  );
};

// Helper function to format client names
function formatClient(client: string): string {
  const clientMap: Record<string, string> = {
    claude: 'Claude',
    codex: 'Codex',
    gemini: 'Gemini',
  };
  return clientMap[client] || client;
}
