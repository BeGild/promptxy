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

import React, {
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
  CSSProperties,
  ReactElement,
} from 'react';
import { Chip, Button, Spinner, Pagination, Select, SelectItem } from '@heroui/react';
import { Eye, Trash2 } from 'lucide-react';
import { List, ListImperativeAPI } from 'react-window';
import { EmptyState } from '@/components/common';
import { RequestListItem, RequestFilters } from '@/types';
import {
  formatTimeWithMs,
  formatBytes,
  formatDuration,
  getStatusColor,
  formatClient,
  getClientColorStyle,
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
  selectedId?: string | null;
  viewedIds?: Set<string>;
  onViewedToggle?: (id: string) => void;
}

/**
 * 虚拟滚动列表项渲染器
 * 使用 CSS table 布局确保表头和内容列宽严格对齐
 */
interface VirtualRowProps {
  index: number;
  style: CSSProperties;
  requests: RequestListItem[];
  onRowClick: (id: string) => void;
  onDelete: (id: string) => void;
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
  selectedId = null,
  viewedIds = new Set(),
  onViewedToggle,
}) => {
  const item = requests[index];

  if (!item) return null;

  const isSelected = selectedId === item.id;
  const isViewed = viewedIds.has(item.id);

  return (
    <div
      style={style}
      className={`w-full px-4 py-3 border-b border-subtle hover:bg-canvas dark:hover:bg-secondary/50 transition-colors cursor-pointer ${
        isSelected
          ? 'bg-accent/10 dark:bg-accent/20 hover:bg-accent/20 dark:hover:bg-accent/30'
          : ''
      }`}
      onClick={() => onRowClick(item.id)}
    >
      {/* 使用 table 布局确保列宽与表头完全一致 */}
      <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
        <colgroup><col style={{ width: '42px' }} /><col style={{ width: '176px' }} /><col style={{ width: '84px' }} /><col style={{ width: '224px' }} /><col style={{ width: '48px' }} /><col style={{ width: '64px' }} /><col style={{ width: '128px' }} /><col style={{ width: '96px' }} /><col style={{ width: '80px' }} /></colgroup>
        <tbody>
          <tr>
            {/* 已查看按钮 */}
            <td className="text-center">
              {onViewedToggle && (
                <button
                  type="button"
                  onClick={e => {
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
                        ? 'bg-accent border-accent dark:bg-accent/80 dark:border-accent/80'
                        : 'bg-transparent border-subtle',
                    ].join(' ')}
                  />
                </button>
              )}
            </td>

            {/* 时间 */}
            <td className="text-xs font-mono text-primary text-center">
              {formatTimeWithMs(item.timestamp)}
            </td>

            {/* 客户端 */}
            <td className="text-center">
              <Chip
                size="sm"
                variant="flat"
                className="font-medium text-xs"
                style={getClientColorStyle(item.client)}
              >
                {formatClient(item.client)}
              </Chip>
            </td>

            {/* 路径 */}
            <td className="font-mono text-xs text-primary text-left truncate" title={item.path}>
              {item.path}
            </td>

            {/* 规则 */}
            <td className="overflow-hidden text-center">
              {item.matchedRules && item.matchedRules.length > 0 ? (
                <div className="flex items-center justify-center gap-1 text-status-success dark:text-status-success/80">
                  <span className="text-xs font-semibold">{item.matchedRules.length}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1 text-tertiary">
                  <span className="text-xs">-</span>
                </div>
              )}
            </td>

            {/* 状态 */}
            <td className="overflow-hidden text-center">
              <Chip
                size="sm"
                color={getStatusColor(item.responseStatus)}
                variant="flat"
                className="font-medium text-xs"
              >
                {item.responseStatus || 'N/A'}
              </Chip>
            </td>

            {/* 大小 */}
            <td className="text-xs text-primary text-left truncate font-mono">
              {item.requestSize || item.responseSize ? (
                <span>
                  {item.requestSize && (
                    <span className="text-brand-primary">
                      ↑{(item.requestSize / 1024).toFixed(2)}KB
                    </span>
                  )}
                  {item.requestSize && item.responseSize && ' '}
                  {item.responseSize && (
                    <span className="text-status-success">
                      ↓{(item.responseSize / 1024).toFixed(2)}KB
                    </span>
                  )}
                </span>
              ) : (
                '-'
              )}
            </td>

            {/* 耗时 */}
            <td className="text-xs text-primary text-center truncate font-mono">
              {item.durationMs ? `${item.durationMs}ms` : '-'}
            </td>

            {/* 操作 */}
            <td className="text-center">
              <div className="flex gap-0.5 items-center justify-start">
                <Button
                  size="sm"
                  variant="light"
                  onPress={(e: any) => {
                    e.stopPropagation();
                    onRowClick(item.id);
                  }}
                  className="text-brand-primary hover:bg-brand-primary/10 dark:hover:bg-brand-primary/20 min-w-8 h-8"
                  isIconOnly
                >
                  <Eye size={16} />
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  variant="light"
                  onPress={(e: any) => {
                    e.stopPropagation();
                    onDelete(item.id);
                  }}
                  className="text-error hover:bg-secondary dark:hover:bg-secondary min-w-8 h-8"
                  isIconOnly
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
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
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<ListImperativeAPI | null>(null);

  // 容器高度状态 - 使用 state 确保响应式更新
  const [containerHeight, setContainerHeight] = useState(() => {
    // 初始化时计算高度（宽度自适应父容器）
    const viewportHeight = window.innerHeight;
    const headerHeight = 180;
    const toolbarHeight = 80;
    const statsHeight = 40;
    const paginationHeight = Math.ceil(total / 50) > 1 ? 80 : 20;
    const padding = 48;
    const maxHeight =
      viewportHeight - headerHeight - toolbarHeight - statsHeight - paginationHeight - padding;
    return Math.max(400, Math.floor(maxHeight * 0.9));
  });

  // 分页计算
  const totalPages = useMemo(() => {
    return Math.ceil(total / 50);
  }, [total]);

  // 响应窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      const viewportHeight = window.innerHeight;
      const headerHeight = 180;
      const toolbarHeight = 80;
      const statsHeight = 40;
      const paginationHeight = totalPages > 1 ? 80 : 20;
      const padding = 48;
      const maxHeight =
        viewportHeight - headerHeight - toolbarHeight - statsHeight - paginationHeight - padding;

      setContainerHeight(Math.max(400, Math.floor(maxHeight * 0.9)));
    };

    // 添加防抖，避免频繁计算
    let timeoutId: ReturnType<typeof setTimeout>;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', debouncedResize);
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(timeoutId);
    };
  }, [totalPages]);

  // 滚动到顶部
  const scrollToTop = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToRow({ index: 0, align: 'start' });
    }
  }, []);

  // 事件处理函数
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

  const handleClientChange = useCallback(
    (value: string) => {
      const newFilters = { ...filters };
      if (value === 'all') {
        delete newFilters.client;
      } else {
        newFilters.client = value;
      }
      onFiltersChange(newFilters);
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

  // 清理定时器
  useEffect(() => {
    return () => {
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
          aria-label="按客户端筛选请求"
          selectedKeys={[filters.client || 'all']}
          onChange={e => handleClientChange(e.target.value)}
          className="w-full md:w-48"
          radius="lg"
          placeholder="所有客户端"
          classNames={{
            trigger: 'shadow-sm bg-elevated dark:bg-elevated border border-subtle',
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

    // 表头 - 使用 table 布局与内容行完全对齐
    // overflow-y: scroll 强制显示滚动条轨道，确保与内容行宽度一致
    const tableHeader = (
      <div className="bg-canvas dark:bg-secondary border-b border-subtle px-4 py-2 text-xs font-semibold text-secondary overflow-y-scroll">
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <colgroup><col style={{ width: '42px' }} /><col style={{ width: '176px' }} /><col style={{ width: '84px' }} /><col style={{ width: '224px' }} /><col style={{ width: '48px' }} /><col style={{ width: '64px' }} /><col style={{ width: '128px' }} /><col style={{ width: '96px' }} /><col style={{ width: '80px' }} /></colgroup>
          <tbody>
            <tr>
              <th className="text-center">已查看</th>
              <th className="text-center">时间</th>
              <th className="text-center">客户端</th>
              <th className="text-left">路径</th>
              <th className="text-center">规则</th>
              <th className="text-center">状态</th>
              <th className="text-left">大小</th>
              <th className="text-center">耗时</th>
              <th className="text-center">操作</th>
            </tr>
          </tbody>
        </table>
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
      const {
        index,
        style,
        requests,
        onRowClick,
        onDelete,
        selectedId,
        viewedIds,
        onViewedToggle,
      } = props;
      return (
        <VirtualRow
          index={index}
          style={style}
          requests={requests}
          onRowClick={onRowClick}
          onDelete={onDelete}
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
            rowComponent={RowComponent}
            rowProps={
              {
                requests,
                onRowClick,
                onDelete,
                selectedId,
                viewedIds,
                onViewedToggle,
              } as RowCustomProps
            }
            style={{ height: containerHeight }}
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
          showControls={true}
          classNames={{
            wrapper: 'gap-xs',
            // 未选中页：添加边框和阴影增强视觉区分
            item: 'min-w-9 h-9 text-small border border-subtle shadow-sm hover:shadow-md hover:border-brand-primary/50',
            // 修复选中页颜色对比度：使用纯色背景+白色文字
            cursor:
              'bg-brand-primary text-white dark:bg-brand-primary dark:text-white font-bold shadow-lg border-2 border-brand-primary',
            prev: 'text-small shadow-sm',
            next: 'text-small shadow-sm',
          }}
        />
      </div>
    );
  };

  return (
    <div className="space-y-md">
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
