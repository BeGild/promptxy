import React, { useState } from "react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Button, Input, Spacer, Pagination, Spinner, Badge } from "@heroui/react";
import { EmptyState } from "@/components/common";
import { RequestListItem } from "@/types";
import { formatRelativeTime, formatDuration, getStatusColor, formatClient } from "@/utils";

interface RequestListProps {
  requests: RequestListItem[];
  isLoading: boolean;
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  onRowClick: (id: string) => void;
  onRefresh: () => void;
  onDelete: (id: string) => void;
}

export const RequestList: React.FC<RequestListProps> = ({
  requests,
  isLoading,
  total,
  page,
  onPageChange,
  onRowClick,
  onRefresh,
  onDelete,
}) => {
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState<string>("all");

  // 过滤
  const filteredRequests = requests.filter((req) => {
    const matchSearch =
      req.id.toLowerCase().includes(search.toLowerCase()) ||
      req.path.toLowerCase().includes(search.toLowerCase());
    const matchClient = filterClient === "all" || req.client === filterClient;
    return matchSearch && matchClient;
  });

  const totalPages = Math.ceil(total / 50);

  if (isLoading && requests.length === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "32px" }}>
        <Spinner>加载请求中...</Spinner>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        title="暂无请求"
        description="启动代理后，经过代理的请求将显示在这里"
        actionText="刷新"
        onAction={onRefresh}
      />
    );
  }

  return (
    <div>
      {/* 工具栏 */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
        <Input
          placeholder="搜索ID或路径..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: "200px" }}
        />
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid var(--heroui-colors-border)",
            background: "var(--heroui-colors-background)",
            color: "var(--heroui-colors-foreground)",
          }}
        >
          <option value="all">所有客户端</option>
          <option value="claude">Claude</option>
          <option value="codex">Codex</option>
          <option value="gemini">Gemini</option>
        </select>
        <Button color="primary" onPress={onRefresh}>
          刷新
        </Button>
      </div>

      <div style={{ color: "var(--heroui-colors-text-secondary)", fontSize: "12px", marginBottom: "12px" }}>
        共 {total} 条请求，显示 {filteredRequests.length} 条
      </div>

      {/* 请求表格 */}
      <Table
        aria-label="请求历史表"
        style={{ height: "auto", minWidth: "100%" }}
        selectionMode="single"
        onRowAction={(key) => onRowClick(key as string)}
      >
        <TableHeader>
          <TableColumn>时间</TableColumn>
          <TableColumn>客户端</TableColumn>
          <TableColumn>路径</TableColumn>
          <TableColumn>方法</TableColumn>
          <TableColumn>状态</TableColumn>
          <TableColumn>耗时</TableColumn>
          <TableColumn>操作</TableColumn>
        </TableHeader>
        <TableBody
          items={filteredRequests}
          isLoading={isLoading}
          emptyContent={<div style={{ padding: "32px" }}>暂无数据</div>}
        >
          {(item) => (
            <TableRow key={item.id}>
              <TableCell>{formatRelativeTime(item.timestamp)}</TableCell>
              <TableCell>
                <Badge color="primary" variant="flat" size="sm">
                  {formatClient(item.client)}
                </Badge>
              </TableCell>
              <TableCell>
                <span style={{ fontFamily: "monospace", fontSize: "12px" }}>
                  {item.path}
                </span>
              </TableCell>
              <TableCell>
                <Chip size="sm" color="default" variant="flat">
                  {item.method}
                </Chip>
              </TableCell>
              <TableCell>
                <Chip
                  size="sm"
                  color={getStatusColor(item.responseStatus)}
                  variant="flat"
                >
                  {item.responseStatus || "N/A"}
                </Chip>
              </TableCell>
              <TableCell>
                {item.durationMs ? formatDuration(item.durationMs) : "-"}
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => onRowClick(item.id)}
                >
                  查看
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  variant="light"
                  onPress={() => onDelete(item.id)}
                  style={{ marginLeft: "4px" }}
                >
                  删除
                </Button>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* 分页 */}
      {totalPages > 1 && (
        <>
          <Spacer y={2} />
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Pagination
              total={totalPages}
              page={page}
              onChange={onPageChange}
              color="primary"
            />
          </div>
        </>
      )}
    </div>
  );
};
