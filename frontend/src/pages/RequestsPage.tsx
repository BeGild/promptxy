import React, { useState } from "react";
import { Spacer, useDisclosure } from "@heroui/react";
import { RequestList } from "@/components/requests";
import { RequestDetail } from "@/components/requests";
import { Modal } from "@/components/common";
import { useRequests, useRequestDetail, useDeleteRequest } from "@/hooks";
import { useUIStore } from "@/store";

export const RequestsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useRequests({}, page);
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
    <div style={{ padding: "16px" }}>
      <RequestList
        requests={data?.items || []}
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
