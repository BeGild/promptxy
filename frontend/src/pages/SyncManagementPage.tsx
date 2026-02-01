/**
 * 同步管理页面
 *
 * STYLESYSTEM COMPLIANCE: 使用 Tailwind 语义类名和 CSS 变量
 */

import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  Save,
  Settings,
  History,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Database,
  DollarSign,
  List,
} from 'lucide-react';
import { Button } from '@heroui/react';
import {
  getSyncConfig,
  updateSyncConfig,
  getSyncStatus,
  getSyncLogs,
  syncPrices,
  syncModels,
  triggerSync,
} from '@/api/sync';
import type { SyncConfig, SyncStatus, SyncLog } from '@/types/sync';

const SyncManagementPageComponent: React.FC = () => {
  const queryClient = useQueryClient();

  // 获取同步配置
  const {
    data: config,
    isLoading: configLoading,
  } = useQuery({
    queryKey: ['sync', 'config'],
    queryFn: getSyncConfig,
    refetchInterval: false,
  });

  // 获取同步状态
  const {
    data: status,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['sync', 'status'],
    queryFn: getSyncStatus,
    refetchInterval: 5000, // 每5秒刷新状态
  });

  // 获取同步日志
  const {
    data: logsData,
  } = useQuery({
    queryKey: ['sync', 'logs'],
    queryFn: () => getSyncLogs(20),
    refetchInterval: 10000, // 每10秒刷新日志
  });

  const logs = logsData?.logs || [];

  // 配置状态
  const [editConfig, setEditConfig] = useState<SyncConfig | null>(null);

  // 同步操作 mutations
  const syncPricesMutation = useMutation({
    mutationFn: syncPrices,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync'] });
    },
  });

  const syncModelsMutation = useMutation({
    mutationFn: syncModels,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync'] });
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: () => triggerSync('all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync'] });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: updateSyncConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync'] });
    },
  });

  // 初始化编辑状态
  useEffect(() => {
    if (config && !editConfig) {
      setEditConfig({ ...config });
    }
  }, [config, editConfig]);

  // 格式化时间戳
  const formatTime = (timestamp?: number): string => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  // 格式化持续时间
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // 获取状态图标
  const getStatusIcon = (status: 'success' | 'failed' | 'partial') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-success-default" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-danger-default" />;
      case 'partial':
        return <AlertCircle className="w-4 h-4 text-warning-default" />;
    }
  };

  // 保存配置
  const handleSaveConfig = async () => {
    if (!editConfig) return;
    await updateConfigMutation.mutateAsync(editConfig);
  };

  if (configLoading || !config || !editConfig) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  const syncing = status?.syncing || false;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-primary to-accent bg-clip-text text-transparent">
            数据同步
          </h1>
          <p className="text-sm text-secondary mt-1">管理模型价格和列表的自动同步</p>
        </div>
      </div>

      {/* 同步配置 */}
      <div className="bg-elevated rounded-lg p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-brand-primary" />
          <h2 className="text-lg font-semibold">同步配置</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 启用自动同步 */}
          <div className="flex items-center justify-between">
            <label className="text-sm">启用自动同步</label>
            <input
              type="checkbox"
              checked={editConfig.enabled}
              onChange={(e) => setEditConfig({ ...editConfig, enabled: e.target.checked })}
              className="w-4 h-4"
            />
          </div>

          {/* 同步间隔 */}
          <div className="flex items-center justify-between">
            <label className="text-sm">同步间隔</label>
            <select
              value={editConfig.intervalHours.toString()}
              onChange={(e) => setEditConfig({ ...editConfig, intervalHours: parseInt(e.target.value) })}
              className="bg-surface border border-border rounded px-3 py-1 text-sm"
            >
              <option value="1">每小时</option>
              <option value="6">每6小时</option>
              <option value="12">每12小时</option>
              <option value="24">每天</option>
              <option value="168">每周</option>
            </select>
          </div>

          {/* 具体时间 */}
          <div className="flex items-center justify-between">
            <label className="text-sm">具体时间</label>
            <input
              type="time"
              value={editConfig.syncTime || ''}
              onChange={(e) => setEditConfig({ ...editConfig, syncTime: e.target.value })}
              className="bg-surface border border-border rounded px-3 py-1 text-sm"
            />
          </div>

          {/* 最大重试 */}
          <div className="flex items-center justify-between">
            <label className="text-sm">最大重试次数</label>
            <input
              type="number"
              min="0"
              max="10"
              value={editConfig.maxRetries}
              onChange={(e) => setEditConfig({ ...editConfig, maxRetries: parseInt(e.target.value) || 0 })}
              className="bg-surface border border-border rounded px-3 py-1 text-sm w-20"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            color="primary"
            variant="flat"
            size="sm"
            startContent={<Save className="w-4 h-4" />}
            onPress={handleSaveConfig}
            isDisabled={updateConfigMutation.isPending}
          >
            {updateConfigMutation.isPending ? '保存中...' : '保存配置'}
          </Button>
        </div>
      </div>

      {/* 手动触发 */}
      <div className="bg-elevated rounded-lg p-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">手动触发</h2>
            <p className="text-sm text-secondary mt-1">
              上次同步: {formatTime(status?.lastSyncTime)}
            </p>
          </div>
          {status?.lastSyncResult && (
            <div className="flex items-center gap-2 text-sm">
              {getStatusIcon(status.lastSyncResult.status)}
              <span>
                {status.lastSyncResult.recordsCount} 条记录
                ({formatDuration(status.lastSyncResult.duration)})
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            color="primary"
            variant="flat"
            size="sm"
            startContent={<DollarSign className="w-4 h-4" />}
            onPress={() => syncPricesMutation.mutate()}
            isDisabled={syncing || syncPricesMutation.isPending}
            isLoading={syncPricesMutation.isPending}
          >
            同步价格
          </Button>

          <Button
            color="primary"
            variant="flat"
            size="sm"
            startContent={<List className="w-4 h-4" />}
            onPress={() => syncModelsMutation.mutate()}
            isDisabled={syncing || syncModelsMutation.isPending}
            isLoading={syncModelsMutation.isPending}
          >
            同步模型列表
          </Button>

          <Button
            color="primary"
            size="sm"
            startContent={<RefreshCw className="w-4 h-4" />}
            onPress={() => syncAllMutation.mutate()}
            isDisabled={syncing || syncAllMutation.isPending}
            isLoading={syncAllMutation.isPending}
          >
            {syncing ? '同步中...' : '同步全部'}
          </Button>
        </div>
      </div>

      {/* 同步日志 */}
      <div className="bg-elevated rounded-lg p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-brand-primary" />
          <h2 className="text-lg font-semibold">同步日志</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3">时间</th>
                <th className="text-left py-2 px-3">类型</th>
                <th className="text-left py-2 px-3">状态</th>
                <th className="text-left py-2 px-3">记录数</th>
                <th className="text-left py-2 px-3">耗时</th>
                <th className="text-left py-2 px-3">错误</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-secondary">
                    暂无同步日志
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-border hover:bg-surface/50">
                    <td className="py-2 px-3">{formatTime(log.startedAt)}</td>
                    <td className="py-2 px-3">
                      {log.type === 'price' ? '价格' : '模型列表'}
                    </td>
                    <td className="py-2 px-3">{getStatusIcon(log.status)}</td>
                    <td className="py-2 px-3">{log.recordsCount.toLocaleString()}</td>
                    <td className="py-2 px-3">
                      {log.finishedAt ? formatDuration(log.finishedAt - log.startedAt) : '-'}
                    </td>
                    <td className="py-2 px-3 text-danger-default truncate max-w-xs">
                      {log.errorMessage || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const SyncManagementPage = React.memo(SyncManagementPageComponent);
