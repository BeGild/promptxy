import axios from "axios";
import { ErrorResponse } from "@/types";

// API 基础 URL
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "http://127.0.0.1:7071";

// 创建 Axios 实例
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 统一错误处理
    if (error.response) {
      const data = error.response.data as ErrorResponse;
      return Promise.reject(new Error(data.message || data.error || "请求失败"));
    }
    if (error.request) {
      return Promise.reject(new Error("无法连接到服务器"));
    }
    return Promise.reject(error);
  }
);

// 健康检查
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await apiClient.get("/_promptxy/health");
    return response.data.status === "ok";
  } catch {
    return false;
  }
}
