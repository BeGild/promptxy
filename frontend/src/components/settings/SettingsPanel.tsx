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
import { Card, CardBody, Button, Input, Badge, Spinner, Divider, Chip } from '@heroui/react';
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
import { SupplierManagement } from './SupplierManagement';
import { formatBytes } from '@/utils';
import { fetchSettings, updateSettings } from '@/api/config';

export const SettingsPanel: React.FC = () => {
  const { isLoading: configLoading } = useConfig();
  const { stats, isLoading: statsLoading } = useStats();
  const exportMutation = useExportConfig();
  const importMutation = useImportConfig();
  const { download } = useDownloadConfig();
  const { upload } = useUploadConfig();
  const cleanupMutation = useCleanupRequests();

  const [keepCount, setKeepCount] = useState('100');
  const [filteredPaths, setFilteredPaths] = useState<string[]>([]);
  const [newPath, setNewPath] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(true);

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

  const isLoading = configLoading || statsLoading || settingsLoading;

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Spinner color="primary">加载配置中...</Spinner>
        </div>
      ) : (
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
                          color="secondary"
                          variant="flat"
                          size="md"
                          className="font-medium"
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

          {/* 供应商管理 - 占据全宽 */}
          <div className="lg:col-span-3">
            <SupplierManagement />
          </div>

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
                    v2.0
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Gateway 端口</span>
                  <span className="font-mono bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary px-2 py-0.5 rounded text-xs">
                    7070
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">API 端口</span>
                  <span className="font-mono bg-accent/10 dark:bg-accent/20 text-accent px-2 py-0.5 rounded text-xs">
                    7071
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
        </div>
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
