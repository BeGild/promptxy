import React, { useState } from "react";
import { useDisclosure, Card, CardBody, Chip } from "@heroui/react";
import { RequestList } from "@/components/requests";
import { RequestDetail } from "@/components/requests";
import { Modal } from "@/components/common";
import { useRequests, useRequestDetail, useDeleteRequest } from "@/hooks";
import { RequestFilters } from "@/types";

export const RequestsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<RequestFilters>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useRequests(filters, page);
  const { request, isLoading: detailLoading } = useRequestDetail(selectedId);
  const deleteMutation = useDeleteRequest();

  const { isOpen, onOpen, onClose } = useDisclosure();

  const handleRowClick = (id: string) => {
    setSelectedId(id);
    onOpen();
  };

  const handleClose = () => {
    onClose();
    setSelectedId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm(`确定要删除请求 ${id} 吗？`)) {
      try {
        await deleteMutation.mutateAsync(id);
        refetch();
      } catch (error: any) {
        alert(`删除失败: ${error?.message}`);
      }
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="p-6 space-y-6">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            请求监控
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            实时查看经过代理的请求历史和修改详情
          </p>
        </div>
        <div className="flex gap-2">
          <Chip color="secondary" variant="flat" size="sm">
            {data?.total || 0} 条记录
          </Chip>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/10 border-none">
          <CardBody className="p-4">
            <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">总请求</div>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {data?.total || 0}
            </div>
          </CardBody>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/10 border-none">
          <CardBody className="p-4">
            <div className="text-sm text-green-700 dark:text-green-300 font-medium">当前页</div>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {data?.items?.length || 0}
            </div>
          </CardBody>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/10 border-none">
          <CardBody className="p-4">
            <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">当前页码</div>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {page}
            </div>
          </CardBody>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/10 border-none">
          <CardBody className="p-4">
            <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">总页数</div>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
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
      />

      {/* 请求详情模态框 */}
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="请求详情"
        size="4xl"
        backdrop="blur"
      >
        <RequestDetail
          request={request || null}
          isLoading={detailLoading}
          onClose={handleClose}
        />
      </Modal>
    </div>
  );
};
