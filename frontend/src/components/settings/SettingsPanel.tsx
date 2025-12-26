import React, { useState, useEffect } from 'react';
import { Card, CardBody, Button, Input, Badge, Spinner, Divider, Chip } from '@heroui/react';
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
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Spinner color="primary">加载配置中...</Spinner>
        </div>
      ) : (
        <>
          {/* 统计信息 */}
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardBody className="space-y-3">
              <h4 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                📊 统计信息
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">总请求数:</span>
                  <Badge color="primary" variant="flat" size="sm" className="font-bold">
                    {stats?.total || 0}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">今日请求:</span>
                  <Badge color="success" variant="flat" size="sm" className="font-bold">
                    {stats?.recent || 0}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">按客户端:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {stats?.byClient &&
                      Object.entries(stats.byClient).map(([client, count]) => (
                        <Badge
                          key={client}
                          color="secondary"
                          variant="flat"
                          size="sm"
                          className="font-medium"
                        >
                          {formatClient(client)}: {count}
                        </Badge>
                      ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">数据库路径:</span>
                  <div className="font-mono text-xs text-gray-600 dark:text-gray-400 break-all mt-1 bg-gray-50 dark:bg-gray-900/30 p-2 rounded">
                    {stats?.database?.path}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">数据库大小:</span>
                  <Badge color="warning" variant="flat" size="sm" className="font-bold">
                    {stats?.database?.size ? formatBytes(stats.database.size) : '0 B'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">记录数:</span>
                  <Badge color="default" variant="flat" size="sm" className="font-bold">
                    {stats?.database?.recordCount || 0}
                  </Badge>
                </div>
              </div>
            </CardBody>
          </Card>

          <Divider />

          {/* 供应商管理 */}
          <SupplierManagement />

          <Divider />

          {/* 配置管理 */}
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardBody className="space-y-3">
              <h4 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                ⚙️ 配置管理
              </h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  color="primary"
                  variant="flat"
                  onPress={handleExport}
                  radius="lg"
                  className="shadow-md hover:shadow-lg transition-shadow"
                >
                  {exportMutation.isPending ? '导出中...' : '导出配置'}
                </Button>
                <Button
                  color="secondary"
                  variant="flat"
                  onPress={handleImport}
                  radius="lg"
                  className="shadow-md hover:shadow-lg transition-shadow"
                >
                  {importMutation.isPending ? '导入中...' : '导入配置'}
                </Button>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/30 p-3 rounded-lg">
                💡 导出包含所有规则配置，导入会覆盖当前规则。
              </div>
            </CardBody>
          </Card>

          <Divider />

          {/* 数据清理 */}
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardBody className="space-y-3">
              <h4 className="text-lg font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                🗑️ 数据清理
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <Input
                    label="保留最近条数"
                    placeholder="100"
                    value={keepCount}
                    onChange={e => setKeepCount(e.target.value)}
                    onBlur={handleKeepCountBlur}
                    radius="lg"
                    classNames={{
                      inputWrapper:
                        'shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
                    }}
                  />
                </div>
                <Button
                  color="danger"
                  variant="flat"
                  onPress={handleCleanup}
                  radius="lg"
                  className="shadow-md hover:shadow-lg transition-shadow"
                >
                  {cleanupMutation.isPending ? '清理中...' : '清理'}
                </Button>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/30 p-3 rounded-lg">
                ⏰ 自动清理: 每小时清理一次，保留最近 {keepCount} 条（可在上方修改）
              </div>
            </CardBody>
          </Card>

          <Divider />

          {/* 路径过滤 */}
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardBody className="space-y-3">
              <h4 className="text-lg font-bold bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">
                🔍 路径过滤
              </h4>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    label="添加过滤路径"
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
                    description="支持精确匹配（如 /api/ping）和前缀匹配（如 /health/）"
                  />
                  <Button
                    color="warning"
                    variant="flat"
                    onPress={handleAddFilteredPath}
                    radius="lg"
                    className="shadow-md hover:shadow-lg transition-shadow self-end"
                    isDisabled={!newPath.trim()}
                  >
                    添加
                  </Button>
                </div>

                {filteredPaths.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600 dark:text-gray-400">已过滤的路径:</div>
                    <div className="flex flex-wrap gap-2">
                      {filteredPaths.map(path => (
                        <Chip
                          key={path}
                          color="warning"
                          variant="flat"
                          onClose={() => handleRemoveFilteredPath(path)}
                          classNames={{
                            base: 'shadow-sm',
                            content: 'font-mono text-sm',
                          }}
                        >
                          {path}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/30 p-3 rounded-lg">
                  💡 匹配的路径将不会记录到请求历史中，常用于过滤健康检查等高频请求。
                </div>
              </div>
            </CardBody>
          </Card>

          <Divider />

          {/* 关于 */}
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardBody className="space-y-2">
              <h4 className="text-lg font-bold bg-gradient-to-r from-gray-600 to-gray-800 dark:from-gray-400 dark:to-gray-200 bg-clip-text text-transparent">
                ℹ️ 关于
              </h4>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 dark:text-gray-100">PromptXY v2.0</span>
                  <span>- 本地HTTP代理规则管理器</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">功能:</span>
                  <span>规则管理、请求捕获、实时监控、差异对比</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">端口:</span>
                  <Badge color="primary" variant="flat" size="sm">
                    Gateway(7070)
                  </Badge>
                  <span>|</span>
                  <Badge color="primary" variant="flat" size="sm">
                    API(7071)
                  </Badge>
                </div>
              </div>
            </CardBody>
          </Card>
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
