import React, { useState, useEffect } from 'react';
import { Card, CardBody, Button, Input, Badge, Spinner, Divider, Chip } from '@heroui/react';
import { BarChart3, Database, Settings, Download, Upload, Trash2, Filter, Plus, Info } from 'lucide-react';
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
          <Card className="lg:col-span-3 border border-gray-200 dark:border-gray-700 shadow-sm">
            <CardBody className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="text-blue-600 dark:text-blue-400" size={24} />
                <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  统计信息
                </h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50">
                  <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">总请求数</div>
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats?.total || 0}</div>
                </div>
                <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/50">
                  <div className="text-sm text-green-600 dark:text-green-400 mb-1">今日请求</div>
                  <div className="text-2xl font-bold text-green-900 dark:text-green-100">{stats?.recent || 0}</div>
                </div>
                <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/50">
                  <div className="text-sm text-orange-600 dark:text-orange-400 mb-1">数据库大小</div>
                  <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {stats?.database?.size ? formatBytes(stats.database.size) : '0 B'}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/50">
                  <div className="text-sm text-purple-600 dark:text-purple-400 mb-1">记录数</div>
                  <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {stats?.database?.recordCount || 0}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 block">按客户端分布</span>
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
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 block">数据库路径</span>
                  <div className="font-mono text-xs text-gray-600 dark:text-gray-400 break-all bg-gray-100 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-2">
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
          <Card className="lg:col-span-1 border border-gray-200 dark:border-gray-700 shadow-sm h-full">
            <CardBody className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Settings size={24} className="text-purple-600 dark:text-purple-400" />
                <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  配置管理
                </h4>
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
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg leading-relaxed">
                导出包含所有规则配置，导入会覆盖当前规则。请谨慎操作。
              </div>
            </CardBody>
          </Card>

          {/* 数据清理 */}
          <Card className="lg:col-span-1 border border-gray-200 dark:border-gray-700 shadow-sm h-full">
            <CardBody className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Trash2 size={24} className="text-red-600 dark:text-red-400" />
                <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  数据清理
                </h4>
              </div>
              <div className="space-y-4">
                <Input
                  label="保留最近条数"
                  placeholder="100"
                  value={keepCount}
                  onChange={e => setKeepCount(e.target.value)}
                  onBlur={handleKeepCountBlur}
                  radius="lg"
                  labelPlacement="outside"
                  classNames={{
                    inputWrapper:
                      'shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
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
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg leading-relaxed">
                自动清理: 每小时清理一次，保留最近 {keepCount} 条记录。
              </div>
            </CardBody>
          </Card>

          {/* 关于 */}
          <Card className="lg:col-span-1 border border-gray-200 dark:border-gray-700 shadow-sm h-full">
            <CardBody className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Info size={24} className="text-gray-600 dark:text-gray-400" />
                <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  关于系统
                </h4>
              </div>
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center justify-between">
                  <span className="font-medium">版本</span>
                  <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs">v2.0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Gateway 端口</span>
                  <span className="font-mono bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded text-xs">7070</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">API 端口</span>
                  <span className="font-mono bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded text-xs">7071</span>
                </div>
                <Divider className="my-2" />
                <p className="text-xs leading-relaxed opacity-80">
                  PromptXY 是一个强大的本地 HTTP 代理规则管理器，用于捕获、监控和修改 LLM 请求。
                </p>
              </div>
            </CardBody>
          </Card>

          {/* 路径过滤 - 占据全宽 */}
          <Card className="lg:col-span-3 border border-gray-200 dark:border-gray-700 shadow-sm">
            <CardBody className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Filter size={24} className="text-amber-600 dark:text-amber-400" />
                <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  路径过滤
                </h4>
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
                        inputWrapper:
                          'shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
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
                  <p className="text-xs text-gray-500 mt-2 ml-1">
                    支持精确匹配（如 /api/ping）和前缀匹配（如 /health/）。匹配的路径将不会记录到历史。
                  </p>
                </div>
                
                <div className="flex-1 w-full bg-gray-50 dark:bg-gray-900/30 rounded-xl p-4 min-h-[100px]">
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
                    <div className="text-sm text-gray-400 italic text-center py-2">
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
