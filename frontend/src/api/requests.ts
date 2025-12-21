import { apiClient } from "./client";
import { RequestListResponse, RequestRecord, RequestFilters, CleanupResponse, RequestStats, DatabaseInfo } from "@/types";

/**
 * 获取请求列表
 */
export async function getRequests(filters: RequestFilters = {}, page: number = 1, limit: number = 50): Promise<RequestListResponse> {
  const params = new URLSearchParams();
  params.set("limit", limit.toString());
  params.set("offset", ((page - 1) * limit).toString());

  if (filters.client) params.set("client", filters.client);
  if (filters.startTime) params.set("startTime", filters.startTime.toString());
  if (filters.endTime) params.set("endTime", filters.endTime.toString());
  if (filters.search) params.set("search", filters.search);

  const response = await apiClient.get(`/_promptxy/requests?${params.toString()}`);
  return response.data;
}

/**
 * 获取单个请求详情
 */
export async function getRequestDetail(id: string): Promise<RequestRecord> {
  const response = await apiClient.get(`/_promptxy/requests/${id}`);
  return response.data;
}

/**
 * 删除单个请求
 */
export async function deleteRequest(id: string): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete(`/_promptxy/requests/${id}`);
  return response.data;
}

/**
 * 清理旧数据
 */
export async function cleanupRequests(keep: number = 100): Promise<CleanupResponse> {
  const response = await apiClient.post(`/_promptxy/requests/cleanup?keep=${keep}`);
  return response.data;
}

/**
 * 获取统计信息
 */
export async function getStats(): Promise<RequestStats> {
  const response = await apiClient.get("/_promptxy/stats");
  return response.data;
}

/**
 * 获取数据库信息
 */
export async function getDatabaseInfo(): Promise<DatabaseInfo> {
  const response = await apiClient.get("/_promptxy/database");
  return response.data;
}
