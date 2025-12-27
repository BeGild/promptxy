/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - className="border-gray-100 dark:border-gray-800"
 * - className="text-gray-700 dark:text-gray-300"
 *
 * ✅ REQUIRED:
 * - className="border-subtle"
 * - className="text-primary dark:text-primary"
 */

import React, {
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
  CSSProperties,
  ReactElement,
} from 'react';
import { Input, Chip, Button, Spinner, Pagination, Badge, Select, SelectItem } from '@heroui/react';
import { List, ListImperativeAPI } from 'react-window';
import { EmptyState } from '@/components/common';
import { RequestListItem, RequestFilters } from '@/types';
import {
  formatTimeWithMs,
  formatBytes,
  formatDuration,
  getStatusColor,
  formatClient,
} from '@/utils';
import { PathAutocomplete } from './PathAutocomplete';

interface RequestListVirtualProps {
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

// Custom props for the row component
interface RowCustomProps {
  requests: RequestListItem[];
  onRowClick: (id: string) => void;
  onDelete: (id: string) => void;
  isScrolling: boolean;
  selectedId?: string | null;
  viewedIds?: Set<string>;
  onViewedToggle?: (id: string) => void;
}

/**
 * 虚拟滚动列表项渲染器
 */
interface VirtualRowProps {
  index: number;
  style: CSSProperties;
  requests: RequestListItem[];
  onRowClick: (id: string) => void;
  onDelete: (id: string) => void;
  isScrolling?: boolean;
  selectedId?: string | null;
  viewedIds?: Set<string>;
  onViewedToggle?: (id: string) => void;
}

const VirtualRow: React.FC<VirtualRowProps> = ({
  index,
  style,
  requests,
  onRowClick,
  onDelete,
  isScrolling,
  selectedId = null,
  viewedIds = new Set(),
  onViewedToggle,
}) => {
  const item = requests[index];

  if (!item) return null;

  const isSelected = selectedId === item.id;
  const isViewed = viewedIds.has(item.id);

  // 在快速滚动时，可以显示简化的占位符以提升性能
  if (isScrolling) {
    return (
      <div style={style} className="px-4 py-3 border-b border-subtle">
        <div className="flex items-center gap-3">
          <div className="w-24 h-4 bg-subtle rounded animate-pulse" />
          <div className="w-16 h-4 bg-subtle rounded animate-pulse" />
          <div className="flex-1 h-4 bg-subtle rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div
      style={style}
      className={`px-4 py-3 border-b border-subtle hover:bg-canvas dark:hover:bg-secondary/50 transition-colors cursor-pointer flex items-center gap-3 ${
        isSelected ? 'bg-accent-purple/10 dark:bg-accent-purple/20 hover:bg-accent-purple/20 dark:hover:bg-accent-purple/30' : ''
      }`}
      onClick={() => onRowClick(item.id)}
    >
      {/* 复选框 */}
      <div className="w-12">
        {onViewedToggle && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onViewedToggle(item.id);
            }}
            aria-label={isViewed ? '取消已查看标记' : '标记为已查看'}
            className="w-8 h-8 inline-flex items-center justify-center rounded hover:bg-canvas dark:hover:bg-secondary/60 transition-colors"
          >
            <span
              className={[
                'w-3.5 h-3.5 rounded-full border-2 transition-colors',
                isViewed
                  ? 'bg-accent-purple border-accent-purple dark:bg-accent-purple/80 dark:border-accent-purple/80'
                  : 'bg-transparent border-subtle',
              ].join(' ')}
            />
          </button>
        )}
      </div>

      {/* 紫色指示条 */}
      {(isSelected || isViewed) && (
        <div className="w-1 h-full bg-accent-purple rounded-r flex-shrink-0" />
      )}

      {/* 时间 */}
      <div className="w-24 text-xs font-mono text-primary">
        {formatTimeWithMs(item.timestamp)}
      </div>

      {/* 客户端 */}
      <div className="w-16">
        <span className="text-xs font-medium text-primary">
          {formatClient(item.client)}
        </span>
      </div>

      {/* 路径 */}
      <div className="flex-1 min-w-0">
        <span className="font-mono text-xs text-primary truncate block">
          {item.path}
        </span>
      </div>

