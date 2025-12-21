import React, { useMemo, useCallback } from 'react';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Button,
  Input,
  Pagination,
  Spinner,
  Badge,
  Select,
  SelectItem,
} from '@heroui/react';
import { EmptyState } from '@/components/common';
import { RequestListItem, RequestFilters } from '@/types';
import { formatRelativeTime, formatDuration, getStatusColor, formatClient } from '@/utils';
import { RequestListVirtual } from './RequestListVirtual';

interface RequestListProps {
  requests: RequestListItem[];
  filters: RequestFilters;
  onFiltersChange: (filters: RequestFilters) => void;
  isLoading: boolean;
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  onRowClick: (id: string) => void;
  onRefresh: () => void;
  onDelete: (id: string) => void;
  enableVirtualScroll?: boolean;
}

/**
 * RequestList - 优化的请求列表组件
 * 使用 React.memo 避免不必要的重新渲染
 * 使用 useMemo 和 useCallback 优化计算和事件处理
 */
const RequestListComponent: React.FC<RequestListProps> = ({
  requests,
  filters,
  onFiltersChange,
  isLoading,
  total,
  page,
  onPageChange,
  onRowClick,
  onRefresh,
  onDelete,
  enableVirtualScroll = false,
}) => {
  // 使用 useMemo 优化分页计算
  const totalPages = useMemo(() => {
    return Math.ceil(total / 50);
  }, [total]);

  // 使用 useCallback 优化事件处理函数
  const handleSearchChange = useCallback(
    (value: string) => {
      onFiltersChange({ ...filters, search: value });
    },
    [filters, onFiltersChange],
  );

  // 处理客户端筛选变化
  const handleClientChange = useCallback(
    (value: string) => {
      const newFilters = { ...filters };
      if (value === 'all') {
        delete newFilters.client;
      } else {
        newFilters.client = value;
      }
      onFiltersChange(newFilters);
    },
    [filters, onFiltersChange],
  );

  // 清除搜索
  const clearSearch = useCallback(() => {
    const newFilters = { ...filters };
    delete newFilters.search;
    onFiltersChange(newFilters);
  }, [filters, onFiltersChange]);

  // 优化的行点击处理
  const handleRowClick = useCallback(
    (key: React.Key) => {
      onRowClick(key as string);
    },
    [onRowClick],
  );

  // 优化的删除处理
  const handleDelete = useCallback(
    (id: string) => {
      onDelete(id);
    },
    [onDelete],
  );

  // 优化的刷新处理
  const handleRefresh = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  // 使用 useMemo 优化统计信息的计算
  const statsDisplay = useMemo(() => {
    return {
      showing: requests.length,
      total: total,
    };
  }, [requests.length, total]);

  // 如果启用虚拟滚动，使用虚拟滚动组件
  if (enableVirtualScroll) {
    return (
      <RequestListVirtual
        requests={requests}
        filters={filters}
        onFiltersChange={onFiltersChange}
        isLoading={isLoading}
        total={total}
        page={page}
        onPageChange={onPageChange}
        onRowClick={onRowClick}
        onRefresh={onRefresh}
        onDelete={onDelete}
      />
    );
  }

  if (isLoading && requests.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner color="primary">加载请求中...</Spinner>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        title="暂无请求"
        description="启动代理后，经过代理的请求将显示在这里"
        actionText="刷新"
        onAction={handleRefresh}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <Input
          placeholder="🔍 搜索ID或路径..."
          value={filters.search || ''}
          onChange={e => handleSearchChange(e.target.value)}
          className="flex-1"
          radius="lg"
          classNames={{
            inputWrapper:
              'shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
          }}
        />

        <Select
          selectedKeys={[filters.client || 'all']}
          onChange={e => handleClientChange(e.target.value)}
          className="w-full md:w-48"
          radius="lg"
          classNames={{
            trigger:
              'shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
          }}
        >
          <SelectItem key="all">所有客户端</SelectItem>
          <SelectItem key="claude">Claude</SelectItem>
          <SelectItem key="codex">Codex</SelectItem>
          <SelectItem key="gemini">Gemini</SelectItem>
        </Select>

        <Button
          color="primary"
          onPress={handleRefresh}
          className="shadow-md hover:shadow-lg transition-shadow"
          radius="lg"
        >
          刷新
        </Button>
      </div>

      {/* 统计信息 */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>显示结果:</span>
        <Chip color="secondary" variant="flat" size="sm">
          {statsDisplay.showing} / {statsDisplay.total} 条
        </Chip>
        {filters.search && (
          <Button size="sm" variant="light" onPress={clearSearch} className="h-6 px-2">
            清除搜索
          </Button>
        )}
      </div>

      {/* 请求表格 */}
      <Table
        aria-label="请求历史表"
        selectionMode="single"
        onRowAction={handleRowClick}
        classNames={{
          wrapper: 'shadow-md rounded-xl border border-gray-200 dark:border-gray-700',
          th: 'bg-gray-50 dark:bg-gray-800 text-sm font-semibold',
          tr: 'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
        }}
      >
        <TableHeader>
          <TableColumn>时间</TableColumn>
          <TableColumn>客户端</TableColumn>
          <TableColumn>路径</TableColumn>
          <TableColumn>方法</TableColumn>
          <TableColumn>匹配规则</TableColumn>
          <TableColumn>状态</TableColumn>
          <TableColumn>耗时</TableColumn>
          <TableColumn>操作</TableColumn>
        </TableHeader>
        <TableBody
          items={requests}
          isLoading={isLoading}
          emptyContent={<div className="py-12 text-center text-gray-500">暂无数据</div>}
        >
          {item => (
            <TableRow key={item.id} className="cursor-pointer">
              <TableCell className="text-sm">{formatRelativeTime(item.timestamp)}</TableCell>
              <TableCell>
                <Badge color="primary" variant="flat" size="sm" className="font-medium">
                  {formatClient(item.client)}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="font-mono text-xs text-gray-600 dark:text-gray-400 truncate max-w-[200px] block">
                  {item.path}
                </span>
              </TableCell>
              <TableCell>
                <Chip size="sm" color="default" variant="flat" className="uppercase text-xs">
                  {item.method}
                </Chip>
              </TableCell>
              <TableCell>
                {item.matchedRules && item.matchedRules.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {item.matchedRules.slice(0, 3).map(ruleId => (
                      <Chip
                        key={ruleId}
                        size="sm"
                        color="success"
                        variant="flat"
                        className="text-xs font-mono"
                      >
                        {ruleId}
                      </Chip>
                    ))}
                    {item.matchedRules.length > 3 && (
                      <Chip size="sm" color="default" variant="flat" className="text-xs">
                        +{item.matchedRules.length - 3}
                      </Chip>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-400 text-sm">-</span>
                )}
              </TableCell>
              <TableCell>
                <Chip
                  size="sm"
                  color={getStatusColor(item.responseStatus)}
                  variant="flat"
                  className="font-medium"
                >
                  {item.responseStatus || 'N/A'}
                </Chip>
              </TableCell>
              <TableCell className="text-sm">
                {item.durationMs ? formatDuration(item.durationMs) : '-'}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="light"
                    onPress={() => handleRowClick(item.id)}
                    className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    查看
                  </Button>
                  <Button
                    size="sm"
                    color="danger"
                    variant="light"
                    onPress={() => handleDelete(item.id)}
                    className="hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    删除
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <Pagination
            total={totalPages}
            page={page}
            onChange={onPageChange}
            color="primary"
            showShadow={true}
            classNames={{
              wrapper: 'gap-1',
              item: 'min-w-9 h-9',
              cursor: 'shadow-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold',
            }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * 优化的 RequestList 组件，使用 React.memo 包裹
 * 避免当父组件重新渲染但 props 未变化时的不必要渲染
 */
export const RequestList = React.memo(RequestListComponent);
