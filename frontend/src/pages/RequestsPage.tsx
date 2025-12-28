/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - className="text-blue-700 dark:text-blue-300"
 * - className="border-blue-200/50 dark:border-blue-800/30"
 *
 * ✅ REQUIRED:
 * - className="text-brand-primary"
 * - className="border-brand-primary/30 dark:border-brand-primary/20"
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDisclosure, Card, CardBody, Chip } from '@heroui/react';
import { toast } from 'sonner';
import { RequestList, RequestDetail } from '@/components/requests';
import { Modal } from '@/components/common';
import { useRequests, useRequestDetail, useDeleteRequest } from '@/hooks';
import { RequestFilters } from '@/types';

const VIEWED_STORAGE_KEY = 'promptxy_viewed_requests';

function readViewedIdsArray(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = globalThis.localStorage?.getItem(VIEWED_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) return [];
    const unique = new Set<string>();
    for (const v of parsed) {
      if (typeof v === 'string' && v) unique.add(v);
    }
    return [...unique];
  } catch {
    return [];
  }
}

export const RequestsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<RequestFilters>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 已查看：React state 为唯一真相，localStorage 仅做持久化镜像
  const [viewedIdsArray, setViewedIdsArray] = useState<string[]>(() => readViewedIdsArray());
  const viewedIds = useMemo(() => new Set(viewedIdsArray), [viewedIdsArray]);

  const { data, isLoading, refetch } = useRequests(filters, page);
  const { request, isLoading: detailLoading } = useRequestDetail(selectedId);
  const deleteMutation = useDeleteRequest();

  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(VIEWED_STORAGE_KEY, JSON.stringify(viewedIdsArray));
    } catch {
      // 忽略存储错误
    }
  }, [viewedIdsArray]);

  const handleRowClick = useCallback(
    (id: string) => {
      setSelectedId(id);
      setViewedIdsArray(prev => (prev.includes(id) ? prev : [...prev, id]));
      onOpen();
    },
    [onOpen],
  );

  const handleClose = useCallback(() => {
    onClose();
    // 不清除 selectedId，保持选中状态
  }, [onClose]);

  const handleViewedToggle = useCallback((id: string) => {
    setViewedIdsArray(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }, []);

  const handleDelete = async (id: string) => {
    // 使用 toast.promise 处理异步操作
    toast.promise(deleteMutation.mutateAsync(id), {
      loading: '正在删除请求...',
      success: () => {
        setViewedIdsArray(prev => prev.filter(x => x !== id));
        refetch();
        return `请求 ${id} 已删除`;
      },
      error: (err: any) => `删除失败: ${err?.message}`,
    });
  };

  const handleRefresh = () => {
    refetch();
    toast.success('已刷新请求列表');
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-primary to-accent bg-clip-text text-transparent">
            请求监控
          </h1>
          <p className="text-sm text-secondary mt-1">实时查看经过代理的请求历史和修改详情</p>
        </div>
        <div className="flex gap-2">
          <Chip color="secondary" variant="flat" size="sm">
            {data?.total || 0} 条记录
          </Chip>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5">
          <CardBody className="p-p4">
            <div className="text-sm text-brand-primary dark:text-brand-primary/80 font-medium">
              总请求
            </div>
            <div className="text-2xl font-bold text-brand-primary dark:text-brand-primary/90">
              {data?.total || 0}
            </div>
          </CardBody>
        </Card>
        <Card className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5">
          <CardBody className="p-p4">
            <div className="text-sm text-status-success dark:text-status-success/80 font-medium">
              当前页
            </div>
            <div className="text-2xl font-bold text-status-success dark:text-status-success/90">
              {data?.items?.length || 0}
            </div>
          </CardBody>
        </Card>
        <Card className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5">
          <CardBody className="p-p4">
            <div className="text-sm text-accent dark:text-accent/80 font-medium">当前页码</div>
            <div className="text-2xl font-bold text-accent dark:text-accent/90">{page}</div>
          </CardBody>
        </Card>
        <Card className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5">
          <CardBody className="p-p4">
            <div className="text-sm text-status-warning dark:text-status-warning/80 font-medium">
              总页数
            </div>
            <div className="text-2xl font-bold text-status-warning dark:text-status-warning/90">
              {Math.ceil((data?.total || 0) / 50)}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* 请求列表组件 */}
      <RequestList
        requests={data?.items || []}
        filters={filters}
        onFiltersChange={setFilters}
        isLoading={isLoading}
        total={data?.total || 0}
        page={page}
        onPageChange={setPage}
        onRowClick={handleRowClick}
        onRefresh={handleRefresh}
        onDelete={handleDelete}
        selectedId={selectedId}
        viewedIds={viewedIds}
        onViewedToggle={handleViewedToggle}
      />

      {/* 请求详情模态框 */}
      <Modal isOpen={isOpen} onClose={handleClose} title="请求详情" size="4xl" backdrop="blur">
        <RequestDetail request={request || null} isLoading={detailLoading} onClose={handleClose} />
      </Modal>
    </div>
  );
};
