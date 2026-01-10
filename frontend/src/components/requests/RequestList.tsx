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
  Spinner,
  Badge,
  Select,
  SelectItem,
} from '@heroui/react';
import { Filter, RefreshCw, X, Eye, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/common';
import { RequestListItem, RequestFilters } from '@/types';
import { formatTimeWithMs, getStatusColor } from '@/utils';
import { PathAutocomplete } from './PathAutocomplete';
import { TransformFlowBadge } from './TransformFlowBadge';
import { PathCell } from './PathCell';

interface CustomPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * 自定义分页组件
 * 显示格式: [上一页] [1] [2] [3] ... [END-2] [END-1] [END] [下一页]
 */
const CustomPagination: React.FC<CustomPaginationProps> = ({ page, totalPages, onPageChange }) => {
  // 生成页码数组
  const getPages = () => {
    const pages: (number | string)[] = [];

    if (totalPages <= 7) {
      // 如果总页数小于等于7，显示所有页码
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // 总页数大于7，使用省略号策略
      if (page <= 4) {
        // 当前页在开头附近
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (page >= totalPages - 3) {
        // 当前页在结尾附近
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        // 当前页在中间
        pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
      }
    }

    return pages;
  };

  const pages = getPages();

  return (
    <div className="flex items-center gap-1 text-sm h-6">
      {/* 上一页 */}
      <Button
        size="sm"
        variant="light"
        onPress={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="min-w-6 h-6 px-1"
        isIconOnly
      >
        <ChevronLeft size={14} />
      </Button>

      {/* 页码 */}
      {pages.map((pageNum, index) => (
        <React.Fragment key={index}>
          {pageNum === '...' ? (
            <span className="px-1 text-tertiary">...</span>
          ) : (
            <Button
              size="sm"
              variant={pageNum === page ? 'flat' : 'light'}
              color={pageNum === page ? 'primary' : 'default'}
              onPress={() => onPageChange(pageNum as number)}
              className={`min-w-6 h-6 px-2 ${pageNum === page ? 'font-bold' : ''}`}
            >
              {pageNum}
            </Button>
          )}
        </React.Fragment>
      ))}

      {/* 下一页 */}
      <Button
        size="sm"
        variant="light"
        onPress={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="min-w-6 h-6 px-1"
        isIconOnly
      >
        <ChevronRight size={14} />
      </Button>
    </div>
  );
};

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
  selectedId = null,
  viewedIds = new Set(),
  onViewedToggle,
}) => {
  const suppressNextRowActionRef = useRef(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(selectedId ?? null);

  useEffect(() => {
    setActiveRowId(selectedId ?? null);
  }, [selectedId]);

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
      const id = key as string;
      setActiveRowId(id);
      onRowClick(id);
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
    return requests.map(request => ({
      ...request,
      _isViewed: viewedIds.has(request.id),
    }));
  }, [requests, viewedIds]);

  // 加载骨架屏
  if (isLoading && requests.length === 0) {
    return (
      <div className="space-y-md">
        <div className="flex gap-4">
          <div className="h-10 w-full bg-secondary dark:bg-secondary rounded-lg animate-pulse" />
          <div className="h-10 w-48 bg-secondary dark:bg-secondary rounded-lg animate-pulse" />
          <div className="h-10 w-24 bg-secondary dark:bg-secondary rounded-lg animate-pulse" />
        </div>
        <div className="space-y-sm">
          {[1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              className="h-16 w-full bg-secondary dark:bg-secondary rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-md">
      {/* 工具栏 - 始终显示 */}
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
          startContent={<Filter size={18} className="text-tertiary" />}
          classNames={{
            trigger:
              'shadow-sm bg-elevated dark:bg-elevated border border-subtle hover:border-subtle dark:hover:border-subtle transition-colors',
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
          className="shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
          radius="lg"
          startContent={<RefreshCw size={18} />}
        >
          刷新
        </Button>
      </div>

      {/* 空状态 - 仅在列表区域显示 */}
      {requests.length === 0 && !isLoading && (
        <EmptyState
          title="暂无请求"
          description="启动代理后，经过代理的请求将显示在这里"
          actionText="刷新"
          onAction={handleRefresh}
        />
      )}

      {/* 统计信息和分页 */}
      {requests.length > 0 && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-1">
          {/* 统计信息 */}
          <div className="flex items-center gap-2 text-sm text-tertiary h-6">
            <span>显示结果:</span>
            <Chip color="secondary" variant="flat" size="sm" className="h-5 text-xs flex items-center">
              {statsDisplay.showing} / {statsDisplay.total} 条
            </Chip>
            {localSearch && (
              <Button
                size="sm"
                variant="light"
                onPress={clearSearch}
                className="h-6 px-2 text-tertiary hover:text-primary dark:hover:text-primary"
                startContent={<X size={14} />}
              >
                清除搜索
              </Button>
            )}
          </div>

          {/* 完整分页 - 统计信息旁边 */}
          {totalPages > 1 && <CustomPagination page={page} totalPages={totalPages} onPageChange={onPageChange} />}
        </div>
      )}

      {/* 请求表格 - 仅在有数据时显示 */}
      {requests.length > 0 && (
        <Table
          aria-label="请求历史表"
          onRowAction={handleRowClick}
          classNames={{
            wrapper:
              'shadow-md rounded-xl border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/5 dark:from-elevated dark:to-brand-primary/10',
            th: 'bg-brand-primary/10 dark:bg-brand-primary/20 text-sm font-semibold',
            tr: 'hover:bg-brand-primary/5 dark:hover:bg-brand-primary/10 transition-colors',
            td: 'bg-transparent',
          }}
        >
          <TableHeader>
            <TableColumn className="w-w12 text-center">已查看</TableColumn>
            <TableColumn className="w-w1 text-center" aria-label="指示条">
              {' '}
            </TableColumn>
            <TableColumn className="w-40 text-center">时间</TableColumn>
            <TableColumn className="w-36 text-center">请求路径</TableColumn>
            <TableColumn className="w-64 max-w-80 text-left">路径</TableColumn>
            <TableColumn className="w-16 text-center">规则</TableColumn>
            <TableColumn className="text-center">状态</TableColumn>
            <TableColumn className="w-32 text-left">大小</TableColumn>
            <TableColumn className="w-24 text-center">耗时</TableColumn>
            <TableColumn className="w-20 text-center">操作</TableColumn>
          </TableHeader>
          <TableBody
            items={tableItems}
            isLoading={isLoading}
            emptyContent={<div className="py-12 text-center text-tertiary">暂无数据</div>}
          >
            {item => {
              const isSelected = activeRowId === item.id;
              const isViewed = item._isViewed;

              return (
                <TableRow
                  key={item.id}
                  className={[
                    'group transition-colors',
                    isSelected ? 'bg-accent/10 dark:bg-accent/20' : '',
                  ].join(' ')}
                >
                  {/* 已查看指示器 - 仅视觉显示 */}
                  <TableCell className="w-12 text-center">
                    {onViewedToggle ? (
                      <button
                        type="button"
                        aria-label={isViewed ? '取消已查看标记' : '标记为已查看'}
                        onPointerDown={() => {
                          suppressNextRowActionRef.current = true;
                        }}
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          onViewedToggle(item.id);
                        }}
                        className="w-8 h-8 inline-flex items-center justify-center select-none rounded hover:bg-secondary dark:hover:bg-secondary transition-colors"
                      >
                        <span
                          className={[
                            'w-3.5 h-3.5 rounded-full border-2 transition-colors',
                            isViewed
                              ? 'bg-accent border-accent dark:bg-accent dark:border-accent'
                              : 'bg-canvas dark:bg-secondary border-strong dark:border-strong',
                          ].join(' ')}
                        />
                      </button>
                    ) : (
                      <div className="w-8 h-8 inline-flex items-center justify-center select-none">
                        <span
                          className={[
                            'w-3.5 h-3.5 rounded-full border-2 transition-colors',
                            isViewed
                              ? 'bg-accent border-accent dark:bg-accent dark:border-accent'
                              : 'bg-canvas dark:bg-secondary border-strong dark:border-strong',
                          ].join(' ')}
                        />
                      </div>
                    )}
                  </TableCell>

                  {/* 强调色指示条 */}
                  <TableCell className="w-1 p-0 text-center">
                    {(isSelected || isViewed) && <div className="h-full w-1 bg-accent rounded-r" />}
                  </TableCell>

                  <TableCell className="w-40 text-sm font-mono text-xs text-primary dark:text-primary text-center">
                    {formatTimeWithMs(item.timestamp)}
                  </TableCell>
                  <TableCell className="text-center">
                    <TransformFlowBadge
                      fromClient={item.client}
                      toClient={item.supplierClient}
                      isSupplierRequest={!!item.supplierName}
                      transformerChain={item.transformerChain}
                      supplierName={item.supplierName}
                      size="md"
                    />
                  </TableCell>
                  <TableCell className="w-64 max-w-80">
                    <PathCell
                      originalPath={item.path}
                      transformedPath={item.transformedPath}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    {item.matchedRules && item.matchedRules.length > 0 ? (
                      <div className="flex items-center justify-center gap-1 text-status-success dark:text-status-success/80">
                        <span className="text-sm font-semibold">{item.matchedRules.length}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1 text-tertiary">
                        <span className="text-sm">-</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Chip
                      size="sm"
                      color={getStatusColor(item.responseStatus)}
                      variant="flat"
                      className="font-medium"
                    >
                      {item.responseStatus || 'N/A'}
                    </Chip>
                  </TableCell>
                  <TableCell className="w-48 text-sm text-primary dark:text-primary">
                    {item.requestSize || item.responseSize ? (
                      <span className="text-xs font-mono">
                        {item.requestSize && (
                          <span className="text-brand-primary dark:text-brand-primary">
                            ↑{(item.requestSize / 1024).toFixed(2)}KB
                          </span>
                        )}
                        {item.requestSize && item.responseSize && ' '}
                        {item.responseSize && (
                          <span className="text-status-success dark:text-status-success">
                            ↓{(item.responseSize / 1024).toFixed(2)}KB
                          </span>
                        )}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="w-24 text-sm text-primary dark:text-primary font-mono text-xs text-center">
                    {item.durationMs ? `${item.durationMs}ms` : '-'}
                  </TableCell>
                  <TableCell className="w-20 text-center">
                    <div className="flex gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity justify-start">
                      <Button
                        size="sm"
                        variant="light"
                        onPress={() => handleRowClick(item.id)}
                        className="text-brand-primary hover:bg-brand-primary/10 dark:hover:bg-brand-primary/10 min-w-8 h-8"
                        isIconOnly
                      >
                        <Eye size={16} />
                      </Button>
                      <Button
                        size="sm"
                        color="danger"
                        variant="light"
                        onPress={() => handleDelete(item.id)}
                        className="text-error hover:bg-secondary dark:hover:bg-secondary min-w-8 h-8"
                        isIconOnly
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            }}
          </TableBody>
        </Table>
      )}

      {/* 下方分页 - 当页数较少时显示，或当页数较多时显示在下方 */}
      {totalPages > 1 && requests.length > 0 && (
        <div className="flex justify-center mt-4">
          <CustomPagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
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