      {/* 匹配规则 */}
      <div className="w-24">
        {item.matchedRules && item.matchedRules.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {item.matchedRules.slice(0, 2).map((ruleId: string) => (
              <Chip
                key={ruleId}
                size="sm"
                color="success"
                variant="flat"
                className="text-[10px] font-mono"
              >
                {ruleId}
              </Chip>
            ))}
            {item.matchedRules.length > 2 && (
              <Chip size="sm" color="default" variant="flat" className="text-[10px]">
                +{item.matchedRules.length - 2}
              </Chip>
            )}
          </div>
        ) : (
          <span className="text-tertiary text-xs">-</span>
        )}
      </div>

      {/* 状态 */}
      <div className="w-16">
        <Chip
          size="sm"
          color={getStatusColor(item.responseStatus)}
          variant="flat"
          className="font-medium text-xs"
        >
          {item.responseStatus || 'N/A'}
        </Chip>
      </div>

      {/* 大小 */}
      <div className="w-24 text-xs text-primary">
        {item.requestSize || item.responseSize ? (
          <span>
            {item.requestSize && (
              <span className="text-brand-primary">
                ↑{formatBytes(item.requestSize)}
              </span>
            )}
            {item.requestSize && item.responseSize && ' '}
            {item.responseSize && (
              <span className="text-status-success">
                ↓{formatBytes(item.responseSize)}
              </span>
            )}
          </span>
        ) : (
          '-'
        )}
      </div>

      {/* 耗时 */}
      <div className="w-16 text-xs text-primary text-center">
        {item.durationMs ? formatDuration(item.durationMs) : '-'}
      </div>

      {/* 操作 */}
      <div className="w-auto">
        <div className="flex gap-1 items-center">
          <Button
            size="sm"
            variant="light"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onPress={(e: any) => {
              e.stopPropagation();
              onRowClick(item.id);
            }}
            className="text-brand-primary hover:bg-brand-primary/10 dark:hover:bg-brand-primary/20 text-xs px-2 h-7"
          >
            查看
          </Button>
          <Button
            size="sm"
            color="danger"
            variant="light"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onPress={(e: any) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            className="hover:bg-status-error/10 dark:hover:bg-status-error/20 text-xs px-2 h-7"
          >
            删除
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * RequestListVirtual - 虚拟滚动优化的请求列表组件
 * 使用 react-window 实现虚拟滚动，只渲染可见区域的列表项
 */
const RequestListVirtualComponent: React.FC<RequestListVirtualProps> = ({
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
  // 搜索状态
  const [localSearch, setLocalSearch] = useState(filters.search || '');
  const [isScrolling, setIsScrolling] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<ListImperativeAPI | null>(null);

  // 分页计算
  const totalPages = useMemo(() => {
    return Math.ceil(total / 50);
  }, [total]);

  // 滚动到顶部 - 需要先定义，因为其他函数会使用它
  const scrollToTop = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToRow({ index: 0, align: 'start' });
    }
    setIsScrolling(false);
  }, []);

  // 滚动处理 - 使用 onRowsRendered 来检测滚动
  const handleRowsRendered = useCallback(
    (
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _visibleRows: { startIndex: number; stopIndex: number },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _allRows: { startIndex: number; stopIndex: number },
    ) => {
      // 当可见行范围变化时，我们假设用户正在滚动
      setIsScrolling(true);

      // 清除之前的定时器
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }

      // 设置新的防抖定时器
      scrollTimerRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    },
    [],
  );

  // 事件处理函数
  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      setIsSearching(true);

      // 清除之前的定时器
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }

      // 设置新的防抖定时器
      searchTimerRef.current = setTimeout(() => {
        onFiltersChange({ ...filters, search: value });
        setIsSearching(false);
      }, 300);
    },
    [filters, onFiltersChange],
  );

  const handleClientChange = useCallback(
    (value: string) => {
      const newFilters = { ...filters };
      if (value === 'all') {
        delete newFilters.client;
      } else {
        newFilters.client = value;
      }
      onFiltersChange(newFilters);
      // 切换筛选时滚动到顶部
      scrollToTop();
    },
    [filters, onFiltersChange, scrollToTop],
  );

  const clearSearch = useCallback(() => {
    setLocalSearch('');
    setIsSearching(false);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    const newFilters = { ...filters };
    delete newFilters.search;
    onFiltersChange(newFilters);
    scrollToTop();
  }, [filters, onFiltersChange, scrollToTop]);

  const handleRefresh = useCallback(() => {
    onRefresh();
    scrollToTop();
  }, [onRefresh, scrollToTop]);

  // 统计信息
  const statsDisplay = useMemo(() => {
    return {
      showing: requests.length,
      total: total,
    };
  }, [requests.length, total]);

  // 列表容器高度和宽度计算
  const containerHeight = useMemo(() => {
    // 根据屏幕高度动态计算
    const viewportHeight = window.innerHeight;
    const headerHeight = 200; // 工具栏和统计信息高度
    const paginationHeight = totalPages > 1 ? 80 : 20;
    const maxHeight = viewportHeight - headerHeight - paginationHeight;
    return Math.max(300, Math.min(600, maxHeight));
  }, [totalPages]);

  const containerWidth = useMemo(() => {
    // 获取父容器宽度，或使用默认值
    if (typeof window !== 'undefined') {
      return Math.min(window.innerWidth - 64, 1200); // 考虑边距和最大宽度
    }
    return 800;
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  // 渲染头部（工具栏和统计）
  const renderHeader = () => (
    <>
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
              'shadow-sm bg-elevated dark:bg-elevated border border-subtle',
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
      <div className="flex items-center gap-2 text-sm text-secondary">
        <span>显示结果:</span>
        <Chip color="secondary" variant="flat" size="sm">
          {statsDisplay.showing} / {statsDisplay.total} 条
        </Chip>
        {localSearch && (
          <Button size="sm" variant="light" onPress={clearSearch} className="h-6 px-2">
            清除搜索
          </Button>
        )}
        {isScrolling && <span className="text-xs text-tertiary ml-auto">滚动中...</span>}
      </div>
    </>
  );

  // 渲染虚拟列表
  const renderVirtualList = () => {
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

    // 表头（固定显示）
    const tableHeader = (
      <div className="bg-canvas dark:bg-secondary border-b border-subtle px-4 py-2 text-xs font-semibold text-secondary">
        <div className="flex items-center gap-3">
          <div className="w-12">已查看</div>
          <div className="w-24">时间</div>
          <div className="w-16">客户端</div>
          <div className="flex-1">路径</div>
          <div className="w-24">匹配规则</div>
          <div className="w-16">状态</div>
          <div className="w-24">大小</div>
          <div className="w-16 text-center">耗时</div>
          <div className="w-auto">操作</div>
        </div>
      </div>
    );

    // Row component for the new List API
    const RowComponent = (
      props: {
        ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
        index: number;
        style: CSSProperties;
      } & RowCustomProps,
    ): ReactElement => {
      const { index, style, requests, onRowClick, onDelete, isScrolling, selectedId, viewedIds, onViewedToggle } = props;
      return (
        <VirtualRow
          index={index}
          style={style}
          requests={requests}
          onRowClick={onRowClick}
          onDelete={onDelete}
          isScrolling={isScrolling}
          selectedId={selectedId}
          viewedIds={viewedIds}
          onViewedToggle={onViewedToggle}
        />
      );
    };

    return (
      <div className="border border-subtle rounded-xl overflow-hidden shadow-md">
        {tableHeader}
        <div style={{ height: containerHeight }}>
          <List
            listRef={listRef}
            rowCount={requests.length}
            rowHeight={64}
            overscanCount={5}
            onRowsRendered={handleRowsRendered}
            rowComponent={RowComponent}
            rowProps={
              {
                requests,
                onRowClick,
                onDelete,
                isScrolling: isScrolling || false,
                selectedId,
                viewedIds,
                onViewedToggle,
              } as RowCustomProps
            }
            style={{ height: containerHeight, width: containerWidth }}
          />
        </div>
      </div>
    );
  };

  // 渲染分页
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
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
            cursor: 'shadow-lg bg-gradient-to-r from-accent-purple to-accent-pink text-white font-bold',
          }}
        />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {renderHeader()}
      {renderVirtualList()}
      {renderPagination()}
    </div>
  );
};

/**
 * 优化的虚拟滚动 RequestList 组件，使用 React.memo 包裹
 */
export const RequestListVirtual = React.memo(RequestListVirtualComponent);
