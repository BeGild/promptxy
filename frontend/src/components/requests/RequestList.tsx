import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
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
import {
  formatTimeWithMs,
  formatBytes,
  formatDuration,
  getStatusColor,
  formatClient,
} from '@/utils';
import { RequestListVirtual } from './RequestListVirtual';
import { PathAutocomplete } from './PathAutocomplete';

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
  selectedId?: string | null;
  viewedIds?: Set<string>;
  onViewedToggle?: (id: string) => void;
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
  selectedId = null,
  viewedIds = new Set(),
  onViewedToggle,
}) => {
  const suppressNextRowActionRef = useRef(false);

  // 使用 useMemo 优化分页计算
  const totalPages = useMemo(() => {
    return Math.ceil(total / 50);
  }, [total]);

  // 本地搜索状态（用于防抖）
  const [localSearch, setLocalSearch] = useState(filters.search || '');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // 当外部 filters 变化时同步本地状态
  useEffect(() => {
    setLocalSearch(filters.search || '');
  }, [filters.search]);

  // 使用 useCallback 优化事件处理函数，带 300ms 防抖
  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      setIsSearching(true);

      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }

      searchTimerRef.current = setTimeout(() => {
        onFiltersChange({ ...filters, search: value });
        setIsSearching(false);
      }, 300);
    },
    [filters, onFiltersChange],
  );

  // 清理定时器
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

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
    setLocalSearch('');
    setIsSearching(false);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    const newFilters = { ...filters };
    delete newFilters.search;
    onFiltersChange(newFilters);
  }, [filters, onFiltersChange]);

  // 优化的行点击处理
  const handleRowClick = useCallback(
    (key: React.Key) => {
      if (suppressNextRowActionRef.current) {
        suppressNextRowActionRef.current = false;
        return;
      }
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

  type RequestTableItem = RequestListItem & { _isViewed: boolean };
  const tableItems = useMemo<RequestTableItem[]>(() => {
    if (enableVirtualScroll) return [];
    return requests.map((request) => ({
      ...request,
      _isViewed: viewedIds.has(request.id),
    }));
  }, [enableVirtualScroll, requests, viewedIds]);

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
        selectedId={selectedId}
        viewedIds={viewedIds}
        onViewedToggle={onViewedToggle}
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
        <PathAutocomplete
          value={localSearch}
          onChange={handleSearchChange}
          isLoading={isSearching}
          className="flex-1"
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
        {localSearch && (
          <Button size="sm" variant="light" onPress={clearSearch} className="h-6 px-2">
            清除搜索
          </Button>
        )}
      </div>

	      {/* 请求表格 */}
	      <Table
	        aria-label="请求历史表"
	        onRowAction={handleRowClick}
	        classNames={{
	          wrapper: 'shadow-md rounded-xl border border-gray-200 dark:border-gray-700',
	          th: 'bg-gray-50 dark:bg-gray-800 text-sm font-semibold',
	          tr: 'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
	        }}
	      >
		        <TableHeader>
		          <TableColumn className="w-12">已查看</TableColumn>
		          <TableColumn className="w-1" aria-label="指示条">
		            {' '}
		          </TableColumn>
		          <TableColumn>时间</TableColumn>
		          <TableColumn>客户端</TableColumn>
		          <TableColumn>路径</TableColumn>
		          <TableColumn>匹配规则</TableColumn>
	          <TableColumn>状态</TableColumn>
	          <TableColumn>大小</TableColumn>
	          <TableColumn>耗时</TableColumn>
	          <TableColumn>操作</TableColumn>
	        </TableHeader>
	        <TableBody
	          items={tableItems}
	          isLoading={isLoading}
	          emptyContent={<div className="py-12 text-center text-gray-500">暂无数据</div>}
	        >
	          {item => {
	            const isSelected = selectedId === item.id;
	            const isViewed = item._isViewed;

	            return (
	              <TableRow key={item.id}>
	                {/* 已查看指示器 - 仅视觉显示 */}
	                <TableCell className={`w-12 ${isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}>
	                  {onViewedToggle ? (
	                    <button
	                      type="button"
	                      aria-label={isViewed ? '取消已查看标记' : '标记为已查看'}
	                      onPointerDown={() => {
	                        suppressNextRowActionRef.current = true;
	                      }}
	                      onClick={(e) => {
	                        e.preventDefault();
	                        e.stopPropagation();
	                        onViewedToggle(item.id);
	                      }}
	                      className="w-8 h-8 inline-flex items-center justify-center select-none rounded hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors"
	                    >
	                      <span
	                        className={[
	                          'w-3.5 h-3.5 rounded-full border-2 transition-colors',
	                          isViewed
	                            ? 'bg-purple-600 border-purple-600 dark:bg-purple-400 dark:border-purple-400'
	                            : 'bg-transparent border-gray-300 dark:border-gray-600',
	                        ].join(' ')}
	                      />
	                    </button>
	                  ) : (
	                    <div className="w-8 h-8 inline-flex items-center justify-center select-none">
	                      <span
	                        className={[
	                          'w-3.5 h-3.5 rounded-full border-2 transition-colors',
	                          isViewed
	                            ? 'bg-purple-600 border-purple-600 dark:bg-purple-400 dark:border-purple-400'
	                            : 'bg-transparent border-gray-300 dark:border-gray-600',
	                        ].join(' ')}
	                      />
	                    </div>
	                  )}
	                </TableCell>

                {/* 紫色指示条 */}
                <TableCell className={`w-1 p-0 ${isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}>
                  {(isSelected || isViewed) && (
                    <div className="h-full w-1 bg-purple-500 rounded-r" />
                  )}
                </TableCell>

                <TableCell className={`text-sm font-mono text-xs text-gray-700 dark:text-gray-300 ${isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}>
                  {formatTimeWithMs(item.timestamp)}
                </TableCell>
                <TableCell className={isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : ''}>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {formatClient(item.client)}
                  </span>
                </TableCell>
                <TableCell className={isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : ''}>
                  <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate max-w-[200px] block">
                    {item.path}
                  </span>
                </TableCell>
                <TableCell className={isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : ''}>
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
                <TableCell className={isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : ''}>
                  <Chip
                    size="sm"
                    color={getStatusColor(item.responseStatus)}
                    variant="flat"
                    className="font-medium"
                  >
                    {item.responseStatus || 'N/A'}
                  </Chip>
                </TableCell>
                <TableCell className={`text-sm text-gray-700 dark:text-gray-300 ${isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}>
                  {item.requestSize || item.responseSize ? (
                    <span className="text-xs">
                      {item.requestSize && (
                        <span className="text-blue-600 dark:text-blue-400">
                          ↑{formatBytes(item.requestSize)}
                        </span>
                      )}
                      {item.requestSize && item.responseSize && ' '}
                      {item.responseSize && (
                        <span className="text-green-600 dark:text-green-400">
                          ↓{formatBytes(item.responseSize)}
                        </span>
                      )}
                    </span>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell className={`text-sm text-gray-700 dark:text-gray-300 ${isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}>
                  {item.durationMs ? formatDuration(item.durationMs) : '-'}
                </TableCell>
	                <TableCell className={isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : ''}>
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
            );
          }}
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
